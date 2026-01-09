import { NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase'
import { computeAvailableSlots, getUtcDayRange } from '@/lib/slots'
import { checkSubscriptionAccess } from '@/lib/subscription-access'
import { z } from 'zod'

// Validation schema for hold request
const holdSchema = z.object({
    barber_id: z.string().uuid('Invalid barber ID'),
    service_ids: z.array(z.string().uuid('Invalid service ID')).min(1).max(20),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
    slot_time: z.string().datetime('Invalid slot time'),
    timezone_offset: z.number().int().min(-720).max(720).optional()
})

const HOLD_DURATION_MINUTES = 10

export async function POST(req: Request) {
    const supabase = createServiceSupabaseClient()

    let body: z.infer<typeof holdSchema>

    try {
        const rawBody = await req.json()
        const validation = holdSchema.safeParse(rawBody)
        
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

    const { barber_id, service_ids, date, slot_time, timezone_offset } = body

    console.log('[bookings-hold] incoming hold request', {
        barber_id,
        service_ids,
        date,
        slot_time,
        tz_offset: timezone_offset
    })

    // Fetch and validate services
    const { data: services, error: servicesError } = await supabase
        .from('services')
        .select('id, shop_id, duration_minutes, is_active, deleted_at')
        .in('id', service_ids)

    if (servicesError) {
        console.error('[bookings-hold] services fetch error', servicesError)
        return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 })
    }

    if (!services || services.length !== service_ids.length) {
        return NextResponse.json({ error: 'Some services not found' }, { status: 400 })
    }

    if ((services as any[]).some((s) => s.deleted_at || s.is_active === false)) {
        return NextResponse.json({ error: 'Some services are inactive' }, { status: 400 })
    }

    // Ensure all services belong to same shop
    const shopId = (services as any[])[0].shop_id
    if ((services as any[]).some((s) => s.shop_id !== shopId)) {
        return NextResponse.json({ error: 'Services must belong to the same shop' }, { status: 400 })
    }

    // Calculate total duration
    const totalDuration = (services as any[]).reduce((sum, s) => sum + (s.duration_minutes || 0), 0)

    // Validate barber belongs to same shop
    const { data: barber, error: barberError } = await supabase
        .from('barbers')
        .select('id, shop_id, is_active, deleted_at')
        .eq('id', barber_id)
        .maybeSingle()

    if (barberError) {
        console.error('[bookings-hold] barber fetch error', barberError)
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

    // Parse slot time
    let slotStart: Date
    try {
        slotStart = new Date(slot_time)
        if (isNaN(slotStart.getTime())) {
            throw new Error('Invalid date')
        }
    } catch {
        return NextResponse.json({ error: 'Invalid slot_time format' }, { status: 400 })
    }

    const slotEnd = new Date(slotStart.getTime() + totalDuration * 60000)

    console.log('[bookings-hold] calculated slot times', {
        slotStart: slotStart.toISOString(),
        slotEnd: slotEnd.toISOString(),
        durationMinutes: totalDuration
    })

    // Check for conflicting bookings (confirmed, completed, or non-expired pending_payment)
    const { data: conflictingBookings, error: conflictError } = await supabase
        .from('bookings')
        .select('id, status, expires_at')
        .eq('barber_id', barber_id)
        .is('deleted_at', null)
        .gte('start_time', slotStart.toISOString())
        .lt('start_time', slotEnd.toISOString())

    if (conflictError) {
        console.error('[bookings-hold] conflict check error', conflictError)
        return NextResponse.json({ error: 'Failed to check slot availability' }, { status: 500 })
    }

    // Check if any conflicting bookings exist
    if (conflictingBookings && conflictingBookings.length > 0) {
        const hasConfirmedOrCompleted = (conflictingBookings as any[]).some(
            b => b.status === 'confirmed' || b.status === 'completed'
        )
        const hasValidHold = (conflictingBookings as any[]).some(
            b => b.status === 'pending_payment' && new Date(b.expires_at) > new Date()
        )

        if (hasConfirmedOrCompleted || hasValidHold) {
            console.log('[bookings-hold] slot conflict detected', {
                conflictCount: conflictingBookings.length,
                hasConfirmed: hasConfirmedOrCompleted,
                hasValidHold
            })
            return NextResponse.json({ error: 'Slot is not available' }, { status: 409 })
        }
    }

    // Create pending_payment booking with expiry
    const expiresAt = new Date(Date.now() + HOLD_DURATION_MINUTES * 60000)
    
    // We need a service_id for the bookings table; use the first service
    const primaryServiceId = (services as any[])[0].id

    const { data: holdBooking, error: holdError } = await (supabase as any)
        .from('bookings')
        .insert({
            shop_id: shopId,
            barber_id,
            service_id: primaryServiceId,
            customer_name: 'PENDING', // Placeholder; will be updated on confirmation
            customer_phone: 'PENDING', // Placeholder; will be updated on confirmation
            start_time: slotStart.toISOString(),
            end_time: slotEnd.toISOString(),
            status: 'pending_payment',
            expires_at: expiresAt.toISOString(),
            is_walk_in: false
        })
        .select('id')
        .single()

    if (holdError) {
        console.error('[bookings-hold] insert error', holdError)
        
        // Check if error is due to overlap (our trigger might have caught it)
        if (holdError.message && holdError.message.includes('overlaps')) {
            return NextResponse.json({ error: 'Slot is not available' }, { status: 409 })
        }
        
        return NextResponse.json({ error: 'Failed to create booking hold' }, { status: 500 })
    }

    console.log('[bookings-hold] hold created successfully', {
        bookingId: (holdBooking as any).id,
        expiresAt: expiresAt.toISOString()
    })

    return NextResponse.json({
        bookingId: (holdBooking as any).id,
        expiresAt: expiresAt.toISOString()
    }, { status: 200 })
}
