import { NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase'
import { computeAvailableSlots, getUtcDayRange } from '@/lib/slots'
import { checkSubscriptionAccess } from '@/lib/subscription-access'
import type { Database } from '@/types/database'
import { z } from 'zod'

// Validation schema for booking creation
const bookingSchema = z.object({
    barber_id: z.string().uuid('Invalid barber ID'),
    service_id: z.string().uuid('Invalid service ID').optional(),
    service_ids: z.array(z.string().uuid('Invalid service ID')).min(1).max(20).optional(),
    slot_start: z.string().datetime('Invalid slot start time'),
    customer_name: z.string().trim().min(1, 'Name is required').max(100, 'Name too long'),
    customer_phone: z.string().regex(/^\d{10,15}$/, 'Phone must be 10-15 digits'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
    timezone_offset: z.number().int().min(-720).max(720).optional(),
    razorpay_payment_id: z.string().optional(),
    razorpay_order_id: z.string().optional(),
    amount: z.number().nonnegative().max(1000000).optional(),
    booking_id: z.string().uuid('Invalid booking ID').optional()
}).refine(data => data.service_id || (data.service_ids && data.service_ids.length > 0), {
    message: 'Either service_id or service_ids must be provided',
    path: ['service_id']
});

export async function POST(req: Request) {
    const supabase = createServiceSupabaseClient()

    // Debug: raw request body snapshot (safe fields only)
    try {
        const peek = await req.clone().json()
        console.log('[booking-api] incoming payload', {
            barber_id: peek?.barber_id,
            service_ids: peek?.service_ids,
            slot_start: peek?.slot_start,
            date: peek?.date,
            tz_offset: peek?.timezone_offset,
            payment_id: peek?.razorpay_payment_id,
            order_id: peek?.razorpay_order_id,
            amount: peek?.amount,
        })
    } catch (e) {
        console.warn('[booking-api] failed to read incoming payload for debug')
    }

    let body: z.infer<typeof bookingSchema>

    try {
        const rawBody = await req.json()
        const validation = bookingSchema.safeParse(rawBody)
        
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

    const { barber_id, service_id, service_ids, slot_start, customer_name, customer_phone, date, timezone_offset, razorpay_payment_id, razorpay_order_id, amount, booking_id } = body

    console.log('[booking-api] processing booking', {
        isUpdate: !!booking_id,
        bookingId: booking_id,
        barber_id,
        service_ids,
        slot_start,
    })

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

    // Fetch lunch break times for the shop (non-blocking - if fails, just skip lunch logic)
    const { data: shop } = await supabase
        .from('shops')
        .select('lunch_start, lunch_end')
        .eq('id', shopId!)
        .maybeSingle()

    // Fetch same-day bookings for overlap check
    // Include confirmed/completed bookings AND non-expired pending_payment holds
    // CRITICAL: Exclude the current booking_id to avoid self-collision
    let bookingsQuery = supabase
        .from('bookings')
        .select('start_time, end_time, status, expires_at')
        .eq('barber_id', barber_id)
        .is('deleted_at', null)
        .gte('start_time', dayRange.start.toISOString())
        .lt('start_time', dayRange.end.toISOString())

    // If we're confirming an existing booking, exclude it from conflict check
    if (booking_id) {
        console.log('[Conflict Check] Excluding self from conflict check:', booking_id)
        bookingsQuery = bookingsQuery.neq('id', booking_id)
    }

    const { data: bookings, error: bookingsError } = await bookingsQuery

    if (bookingsError) {
        console.error('[booking-api] fetch bookings error', bookingsError)
        return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
    }

    // Filter to include only confirmed/completed and valid non-expired pending_payment holds
    const nowTs = new Date()
    const validBookings = (bookings ?? []).filter((b: any) => {
        const status = (b.status || '').toLowerCase()
        if (status === 'confirmed' || status === 'completed') {
            return true
        }
        if (status === 'pending_payment') {
            // Include pending_payment only if not expired
            if (!b.expires_at) {
                // Defensive: missing expires_at means consider it active
                return true
            }
            const expiresAt = new Date(b.expires_at)
            return expiresAt > nowTs
        }
        return false
    })

    // Create a fake booking for lunch break to exclude lunch time from available slots
    let lunchBreakBooking: { start_time: string; end_time: string } | null = null
    if (shop && (shop as any).lunch_start && (shop as any).lunch_end) {
        const lunchStartMinutes = timeToMinutes((shop as any).lunch_start)
        const lunchEndMinutes = timeToMinutes((shop as any).lunch_end)
        const lunchStart = new Date(dayRange.start)
        lunchStart.setUTCMinutes(lunchStart.getUTCMinutes() + lunchStartMinutes)
        const lunchEnd = new Date(dayRange.start)
        lunchEnd.setUTCMinutes(lunchEnd.getUTCMinutes() + lunchEndMinutes)
        lunchBreakBooking = {
            start_time: lunchStart.toISOString(),
            end_time: lunchEnd.toISOString()
        }
    }

    // Combine real bookings with lunch break
    const allBookings = lunchBreakBooking ? [...validBookings, lunchBreakBooking] : validBookings

    const slots = computeAvailableSlots({
        date,
        serviceDurationMinutes: totalDuration,
        workingHours: adjustedWorkingHours ?? null,
        bookings: allBookings,
    })

    const selectedSlot = slots.find((s) => s.start === slot_start)

    console.log('[booking-api] slot check', {
        requested: slot_start,
        availableCount: slots.length,
        matched: !!selectedSlot,
        dayRangeStart: dayRange.start.toISOString(),
        dayRangeEnd: dayRange.end.toISOString(),
        tz_offset: timezone_offset,
    })
    if (!selectedSlot) {
        return NextResponse.json({ error: 'Selected slot is no longer available' }, { status: 400 })
    }

    // If the requested date is today (user's local tz), ensure slot_start is in the future
    const nowUtc = new Date()
    const offsetMs = (timezone_offset || 0) * 60 * 1000
    const localNow = new Date(nowUtc.getTime() - offsetMs)
    const localSelected = new Date(new Date(selectedSlot.start).getTime() - offsetMs)
    const isToday = dayRange.start.getUTCFullYear() === localNow.getUTCFullYear()
        && dayRange.start.getUTCMonth() === localNow.getUTCMonth()
        && dayRange.start.getUTCDate() === localNow.getUTCDate()
    // Add a small 2-minute grace to avoid race conditions around the current moment
    const graceMs = 2 * 60 * 1000
    const isPast = isToday && localSelected.getTime() <= (localNow.getTime() - graceMs)
    if (isPast) {
        console.log('[booking-api] past-time rejection', {
            slot: selectedSlot.start,
            localSelected,
            localNow,
            tz_offset: timezone_offset,
            graceMs,
        })
        return NextResponse.json({ error: 'Cannot book past time' }, { status: 400 })
    }

    // CRITICAL SECURITY FIX: If razorpay_order_id is provided, use it as the source of truth
    // to look up the booking_id. This prevents multi-tab collisions where frontend sends
    // an incorrect or stale booking_id.
    if (razorpay_order_id && razorpay_payment_id) {
        console.log('[booking-api] payment confirmation flow - looking up booking by order_id', {
            razorpay_order_id,
            razorpay_payment_id,
            frontendSuppliedBookingId: booking_id
        })

        // Step 1: Fetch the payment record using razorpay_order_id (trusted source from gateway)
        // Fallback to booking_id if order lookup fails
        let payment: any = null
        let paymentFetchError: any = null

        const { data: paymentByOrder, error: orderError } = await supabase
            .from('payments')
            .select('id, booking_id, status')
            .eq('razorpay_order_id', razorpay_order_id)
            .maybeSingle()

        if (orderError) {
            console.error('[booking-api] failed to fetch payment record by order_id', orderError)
            return NextResponse.json({ error: 'Failed to verify payment' }, { status: 500 })
        }

        if (paymentByOrder) {
            payment = paymentByOrder
            console.log('[booking-api] found payment by order_id', { bookingId: payment.booking_id })
        } else if (booking_id) {
            // Fallback: lookup by booking_id if provided
            console.log('[booking-api] payment not found by order_id, trying booking_id', { booking_id })
            const { data: paymentByBooking, error: bookingError } = await supabase
                .from('payments')
                .select('id, booking_id, status, razorpay_order_id')
                .eq('booking_id', booking_id)
                .maybeSingle()

            if (bookingError) {
                console.error('[booking-api] failed to fetch payment by booking_id', bookingError)
                return NextResponse.json({ error: 'Failed to verify payment' }, { status: 500 })
            }

            if (paymentByBooking) {
                payment = paymentByBooking
                console.log('[booking-api] found payment by booking_id', { 
                    bookingId: payment.booking_id,
                    storedOrderId: payment.razorpay_order_id,
                    providedOrderId: razorpay_order_id
                })
            }
        }

        if (!payment) {
            console.error('[booking-api] payment record not found', { 
                razorpay_order_id, 
                booking_id,
                triedOrder: true,
                triedBooking: !!booking_id
            })
            return NextResponse.json({ 
                error: 'Payment record not found. Please contact support.' 
            }, { status: 400 })
        }

        // Step 2: Handle idempotency - if payment is already confirmed, return success
        if ((payment as any).status === 'paid' || (payment as any).status === 'success') {
            console.log('[booking-api] payment already confirmed (idempotent)', {
                razorpay_order_id,
                bookingId: (payment as any).booking_id,
                status: (payment as any).status
            })
            return NextResponse.json({ 
                booking_id: (payment as any).booking_id,
                idempotent: true 
            }, { status: 200 })
        }

        // Step 3: Extract the authoritative booking_id from the payment record
        const trustedBookingId = (payment as any).booking_id
        console.log('[booking-api] resolved booking_id from payment record', {
            razorpay_order_id,
            bookingId: trustedBookingId,
            frontendClaimedId: booking_id,
            match: trustedBookingId === booking_id
        })

        // Step 4: Fetch the booking to validate it exists and is still in pending_payment state
        const { data: existingBooking, error: bookingFetchError } = await supabase
            .from('bookings')
            .select('id, status, expires_at')
            .eq('id', trustedBookingId)
            .maybeSingle()

        if (bookingFetchError) {
            console.error('[booking-api] failed to fetch booking record', bookingFetchError)
            return NextResponse.json({ error: 'Failed to fetch booking' }, { status: 500 })
        }

        if (!existingBooking) {
            console.error('[booking-api] booking not found (payment references non-existent booking)', {
                razorpay_order_id,
                bookingId: trustedBookingId
            })
            return NextResponse.json({ 
                error: 'Booking not found. Please contact support.' 
            }, { status: 400 })
        }

        // Step 5: Validate booking is still in pending_payment state
        if ((existingBooking as any).status !== 'pending_payment') {
            console.log('[booking-api] booking is not in pending_payment state', {
                bookingId: trustedBookingId,
                currentStatus: (existingBooking as any).status
            })
            return NextResponse.json({ 
                error: 'Booking is not awaiting payment confirmation' 
            }, { status: 400 })
        }

        // Step 6: Check if hold is still valid (not expired)
        const expiresAt = new Date((existingBooking as any).expires_at)
        if (expiresAt < new Date()) {
            console.log('[booking-api] booking hold has expired', {
                bookingId: trustedBookingId,
                expiresAt
            })
            return NextResponse.json({ 
                error: 'Booking hold has expired. Please book again.' 
            }, { status: 400 })
        }

        // Step 7: Update booking status to confirmed
        const { error: updateBookingError } = await (supabase as any)
            .from('bookings')
            .update({
                status: 'confirmed',
                customer_name: customer_name,
                customer_phone: customer_phone,
                updated_at: new Date().toISOString()
            })
            .eq('id', trustedBookingId)

        if (updateBookingError) {
            console.error('[booking-api] failed to update booking status', updateBookingError)
            return NextResponse.json({ error: 'Failed to confirm booking' }, { status: 500 })
        }

        console.log('[booking-api] booking status updated to confirmed', {
            bookingId: trustedBookingId,
            razorpay_order_id
        })

        // Step 8: Update payment record with payment details and status
        const { error: updatePaymentError } = await (supabase as any)
            .from('payments')
            .update({
                razorpay_payment_id: razorpay_payment_id,
                status: 'paid',
                updated_at: new Date().toISOString()
            })
            .eq('razorpay_order_id', razorpay_order_id)

        if (updatePaymentError) {
            console.error('[booking-api] failed to update payment record', updatePaymentError)
            // Non-fatal: Booking is already confirmed, payment details will be updated via webhook
        }

        console.log('[booking-api] payment confirmation successful', {
            bookingId: trustedBookingId,
            razorpay_order_id,
            razorpay_payment_id
        })

        return NextResponse.json({ booking_id: trustedBookingId })
    }

    // Legacy path: If booking_id is provided without payment (no payment flow)
    if (booking_id && !razorpay_order_id) {
        console.log('[booking-api] updating pending booking (no payment)', { booking_id })
        
        const { data: existingBooking, error: fetchError } = await supabase
            .from('bookings')
            .select('id, status, expires_at')
            .eq('id', booking_id)
            .maybeSingle()

        if (fetchError) {
            console.error('[booking-api] fetch pending booking error', fetchError)
            return NextResponse.json({ error: 'Failed to fetch booking' }, { status: 500 })
        }

        if (!existingBooking || (existingBooking as any).status !== 'pending_payment') {
            console.log('[booking-api] booking not found or not pending_payment', {
                found: !!existingBooking,
                status: (existingBooking as any)?.status
            })
            return NextResponse.json({ error: 'Booking hold not found or expired' }, { status: 400 })
        }

        // Check if hold is still valid
        const expiresAt = new Date((existingBooking as any).expires_at)
        if (expiresAt < new Date()) {
            console.log('[booking-api] booking hold expired', { expiresAt })
            return NextResponse.json({ error: 'Booking hold expired' }, { status: 400 })
        }

        // Update the pending booking to confirmed
        const { error: updateError } = await (supabase as any)
            .from('bookings')
            .update({
                status: 'confirmed',
                customer_name: customer_name,
                customer_phone: customer_phone,
                updated_at: new Date().toISOString()
            })
            .eq('id', booking_id)

        if (updateError) {
            console.error('[booking-api] update booking error', updateError)
            return NextResponse.json({ error: 'Failed to confirm booking' }, { status: 500 })
        }

        console.log('[booking-api] pending booking confirmed', { booking_id })

        return NextResponse.json({ booking_id: booking_id })
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
        console.log('[booking-api] creating payment record', {
            bookingId,
            razorpay_order_id,
            amount,
            has_payment_id: !!razorpay_payment_id
        })

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
            console.error('[booking-api] failed to create payment record:', {
                bookingId,
                razorpay_order_id,
                error: paymentError
            })
            // Note: Booking is already created, so we don't rollback
            // The payment webhook will handle updates if needed
        } else {
            console.log('[booking-api] payment record created successfully', {
                bookingId,
                razorpay_order_id
            })
        }
    }

    return NextResponse.json({ booking_id: bookingId })
}
