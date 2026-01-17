import { NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase'
import { computeAvailableSlots, getUtcDayRange } from '@/lib/slots'
import { checkSubscriptionAccess } from '@/lib/subscription-access'
import { z } from 'zod'

// Force dynamic rendering to prevent stale data
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

// Validation schema for hold request
const holdSchema = z.object({
    barber_id: z.string().uuid('Invalid barber ID'),
    service_ids: z.array(z.string().uuid('Invalid service ID')).min(1).max(20),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
    slot_time: z.string().datetime('Invalid slot time'),
    timezone_offset: z.number().int().min(-720).max(720).optional(),
    razorpay_order_id: z.string().optional(),
    amount: z.number().nonnegative().max(1000000).optional()
})

const HOLD_DURATION_MINUTES = 10

export async function POST(req: Request) {
    const supabase = createServiceSupabaseClient()

    let body: z.infer<typeof holdSchema>

    try {
        const rawBody = await req.json()
        console.log('[bookings-hold] raw request body:', JSON.stringify(rawBody, null, 2))
        
        const validation = holdSchema.safeParse(rawBody)
        
        if (!validation.success) {
            console.error('[bookings-hold] validation failed', {
                issues: validation.error.issues,
                body: rawBody
            })
            return NextResponse.json({ 
                error: 'Invalid input', 
                details: validation.error.issues 
            }, { status: 400 })
        }
        
        body = validation.data
        console.log('[bookings-hold] validation passed', { body })
    } catch (error) {
        console.error('[bookings-hold] JSON parse error', { error })
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { barber_id, service_ids, date, slot_time, timezone_offset, razorpay_order_id, amount } = body

    console.log('[bookings-hold] incoming hold request', {
        barber_id,
        service_ids,
        date,
        slot_time,
        tz_offset: timezone_offset,
        razorpay_order_id,
        amount
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

    console.log('[bookings-hold] services fetched', {
        requestedCount: service_ids.length,
        fetchedCount: services?.length ?? 0,
        services: services
    })

    if (!services || services.length !== service_ids.length) {
        console.warn('[bookings-hold] service count mismatch', {
            requested: service_ids,
            found: services?.map((s: any) => s.id) ?? []
        })
        return NextResponse.json({ error: 'Some services not found' }, { status: 400 })
    }

    // Check for inactive or deleted services
    const inactiveOrDeleted = (services as any[]).filter((s) => s.deleted_at || s.is_active === false)
    if (inactiveOrDeleted.length > 0) {
        console.warn('[bookings-hold] inactive/deleted services found', {
            inactiveServices: inactiveOrDeleted
        })
        return NextResponse.json({ error: 'Some services are inactive' }, { status: 400 })
    }

    // Ensure all services belong to same shop
    const shopId = (services as any[])[0].shop_id
    const multipleShops = (services as any[]).filter((s) => s.shop_id !== shopId)
    if (multipleShops.length > 0) {
        console.warn('[bookings-hold] services from different shops', {
            expectedShop: shopId,
            servicesFromOtherShops: multipleShops
        })
        return NextResponse.json({ error: 'Services must belong to the same shop' }, { status: 400 })
    }

    console.log('[bookings-hold] services validation passed', {
        shopId,
        serviceCount: services.length,
        totalDuration: (services as any[]).reduce((sum, s) => sum + (s.duration_minutes || 0), 0)
    })

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

    console.log('[bookings-hold] barber fetched', {
        barberId: barber_id,
        barber: barber ? {
            id: (barber as any).id,
            shop_id: (barber as any).shop_id,
            is_active: (barber as any).is_active,
            deleted_at: (barber as any).deleted_at
        } : null,
        expectedShop: shopId
    })

    if (!barber) {
        console.warn('[bookings-hold] barber not found', { barberId: barber_id })
        return NextResponse.json({ error: 'Barber not available for this shop' }, { status: 400 })
    }

    if ((barber as any).deleted_at) {
        console.warn('[bookings-hold] barber is deleted', { barberId: barber_id, deleted_at: (barber as any).deleted_at })
        return NextResponse.json({ error: 'Barber not available for this shop' }, { status: 400 })
    }

    if ((barber as any).is_active === false) {
        console.warn('[bookings-hold] barber is inactive', { barberId: barber_id })
        return NextResponse.json({ error: 'Barber not available for this shop' }, { status: 400 })
    }

    if ((barber as any).shop_id !== shopId) {
        console.warn('[bookings-hold] barber from different shop', {
            barberId: barber_id,
            barberShop: (barber as any).shop_id,
            expectedShop: shopId
        })
        return NextResponse.json({ error: 'Barber not available for this shop' }, { status: 400 })
    }

    console.log('[bookings-hold] barber validation passed', {
        barberId: barber_id,
        shopId
    })

    // Check subscription access
    const accessCheck = await checkSubscriptionAccess(shopId as string)
    console.log('[bookings-hold] subscription access check', {
        shopId,
        allowed: accessCheck.allowed,
        reason: (accessCheck as any).reason
    })
    
    if (!accessCheck.allowed) {
        console.warn('[bookings-hold] subscription not active', {
            shopId,
            reason: (accessCheck as any).reason
        })
        return NextResponse.json({ error: 'Shop subscription is not active' }, { status: 403 })
    }

    // Parse slot time
    let slotStart: Date
    try {
        slotStart = new Date(slot_time)
        console.log('[bookings-hold] parsing slot_time', {
            slotTimeInput: slot_time,
            parsed: slotStart.toISOString(),
            valid: !isNaN(slotStart.getTime())
        })
        
        if (isNaN(slotStart.getTime())) {
            throw new Error('Invalid date')
        }
    } catch (err) {
        console.error('[bookings-hold] slot_time parse error', {
            slotTime: slot_time,
            error: err instanceof Error ? err.message : String(err)
        })
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
        .lt('start_time', slotEnd.toISOString())
        .gt('end_time', slotStart.toISOString())

    if (conflictError) {
        console.error('[bookings-hold] conflict check error', conflictError)
        return NextResponse.json({ error: 'Failed to check slot availability' }, { status: 500 })
    }

    console.log('[bookings-hold] conflict check query result', {
        barberId: barber_id,
        timeRange: {
            start: slotStart.toISOString(),
            end: slotEnd.toISOString()
        },
        conflictingBookingsFound: conflictingBookings?.length ?? 0,
        bookings: conflictingBookings?.map((b: any) => ({
            id: b.id,
            status: b.status,
            expires_at: b.expires_at
        })) ?? []
    })

    // Check if any conflicting bookings exist
    if (conflictingBookings && conflictingBookings.length > 0) {
        const hasConfirmedOrCompleted = (conflictingBookings as any[]).some(
            b => b.status === 'confirmed' || b.status === 'completed'
        )
        const hasValidHold = (conflictingBookings as any[]).some(
            b => b.status === 'pending_payment' && new Date(b.expires_at) > new Date()
        )

        console.log('[bookings-hold] conflict analysis', {
            totalConflicts: conflictingBookings.length,
            hasConfirmed: hasConfirmedOrCompleted,
            hasValidHold: hasValidHold,
            details: (conflictingBookings as any[]).map(b => ({
                status: b.status,
                expires_at: b.expires_at,
                isExpired: b.status === 'pending_payment' && new Date(b.expires_at) <= new Date()
            }))
        })

        if (hasConfirmedOrCompleted || hasValidHold) {
            console.warn('[bookings-hold] slot conflict detected', {
                conflictCount: conflictingBookings.length,
                hasConfirmed: hasConfirmedOrCompleted,
                hasValidHold
            })
            return NextResponse.json({ error: 'Slot is not available' }, { status: 409 })
        }
    } else {
        console.log('[bookings-hold] no conflicts found - slot is available')
    }

    // Create pending_payment booking with expiry
    const expiresAt = new Date(Date.now() + HOLD_DURATION_MINUTES * 60000)
    
    // We need a service_id for the bookings table; use the first service
    const primaryServiceId = (services as any[])[0].id

    console.log('[bookings-hold] preparing booking insert', {
        shopId,
        barberId: barber_id,
        primaryServiceId,
        startTime: slotStart.toISOString(),
        endTime: slotEnd.toISOString(),
        status: 'pending_payment',
        expiresAt: expiresAt.toISOString(),
        holdDurationMinutes: HOLD_DURATION_MINUTES
    })

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
        console.error('[bookings-hold] insert error', {
            message: holdError.message,
            code: holdError.code,
            details: holdError.details,
            hint: (holdError as any).hint
        })
        
        // Check if error is due to overlap (our trigger might have caught it)
        if (holdError.message && holdError.message.includes('overlaps')) {
            console.warn('[bookings-hold] overlap detected at database level')
            return NextResponse.json({ error: 'Slot is not available' }, { status: 409 })
        }
        
        return NextResponse.json({ error: 'Failed to create booking hold' }, { status: 500 })
    }

    console.log('[bookings-hold] hold created successfully', {
        bookingId: (holdBooking as any).id,
        expiresAt: expiresAt.toISOString(),
        createdAt: new Date().toISOString()
    })

    // Create payment record if razorpay_order_id and amount are provided
    if (razorpay_order_id && amount !== undefined) {
        console.log('[bookings-hold] creating payment record', {
            bookingId: (holdBooking as any).id,
            razorpay_order_id,
            amount
        })

        const { error: paymentError } = await (supabase as any)
            .from('payments')
            .insert({
                booking_id: (holdBooking as any).id,
                razorpay_order_id: razorpay_order_id,
                amount: amount,
                status: 'created'
            })

        if (paymentError) {
            console.error('[bookings-hold] failed to create payment record', {
                bookingId: (holdBooking as any).id,
                razorpay_order_id,
                error: paymentError
            })
            // Non-fatal: booking hold is created, payment record can be created later
        } else {
            console.log('[bookings-hold] payment record created successfully', {
                bookingId: (holdBooking as any).id,
                razorpay_order_id
            })
        }
    }

    const response = NextResponse.json({
        bookingId: (holdBooking as any).id,
        expiresAt: expiresAt.toISOString()
    }, { status: 200 })
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    return response
}
