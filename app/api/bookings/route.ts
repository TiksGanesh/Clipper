import { NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase'
import { computeAvailableSlots, getUtcDayRange } from '@/lib/slots'
import { checkSubscriptionAccess } from '@/lib/subscription-access'
import type { Database } from '@/types/database'

export async function POST(req: Request) {
    const supabase = createServiceSupabaseClient()

    let body: {
        barber_id?: string
        service_id?: string
        service_ids?: string[]
        slot_start?: string
        customer_name?: string
        customer_phone?: string
        date?: string
        timezone_offset?: number
        razorpay_payment_id?: string
        razorpay_order_id?: string
        amount?: number
    }

    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { barber_id, service_id, service_ids, slot_start, customer_name, customer_phone, date, timezone_offset, razorpay_payment_id, razorpay_order_id, amount } = body

    if (!barber_id || !slot_start || !customer_name || !customer_phone || !date) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Resolve services (multi or single) and total duration
    let primaryServiceId: string | null = null
    let shopId: string | null = null
    let totalDuration = 0
    let resolvedServices: { id: string; shop_id: string; duration_minutes: number }[] = []
    if (service_ids && service_ids.length > 0) {
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

        // All services must be same shop
        shopId = (services as any[])[0].shop_id
        if ((services as any[]).some((s) => s.shop_id !== shopId)) {
            return NextResponse.json({ error: 'Services must belong to the same shop' }, { status: 400 })
        }

        resolvedServices = (services as any[]).map((s) => ({ id: s.id, shop_id: s.shop_id, duration_minutes: s.duration_minutes }))
        totalDuration = (services as any[]).reduce((sum, s) => sum + (s.duration_minutes || 0), 0)
        primaryServiceId = (services as any[])[0].id
    } else {
        // Fallback: single service_id path
        if (!service_id) {
            return NextResponse.json({ error: 'service_id or service_ids required' }, { status: 400 })
        }
        const { data: service, error: serviceError } = await supabase
            .from('services')
            .select('id, shop_id, duration_minutes, is_active, deleted_at')
            .eq('id', service_id)
            .maybeSingle()
        if (serviceError) {
            return NextResponse.json({ error: 'Failed to fetch service' }, { status: 500 })
        }
        if (!service || (service as any).deleted_at || (service as any).is_active === false) {
            return NextResponse.json({ error: 'Service not available' }, { status: 400 })
        }
        shopId = (service as any).shop_id
        totalDuration = (service as any).duration_minutes
        primaryServiceId = (service as any).id
        resolvedServices = [{ id: (service as any).id, shop_id: (service as any).shop_id, duration_minutes: (service as any).duration_minutes }]
    }

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

    // CRITICAL SECURITY: Check subscription access
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

    // Enforce booking window: today..+1 (UTC) and past-time restriction for today
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

    // Fetch same-day bookings for overlap check
    const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('start_time, end_time')
        .eq('barber_id', barber_id)
        .is('deleted_at', null)
        .in('status', ['confirmed', 'completed'])
        .gte('start_time', dayRange.start.toISOString())
        .lt('start_time', dayRange.end.toISOString())

    if (bookingsError) {
        return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
    }

    const slots = computeAvailableSlots({
        date,
        serviceDurationMinutes: totalDuration,
        workingHours: adjustedWorkingHours ?? null,
        bookings: bookings ?? [],
    })

    const selectedSlot = slots.find((s) => s.start === slot_start)
    if (!selectedSlot) {
        return NextResponse.json({ error: 'Selected slot is no longer available' }, { status: 400 })
    }

    // If the requested date is today (UTC), ensure slot_start is future
    const now = new Date()
    const isToday = dayRange.start.getUTCFullYear() === now.getUTCFullYear()
        && dayRange.start.getUTCMonth() === now.getUTCMonth()
        && dayRange.start.getUTCDate() === now.getUTCDate()
    if (isToday && new Date(selectedSlot.start) <= now) {
        return NextResponse.json({ error: 'Cannot book past time' }, { status: 400 })
    }

    // Insert booking + services atomically via RPC; DB enforces non-overlap
    const serviceIdsToLink = resolvedServices.map((s) => s.id)
    // @ts-expect-error - Supabase RPC typing is not inferred here
    const { data: bookingId, error: rpcError } = await supabase.rpc('book_booking', {
        p_shop_id: shopId!,
        p_barber_id: barber_id,
        p_service_ids: serviceIdsToLink,
        p_customer_name: customer_name,
        p_customer_phone: customer_phone,
        p_start_time: selectedSlot.start,
        p_end_time: selectedSlot.end,
        p_is_walk_in: false,
    })

    if (rpcError) {
        // Map exclusion violation to 409 Conflict
        const code = (rpcError as any).code
        if (code === '23P01') {
            return NextResponse.json({ error: 'Selected slot overlaps with another booking' }, { status: 409 })
        }
        return NextResponse.json({ error: rpcError.message }, { status: 400 })
    }

    if (!bookingId) {
        return NextResponse.json({ error: 'Booking not created' }, { status: 500 })
    }

    // Create payment record if payment details are provided
    if (razorpay_order_id && amount !== undefined) {
        const paymentInsert: Database['public']['Tables']['payments']['Insert'] = {
            booking_id: bookingId,
            razorpay_order_id: razorpay_order_id,
            razorpay_payment_id: razorpay_payment_id || null,
            amount: amount,
            status: razorpay_payment_id ? 'paid' : 'created'
        }
        
        const { error: paymentError } = await (supabase as any)
            .from('payments')
            .insert(paymentInsert)

        if (paymentError) {
            console.error('Failed to create payment record:', paymentError)
            // Note: Booking is already created, so we don't rollback
            // The payment webhook will handle updates if needed
        }
    }

    return NextResponse.json({ booking_id: bookingId })
}
