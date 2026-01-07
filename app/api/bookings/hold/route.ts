import { NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase'
import { computeAvailableSlots, getUtcDayRange } from '@/lib/slots'
import { checkSubscriptionAccess } from '@/lib/subscription-access'
import { z } from 'zod'

// Validation schema for holding a booking slot
const holdBookingSchema = z.object({
    barber_id: z.string().uuid('Invalid barber ID'),
    service_ids: z.array(z.string().uuid('Invalid service ID')).min(1).max(20),
    slot_start: z.string().datetime('Invalid slot start time'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
    timezone_offset: z.number().int().min(-720).max(720).optional(),
})

export async function POST(req: Request) {
    const supabase = createServiceSupabaseClient()

    let body: z.infer<typeof holdBookingSchema>

    try {
        const rawBody = await req.json()
        const validation = holdBookingSchema.safeParse(rawBody)
        
        if (!validation.success) {
            return NextResponse.json({ 
                error: 'Invalid input', 
                details: validation.error.issues 
            }, { status: 400 })
        }
        
        body = validation.data
    } catch (error) {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { barber_id, service_ids, slot_start, date, timezone_offset } = body

    // Resolve services and calculate total duration
    const { data: services, error: servicesError } = await supabase
        .from('services')
        .select('id, shop_id, duration_minutes, is_active, deleted_at')
        .in('id', service_ids)

    if (servicesError) {
        return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 })
    }

    if (!services || services.length !== service_ids.length) {
        return NextResponse.json({ error: 'Some services not found' }, { status: 400 })
    }

    if ((services as any[]).some((s) => s.deleted_at || s.is_active === false)) {
        return NextResponse.json({ error: 'Some services are inactive' }, { status: 400 })
    }

    // All services must be from the same shop
    const shopId = (services as any[])[0].shop_id
    if ((services as any[]).some((s) => s.shop_id !== shopId)) {
        return NextResponse.json({ error: 'Services must belong to the same shop' }, { status: 400 })
    }

    const totalDuration = (services as any[]).reduce((sum, s) => sum + (s.duration_minutes || 0), 0)

    // Validate barber belongs to same shop and is active
    const { data: barber, error: barberError } = await supabase
        .from('barbers')
        .select('id, shop_id, is_active, deleted_at')
        .eq('id', barber_id)
        .maybeSingle()

    if (barberError) {
        return NextResponse.json({ error: 'Failed to fetch barber' }, { status: 500 })
    }

    if (!barber || (barber as any).deleted_at || (barber as any).is_active === false || (barber as any).shop_id !== shopId) {
        return NextResponse.json({ error: 'Barber not available for this shop' }, { status: 400 })
    }

    // Check subscription access
    const accessCheck = await checkSubscriptionAccess(shopId as string)
    if (!accessCheck.allowed) {
        return NextResponse.json({ error: 'Shop subscription is not active' }, { status: 403 })
    }

    let dayRange: ReturnType<typeof getUtcDayRange>
    try {
        dayRange = getUtcDayRange(date)
    } catch {
        return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
    }

    // Enforce booking window: today..+1 (UTC)
    const todayUtc = new Date()
    const yyyyMmDdToday = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate()))
    const yyyyMmDdPlus1 = new Date(yyyyMmDdToday)
    yyyyMmDdPlus1.setUTCDate(yyyyMmDdPlus1.getUTCDate() + 1)
    const dateDay = dayRange.start
    if (dateDay < yyyyMmDdToday || dateDay > yyyyMmDdPlus1) {
        return NextResponse.json({ error: 'Date outside allowed window' }, { status: 400 })
    }

    // Fetch working hours for the shop/day
    const { data: workingHours, error: hoursError } = await supabase
        .from('working_hours')
        .select('open_time, close_time, is_closed, day_of_week')
        .eq('shop_id', shopId!)
        .eq('day_of_week', dayRange.start.getUTCDay())
        .maybeSingle()

    if (hoursError) {
        return NextResponse.json({ error: 'Failed to fetch working hours' }, { status: 500 })
    }

    // Helper: convert time string (HH:MM:SS or HH:MM) to minutes since midnight
    const timeToMinutes = (timeStr: string | null): number => {
        if (!timeStr) return 0
        const parts = timeStr.split(':')
        return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10)
    }

    // Helper: convert minutes to time string HH:MM:SS
    const minutesToTimeString = (minutes: number): string => {
        const normalized = ((minutes % 1440) + 1440) % 1440
        const hours = Math.floor(normalized / 60)
        const mins = normalized % 60
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:00`
    }

    // If timezone_offset provided, convert working hours from local to UTC
    let adjustedWorkingHours: any = workingHours as any
    if (timezone_offset !== undefined && workingHours && (workingHours as any).is_closed === false) {
        const localOpenMinutes = timeToMinutes((workingHours as any).open_time)
        const localCloseMinutes = timeToMinutes((workingHours as any).close_time)
        const utcOpenMinutes = localOpenMinutes + timezone_offset
        const utcCloseMinutes = localCloseMinutes + timezone_offset
        
        adjustedWorkingHours = {
            ...(workingHours as any),
            open_time: minutesToTimeString(utcOpenMinutes),
            close_time: minutesToTimeString(utcCloseMinutes),
        }
    }

    // Fetch same-day bookings including non-expired pending ones
    const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('start_time, end_time, status, expires_at')
        .eq('barber_id', barber_id)
        .is('deleted_at', null)
        .gte('start_time', dayRange.start.toISOString())
        .lt('start_time', dayRange.end.toISOString())

    if (bookingsError) {
        return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
    }

    // Filter out expired pending bookings
    const now = new Date()
    const activeBookings = (bookings ?? []).filter((b: any) => {
        if (b.status === 'pending_payment') {
            return b.expires_at && new Date(b.expires_at) > now
        }
        return b.status === 'confirmed' || b.status === 'completed'
    })

    const slots = computeAvailableSlots({
        date,
        serviceDurationMinutes: totalDuration,
        workingHours: adjustedWorkingHours ?? null,
        bookings: activeBookings,
    })

    const selectedSlot = slots.find((s) => s.start === slot_start)
    if (!selectedSlot) {
        return NextResponse.json({ 
            error: 'Selected slot is not available or already held by another customer' 
        }, { status: 409 })
    }

    // If the requested date is today (UTC), ensure slot_start is future
    const isToday = dayRange.start.getUTCFullYear() === now.getUTCFullYear()
        && dayRange.start.getUTCMonth() === now.getUTCMonth()
        && dayRange.start.getUTCDate() === now.getUTCDate()
    if (isToday && new Date(selectedSlot.start) <= now) {
        return NextResponse.json({ error: 'Cannot hold past time slots' }, { status: 400 })
    }

    // Calculate expiration time (10 minutes from now)
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000)

    // Create a pending booking (placeholder with no customer info yet)
    const { data: booking, error: bookingError } = await (supabase as any)
        .from('bookings')
        .insert({
            shop_id: shopId,
            barber_id: barber_id,
            service_id: service_ids[0], // Primary service for legacy compatibility
            customer_name: 'PENDING',
            customer_phone: '0000000000',
            start_time: selectedSlot.start,
            end_time: selectedSlot.end,
            status: 'pending_payment',
            expires_at: expiresAt.toISOString(),
            is_walk_in: false,
        })
        .select('id')
        .single()

    if (bookingError) {
        // Check if it's a conflict error (overlap)
        const code = (bookingError as any).code
        if (code === '23P01' || bookingError.message?.includes('overlap')) {
            return NextResponse.json({ 
                error: 'Slot was just taken by another customer. Please select a different time.' 
            }, { status: 409 })
        }
        return NextResponse.json({ error: bookingError.message }, { status: 500 })
    }

    // Link services to the booking
    const bookingServices = service_ids.map((serviceId) => ({
        booking_id: booking.id,
        service_id: serviceId,
    }))

    const { error: servicesLinkError } = await (supabase as any)
        .from('booking_services')
        .insert(bookingServices)

    if (servicesLinkError) {
        // Rollback the booking if services couldn't be linked
        await (supabase as any)
            .from('bookings')
            .delete()
            .eq('id', booking!.id)
        
        return NextResponse.json({ error: 'Failed to link services to booking' }, { status: 500 })
    }

    return NextResponse.json({ 
        booking_id: booking.id,
        expires_at: expiresAt.toISOString(),
        message: 'Slot held for 10 minutes'
    })
}
