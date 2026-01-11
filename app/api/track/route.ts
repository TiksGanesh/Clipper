import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type BookingStatus = Database['public']['Enums']['booking_status']

type TrackingResponse = {
    booking: {
        id: string
        original_start: string
        service_name: string
        barber_name: string
        customer_name: string
        status: BookingStatus
        duration_minutes: number
    }
    live_status: {
        is_delayed: boolean
        delay_minutes: number
        expected_start: string
        queue_position: number
        people_ahead: number
        current_activity: string
        timestamp: string
    }
    debug_queue?: Array<{ id: string; status: string; start_time: string }>
}

// Mark this route as dynamic to prevent Next.js caching
export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Public API route for live booking tracking
 * No authentication required - uses booking_id as token
 * Uses service role key to bypass RLS for public access
 * 
 * GET /api/track?booking_id=<uuid>
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const bookingId = searchParams.get('booking_id')

        if (!bookingId) {
            return NextResponse.json(
                { error: 'booking_id is required' },
                { status: 400 }
            )
        }

        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(bookingId)) {
            return NextResponse.json(
                { error: 'Invalid booking_id format' },
                { status: 400 }
            )
        }

        // Create fresh Supabase client per request with aggressive no-cache settings
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('Supabase environment variables NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY are not set')
            return NextResponse.json(
                { error: 'Service configuration error. Please contact support.' },
                { status: 500 }
            )
        }
        
        const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
            db: {
                schema: 'public',
            },
            global: {
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                    'Prefer': 'return=representation' // Force fresh data from PostgREST
                }
            },
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            }
        })

        // First check if booking exists at all
        const { data: checkBooking, error: checkError } = await supabase
            .from('bookings')
            .select('id, deleted_at, status, service_id, barber_id')
            .eq('id', bookingId)
            .maybeSingle() as { data: any | null; error: any }

        if (checkError) {
            console.error('Booking check error:', { bookingId, error: checkError })
            return NextResponse.json(
                { error: 'Database error' },
                { status: 500 }
            )
        }

        if (!checkBooking) {
            console.error('Booking not found in database:', { bookingId })
            return NextResponse.json(
                { error: 'Booking not found' },
                { status: 404 }
            )
        }

        if (checkBooking.deleted_at) {
            console.error('Booking is deleted:', { bookingId })
            return NextResponse.json(
                { error: 'This booking has been cancelled' },
                { status: 410 }
            )
        }

        // Now fetch the full booking details with relations
        const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .select(`
                id,
                start_time,
                end_time,
                status,
                customer_name,
                barber_id,
                service_id,
                shop_id,
                services (
                    name,
                    duration_minutes
                ),
                barbers (
                    id,
                    name,
                    current_delay_minutes
                )
            `)
            .eq('id', bookingId)
            .is('deleted_at', null)
            .single()

        if (bookingError || !booking) {
            console.error('Booking fetch error:', { bookingId, error: bookingError })
            return NextResponse.json(
                { error: 'Booking not found' },
                { status: 404 }
            )
        }

        // Type assertion for nested relations
        const bookingData = booking as unknown as {
            id: string
            start_time: string
            end_time: string
            status: BookingStatus
            customer_name: string
            barber_id: string
            service_id: string
            shop_id: string
            services: { name: string; duration_minutes: number } | null
            barbers: { id: string; name: string; current_delay_minutes: number } | null
        }

        const service = bookingData.services
        const barber = bookingData.barbers

        if (!service || !barber) {
            return NextResponse.json(
                { error: 'Booking data incomplete' },
                { status: 500 }
            )
        }

        const barberId = bookingData.barber_id
        const barberDelayMinutes = barber.current_delay_minutes || 0
        const bookingStartTime = new Date(bookingData.start_time)
        const todayStart = new Date(bookingStartTime)
        todayStart.setHours(0, 0, 0, 0)
        const todayEnd = new Date(bookingStartTime)
        todayEnd.setHours(23, 59, 59, 999)

        // Calculate queue position: Always fetch full list for accurate count
        const { data: precedingBookings, error: countError } = await supabase
            .from('bookings')
            .select('id, status, start_time')
            .eq('barber_id', barberId)
            .eq('shop_id', bookingData.shop_id)
            .in('status', ['confirmed', 'seated'] as BookingStatus[])
            .lt('start_time', bookingData.start_time)
            .gte('start_time', todayStart.toISOString())
            .lte('start_time', todayEnd.toISOString())
            .is('deleted_at', null)
            .order('start_time', { ascending: true })

        if (countError) {
            console.error('Error counting queue:', countError)
        }

        const peopleAhead = precedingBookings?.length || 0
        const queuePosition = peopleAhead + 1 // +1 because position is 1-indexed

        // Optional debug: include full queue list when ?debug=1
        let debugQueue: Array<{ id: string; status: string; start_time: string }> | undefined
        const debugParam = request.nextUrl.searchParams.get('debug')
        if (debugParam === '1') {
            debugQueue = (precedingBookings || []).map(b => ({
                id: (b as any).id,
                status: (b as any).status,
                start_time: (b as any).start_time,
            }))
        }

        // Find current activity: the ONE booking with status = 'seated'
        const { data: currentBooking, error: currentError } = await supabase
            .from('bookings')
            .select(`
                id,
                status,
                services (
                    name
                )
            `)
            .eq('barber_id', barberId)
            .eq('shop_id', bookingData.shop_id)
            .eq('status', 'seated' as BookingStatus)
            .is('deleted_at', null)
            .gte('start_time', todayStart.toISOString())
            .lte('start_time', todayEnd.toISOString())
            .maybeSingle()

        if (currentError) {
            console.error('Error fetching current activity:', currentError)
        }

        let currentActivity = 'Shop is open'
        if (currentBooking) {
            const currentBookingData = currentBooking as unknown as {
                services: { name: string } | null
            }
            const currentService = currentBookingData.services
            if (currentService?.name) {
                currentActivity = `Serving a ${currentService.name}`
            }
        }

        // Calculate expected start time with delay
        const expectedStart = new Date(bookingStartTime)
        expectedStart.setMinutes(expectedStart.getMinutes() + barberDelayMinutes)

        // Format times in IST (Asia/Kolkata)
        const formatTime = (date: Date) => {
            return date.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
                timeZone: 'Asia/Kolkata'
            })
        }

        const response: TrackingResponse = {
            booking: {
                id: bookingData.id,
                original_start: formatTime(bookingStartTime),
                service_name: service.name,
                barber_name: barber.name,
                customer_name: bookingData.customer_name,
                status: bookingData.status,
                duration_minutes: service.duration_minutes,
            },
            live_status: {
                is_delayed: barberDelayMinutes > 0,
                delay_minutes: barberDelayMinutes,
                expected_start: formatTime(expectedStart),
                queue_position: queuePosition,
                people_ahead: peopleAhead || 0,
                current_activity: currentActivity,
                timestamp: new Date().toISOString(),
            }
        }

        if (debugQueue) {
            response.debug_queue = debugQueue
        }

        return NextResponse.json(response, {
            headers: {
                'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        })

    } catch (error) {
        console.error('Tracking API error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
