import { NextResponse, NextRequest } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase'
import { computeAvailableSlots, getUtcDayRange } from '@/lib/slots'
import { requireAuth } from '@/lib/auth'

export async function POST(req: NextRequest) {
    try {
        // Require authentication for walk-in creation (admin/shop owner only)
        const user = await requireAuth()
        const supabase = createServiceSupabaseClient()

        let body: {
            barber_id?: string
            service_ids?: string[]
            customer_name?: string
            customer_phone?: string
            timezone_offset?: number
        }

        try {
            body = await req.json()
        } catch {
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
        }

        const { barber_id, service_ids, customer_name, customer_phone, timezone_offset } = body

        if (!barber_id || !service_ids || service_ids.length === 0) {
            return NextResponse.json({ error: 'Missing required fields: barber_id, service_ids' }, { status: 400 })
        }

        // Resolve services and total duration
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

        if (services.some((s: any) => s.deleted_at || s.is_active === false)) {
            return NextResponse.json({ error: 'Some services are inactive' }, { status: 400 })
        }

        // All services must be from the same shop
        const shopId = (services[0] as any).shop_id
        if (services.some((s: any) => s.shop_id !== shopId)) {
            return NextResponse.json({ error: 'Services must belong to the same shop' }, { status: 400 })
        }

        // Verify user owns this shop
        const { data: shop, error: shopError } = await supabase
            .from('shops')
            .select('id, owner_id')
            .eq('id', shopId)
            .is('deleted_at', null)
            .maybeSingle()

        if (shopError) {
            return NextResponse.json({ error: 'Failed to verify shop' }, { status: 500 })
        }

        if (!shop || (shop as any).owner_id !== user.id) {
            return NextResponse.json({ error: 'Unauthorized: you do not own this shop' }, { status: 403 })
        }

        const totalDuration = (services as any[]).reduce((sum, s) => sum + (s.duration_minutes || 0), 0)

        // Validate barber belongs to shop and is active
        const { data: barber, error: barberError } = await supabase
            .from('barbers')
            .select('id, shop_id, is_active, deleted_at')
            .eq('id', barber_id)
            .maybeSingle()

        if (barberError) {
            return NextResponse.json({ error: 'Failed to fetch barber' }, { status: 500 })
        }

        if (!barber || (barber as any).deleted_at || (barber as any).is_active === false || (barber as any).shop_id !== shopId) {
            return NextResponse.json({ error: 'Barber not available' }, { status: 400 })
        }

        // Use today's date (UTC) for walk-in
        const todayUtc = new Date(Date.UTC(
            new Date().getUTCFullYear(),
            new Date().getUTCMonth(),
            new Date().getUTCDate()
        ))
        const dateStr = todayUtc.toISOString().slice(0, 10)
        const dayRange = getUtcDayRange(dateStr)

        // Fetch working hours for today
        const { data: workingHours, error: hoursError } = await supabase
            .from('working_hours')
            .select('open_time, close_time, is_closed, day_of_week')
            .eq('shop_id', shopId)
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

        // Compute available slots
        const slots = computeAvailableSlots({
            date: dateStr,
            serviceDurationMinutes: totalDuration,
            workingHours: adjustedWorkingHours ?? null,
            bookings: bookings ?? [],
        })

        if (slots.length === 0) {
            return NextResponse.json({ error: 'No available slots for walk-in today' }, { status: 409 })
        }

        // Auto-select the first (soonest) available slot
        // For today, also filter out past slots
        const now = new Date()
        const futureSlots = slots.filter((s) => new Date(s.start) > now)
        const autoSelectedSlot = futureSlots.length > 0 ? futureSlots[0] : slots[0]

        // Ensure we can use the slot (it should be in future or acceptable for walk-in)
        if (new Date(autoSelectedSlot.start) <= now) {
            // If no future slots, try to use the closest future one or fail
            if (futureSlots.length === 0) {
                return NextResponse.json({ error: 'No available future slots for walk-in today' }, { status: 409 })
            }
        }

        // Default customer_name to "Walk In" if not provided
        const finalCustomerName = customer_name?.trim() || 'Walk In'
        const finalCustomerPhone = customer_phone?.trim() || null

        // Insert booking via RPC with is_walk_in=true
        const serviceIdsToLink = (services as any[]).map((s) => s.id)
        // @ts-expect-error - Supabase RPC typing is not inferred here
        const { data: bookingId, error: rpcError } = await supabase.rpc('book_booking', {
            p_shop_id: shopId,
            p_barber_id: barber_id,
            p_service_ids: serviceIdsToLink,
            p_customer_name: finalCustomerName,
            p_customer_phone: finalCustomerPhone,
            p_start_time: autoSelectedSlot.start,
            p_end_time: autoSelectedSlot.end,
            p_is_walk_in: true,
        })

        if (rpcError) {
            // Map exclusion violation to 409 Conflict
            const code = (rpcError as any).code
            if (code === '23P01') {
                return NextResponse.json(
                    { error: 'Selected slot overlaps with another booking' },
                    { status: 409 }
                )
            }
            return NextResponse.json({ error: rpcError.message }, { status: 400 })
        }

        if (!bookingId) {
            return NextResponse.json({ error: 'Walk-in booking not created' }, { status: 500 })
        }

        return NextResponse.json({
            booking_id: bookingId,
            customer_name: finalCustomerName,
            customer_phone: finalCustomerPhone,
            slot_start: autoSelectedSlot.start,
            slot_end: autoSelectedSlot.end,
            barber_id,
            service_ids: serviceIdsToLink,
        })
    } catch (error: any) {
        console.error('Walk-in creation error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
