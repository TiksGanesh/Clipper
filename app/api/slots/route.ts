import { NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase'
import { computeAvailableSlots, getUtcDayRange } from '@/lib/slots'
import { isShopClosed } from '@/lib/shop-closure'
import { checkSubscriptionAccess } from '@/lib/subscription-access'

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'

// Helper to convert minutes since midnight to HH:MM:SS format
function minutesToTimeString(minutes: number): string {
    const totalMinutes = ((minutes % 1440) + 1440) % 1440 // Normalize to 0-1439
    const hours = Math.floor(totalMinutes / 60)
    const mins = totalMinutes % 60
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`
}

export async function GET(req: Request) {
    const supabase = createServiceSupabaseClient()

    const url = new URL(req.url)
    const barberId = url.searchParams.get('barber_id')
    const date = url.searchParams.get('date')
    const serviceIdsParam = url.searchParams.get('service_ids')
    const serviceDurationParam = url.searchParams.get('service_duration')
    const timezoneOffsetStr = url.searchParams.get('timezone_offset')

    if (!barberId || !date) {
        return NextResponse.json({ error: 'Missing or invalid parameters' }, { status: 400 })
    }

    // Parse timezone offset (minutes, negative for ahead of UTC)
    const timezoneOffsetMinutes = timezoneOffsetStr ? parseInt(timezoneOffsetStr, 10) : 0

    let dayRange: ReturnType<typeof getUtcDayRange>
    try {
        dayRange = getUtcDayRange(date)
    } catch {
        return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
    }

    // Enforce booking window: only today and +1 day (UTC, minimal approach)
    const todayUtc = new Date()
    const yyyyMmDdToday = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate()))
    const yyyyMmDdPlus1 = new Date(yyyyMmDdToday)
    yyyyMmDdPlus1.setUTCDate(yyyyMmDdPlus1.getUTCDate() + 1)
    const dateDay = dayRange.start
    if (dateDay < yyyyMmDdToday || dateDay > yyyyMmDdPlus1) {
        return NextResponse.json({ error: 'Date outside allowed window' }, { status: 400 })
    }

    const { data: barber, error: barberError } = await supabase
        .from('barbers')
        .select('id, shop_id, is_active, deleted_at')
        .eq('id', barberId)
        .maybeSingle()

    if (barberError) {
        return NextResponse.json({ error: 'Failed to fetch barber' }, { status: 500 })
    }

    if (!barber || (barber as any).deleted_at || (barber as any).is_active === false) {
        return NextResponse.json({ error: 'Barber not found' }, { status: 404 })
    }

    // CRITICAL SECURITY: Check subscription access
    const shopId = (barber as any).shop_id
    const accessCheck = await checkSubscriptionAccess(shopId)
    if (!accessCheck.allowed) {
        return NextResponse.json({ error: 'Shop subscription is not active' }, { status: 403 })
    }

    // Check if shop is closed on this date
    const { data: shopClosure, error: closureError } = await supabase
        .from('shop_closures')
        .select('closed_from, closed_to')
        .eq('shop_id', (barber as any).shop_id)
        .is('deleted_at', null)
        .maybeSingle()

    if (!closureError && shopClosure) {
        const dateStr = date // date is in YYYY-MM-DD format
        if (isShopClosed(dateStr, (shopClosure as any).closed_from, (shopClosure as any).closed_to)) {
            return NextResponse.json({ error: 'Shop is closed on this date' }, { status: 400 })
        }
    }

    // Check if barber is on leave on this date
    const { data: barberLeave, error: leaveError } = await supabase
        .from('barber_leaves')
        .select('id, barber_id')
        .eq('barber_id', barberId)
        .eq('leave_date', date)
        .maybeSingle()

    if (!leaveError && barberLeave) {
        // Get barber name for error message
        const { data: barberData } = await supabase
            .from('barbers')
            .select('name')
            .eq('id', barberId)
            .single() as { data: { name: string } | null }
        
        const barberName = barberData?.name || 'This barber'
        return NextResponse.json({ error: `${barberName} is on leave today. Please select another date or barber.` }, { status: 400 })
    }

    const { data: workingHours, error: hoursError } = await supabase
        .from('working_hours')
        .select('open_time, close_time, is_closed, day_of_week')
        .eq('shop_id', (barber as any).shop_id)
        .eq('day_of_week', dayRange.start.getUTCDay())
        .maybeSingle()

    if (hoursError) {
        return NextResponse.json({ error: 'Failed to fetch working hours' }, { status: 500 })
    }

    // Validate working hours are set
    if (!workingHours || (workingHours as any).is_closed || !(workingHours as any).open_time || !(workingHours as any).close_time) {
        return NextResponse.json({ error: 'Shop is closed on this day or hours not set' }, { status: 400 })
    }

    // Convert working hours from local time (as stored in DB) to UTC using timezone offset
    // Working hours in DB are simple TIME values (e.g., "07:00:00") which represent local time
    // To get UTC times, we add the timezone offset (which is negative for ahead of UTC)
    const parseTimeToMinutes = (timeStr: string) => {
        const [h, m] = timeStr.split(':').map(Number)
        return h * 60 + m
    }

    const localOpenMinutes = parseTimeToMinutes((workingHours as any).open_time)
    const localCloseMinutes = parseTimeToMinutes((workingHours as any).close_time)

    // Convert from local to UTC by adding the timezone offset
    // (offset is negative for timezones ahead of UTC, positive for behind)
    const utcOpenMinutes = localOpenMinutes + timezoneOffsetMinutes
    const utcCloseMinutes = localCloseMinutes + timezoneOffsetMinutes

    // Determine total duration either from service_ids or fallback to service_duration
    let totalDuration = 0
    if (serviceIdsParam) {
        const serviceIds = serviceIdsParam.split(',').map((s) => s.trim()).filter(Boolean)
        if (serviceIds.length === 0) {
            return NextResponse.json({ error: 'No services provided' }, { status: 400 })
        }
        const { data: services, error: servicesError } = await supabase
            .from('services')
            .select('id, shop_id, duration_minutes, is_active, deleted_at')
            .in('id', serviceIds)
        if (servicesError) {
            return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 })
        }
        if (!services || services.length !== serviceIds.length) {
            return NextResponse.json({ error: 'Some services not found' }, { status: 400 })
        }
        if ((services as any[]).some((s) => s.deleted_at || s.is_active === false || s.shop_id !== (barber as any).shop_id)) {
            return NextResponse.json({ error: 'Invalid services for this shop' }, { status: 400 })
        }
        totalDuration = (services as any[]).reduce((sum, s) => sum + (s.duration_minutes || 0), 0)
    } else {
        const serviceDuration = Number(serviceDurationParam)
        if (!Number.isFinite(serviceDuration) || serviceDuration <= 0) {
            return NextResponse.json({ error: 'Missing or invalid service duration' }, { status: 400 })
        }
        totalDuration = Math.floor(serviceDuration)
    }

    const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('start_time, end_time')
        .eq('barber_id', barberId)
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
        workingHours: workingHours ? { 
            ...(workingHours as any), 
            open_time: minutesToTimeString(utcOpenMinutes),
            close_time: minutesToTimeString(utcCloseMinutes)
        } : null,
        bookings: bookings ?? [],
    })

    // If the requested date is today (UTC), filter out slots that start before now
    const now = new Date()
    const isToday = dayRange.start.getUTCFullYear() === now.getUTCFullYear()
        && dayRange.start.getUTCMonth() === now.getUTCMonth()
        && dayRange.start.getUTCDate() === now.getUTCDate()
    const filtered = isToday ? slots.filter((s) => new Date(s.start) > now) : slots

    return NextResponse.json({ slots: filtered })
}
