import { NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase'
import { isShopClosed } from '@/lib/shop-closure'
import { checkSubscriptionAccess } from '@/lib/subscription-access'

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'
// Ensure Node.js runtime on Vercel for Supabase server client compatibility
export const runtime = 'nodejs'

// Parse time string (HH:MM:SS or HH:MM) to minutes since midnight
function timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number)
    return (hours || 0) * 60 + (minutes || 0)
}

// Convert a local date+time (based on client timezone offset minutes) to true UTC Date
// Example: IST offset -330, local 13:00 -> UTC 07:30
function createDateFromLocal(dateStr: string, timeStr: string, offsetMinutes: number): Date {
    const localIso = `${dateStr}T${timeStr}`
    const utcAssumed = new Date(localIso + 'Z')
    return new Date(utcAssumed.getTime() + (offsetMinutes * 60000))
}

// Check if a slot time falls within lunch break
// Inclusive of start, exclusive of end (1:00 PM blocked, 2:00 PM allowed)
function isInLunchBreak(slotMinutes: number, lunchStartMinutes: number, lunchEndMinutes: number): boolean {
    return slotMinutes >= lunchStartMinutes && slotMinutes < lunchEndMinutes
}

// Compute day of week (0=Sunday..6=Saturday) from YYYY-MM-DD without timezone dependence
function dayOfWeekFromDate(dateStr: string): number {
    const [yStr, mStr, dStr] = dateStr.split('-')
    let y = Number(yStr)
    let m = Number(mStr)
    const d = Number(dStr)
    // Zeller/Sakamoto adjustment: treat Jan/Feb as months 13/14 of previous year
    if (m < 3) {
        m += 12
        y -= 1
    }
    const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4]
    // Sakamoto's algorithm returns 0=Sunday..6=Saturday
    return (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + t[(m - 1) % 12] + d) % 7
}

export async function GET(req: Request) {
    const supabase = createServiceSupabaseClient()

    const url = new URL(req.url)
    const barberId = url.searchParams.get('barber_id')
    const date = url.searchParams.get('date') // YYYY-MM-DD format
    const serviceIdsParam = url.searchParams.get('service_ids')
    const serviceDurationParam = url.searchParams.get('service_duration')

    if (!barberId || !date) {
        return NextResponse.json({ error: 'Missing or invalid parameters' }, { status: 400 })
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(date)) {
        return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    // Enforce booking window using client's timezone (today or tomorrow only)
    const timezoneOffsetParam = url.searchParams.get('timezone_offset') ?? '0'
    let tzOffsetMinutes = Number.parseInt(timezoneOffsetParam, 10)
    if (!Number.isFinite(tzOffsetMinutes)) tzOffsetMinutes = 0

    // Note: timezone_offset is negative for zones ahead of UTC (e.g., IST is -330)
    // We subtract it to add the hours to UTC and get client's local time
    const clientNow = new Date(Date.now() - tzOffsetMinutes * 60 * 1000)

    const clientToday = clientNow.toISOString().split('T')[0]
    const clientTomorrowObj = new Date(clientNow)
    clientTomorrowObj.setDate(clientTomorrowObj.getDate() + 1)
    const clientTomorrow = clientTomorrowObj.toISOString().split('T')[0]

    if (date !== clientToday && date !== clientTomorrow) {
        return NextResponse.json({ error: 'Date outside allowed window (today or tomorrow only)' }, { status: 400 })
    }

    // Fetch barber details
    const { data: barber, error: barberError } = await supabase
        .from('barbers')
        .select('id, shop_id, is_active, deleted_at')
        .eq('id', barberId)
        .maybeSingle()

    if (barberError) {
        return NextResponse.json({ error: 'Failed to fetch barber' }, { status: 500 })
    }

    if (!barber || (barber as any).deleted_at || (barber as any).is_active === false) {
        return NextResponse.json({ error: 'Barber not found or inactive' }, { status: 404 })
    }

    const shopId = (barber as any).shop_id

    // CRITICAL SECURITY: Check subscription access
    const accessCheck = await checkSubscriptionAccess(shopId)
    if (!accessCheck.allowed) {
        return NextResponse.json({ error: 'Shop subscription is not active' }, { status: 403 })
    }

    // === STEP A: Check if shop is globally closed on this date ===
    const { data: shopClosure, error: closureError } = await supabase
        .from('shop_closures')
        .select('closed_from, closed_to')
        .eq('shop_id', shopId)
        .is('deleted_at', null)
        .maybeSingle()

    if (!closureError && shopClosure) {
        if (isShopClosed(date, (shopClosure as any).closed_from, (shopClosure as any).closed_to)) {
            return NextResponse.json({ slots: [] }) // Shop is closed - return empty array
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
        const { data: barberData } = await supabase
            .from('barbers')
            .select('name')
            .eq('id', barberId)
            .single()
        
        const barberName = (barberData as any)?.name || 'This barber'
        return NextResponse.json({ error: `${barberName} is on leave today. Please select another date or barber.` }, { status: 400 })
    }

    // === STEP B: Fetch shop configuration and working hours ===
    const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('id, lunch_start, lunch_end')
        .eq('id', shopId)
        .single()

    if (shopError) {
        return NextResponse.json({ error: 'Failed to fetch shop details' }, { status: 500 })
    }

    // Get day of week (0 = Sunday, 6 = Saturday) without timezone dependence
    const dayOfWeek = dayOfWeekFromDate(date)

    const { data: workingHours, error: hoursError } = await supabase
        .from('working_hours')
        .select('open_time, close_time, is_closed, day_of_week')
        .eq('shop_id', shopId)
        .eq('day_of_week', dayOfWeek)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (hoursError) {
        return NextResponse.json({ error: 'Failed to fetch working hours' }, { status: 500 })
    }

    // Return empty if shop is closed on this day or hours not configured
    if (!workingHours || (workingHours as any).is_closed || !(workingHours as any).open_time || !(workingHours as any).close_time) {
        return NextResponse.json({ slots: [] })
    }

    const openTime = (workingHours as any).open_time // e.g., "09:00:00"
    const closeTime = (workingHours as any).close_time // e.g., "18:00:00"
    const lunchStart = (shop as any).lunch_start // e.g., "13:00:00" or null
    const lunchEnd = (shop as any).lunch_end // e.g., "14:00:00" or null

    const slotDuration = 15 // 15-minute intervals

    // Compute UTC boundaries for the shop's local open/close times
    const shopOpenUTC = createDateFromLocal(date, openTime, tzOffsetMinutes)
    const shopCloseUTC = createDateFromLocal(date, closeTime, tzOffsetMinutes)

    // Determine total service duration
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

        if ((services as any[]).some((s) => s.deleted_at || s.is_active === false || s.shop_id !== shopId)) {
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

    // Fetch existing bookings for this barber on this local date (convert to UTC)
    const dayStart = createDateFromLocal(date, '00:00:00', tzOffsetMinutes)
    const dayEnd = createDateFromLocal(date, '23:59:59', tzOffsetMinutes)

    // Fetch confirmed/completed bookings AND non-expired pending_payment holds
    const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('start_time, end_time, status, expires_at')
        .eq('barber_id', barberId)
        .is('deleted_at', null)
        .gte('start_time', dayStart.toISOString())
        .lte('start_time', dayEnd.toISOString())

    if (bookingsError) {
        return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
    }

    // Filter to include only confirmed/completed and non-expired pending_payment bookings
    const validBookings = (bookings ?? []).filter((booking: any) => {
        const status = booking.status
        // Include confirmed and completed bookings
        if (status === 'confirmed' || status === 'completed') {
            return true
        }
        // Include pending_payment bookings only if not expired
        if (status === 'pending_payment' && booking.expires_at) {
            const expiresAt = new Date(booking.expires_at)
            return expiresAt > new Date()
        }
        return false
    })

    // === STEP C & D: Generate and filter slots ===
    const validSlots: Array<{ start: string; end: string }> = []
    const now = new Date()

    // Parse lunch break window in UTC if available
    const lunchStartUTC = lunchStart ? createDateFromLocal(date, lunchStart, tzOffsetMinutes) : null
    const lunchEndUTC = lunchEnd ? createDateFromLocal(date, lunchEnd, tzOffsetMinutes) : null

    const debug = url.searchParams.get('debug') === '1'

    for (
        let slotStart = new Date(shopOpenUTC.getTime());
        slotStart.getTime() + totalDuration * 60000 <= shopCloseUTC.getTime();
        slotStart = new Date(slotStart.getTime() + slotDuration * 60000)
    ) {
        // === FILTER 1: Lunch Break (UTC window) ===
        if (lunchStartUTC && lunchEndUTC) {
            if (slotStart >= lunchStartUTC && slotStart < lunchEndUTC) {
                continue // Skip this slot inside lunch
            }
        }

        // === FILTER 2: Past Time Check (UTC) ===
        const slotTimestamp = slotStart
        
        // If slot is in the past, skip it
        if (slotTimestamp < now) {
            continue
        }

        // Calculate end time for this slot
        const slotEndTimestamp = new Date(slotStart.getTime() + totalDuration * 60000)

        // === FILTER 3: Existing Bookings Check ===
        const hasConflict = validBookings?.some((booking) => {
            const bookingStart = new Date((booking as any).start_time)
            const bookingEnd = new Date((booking as any).end_time)
            
            // Check if there's any overlap
            return slotTimestamp < bookingEnd && slotEndTimestamp > bookingStart
        }) ?? false

        if (hasConflict) {
            continue // Skip slots that overlap with existing bookings
        }

        // If we reached here, the slot is valid
        validSlots.push({
            start: slotTimestamp.toISOString(),
            end: slotEndTimestamp.toISOString()
        })
    }

    if (debug) {
        return NextResponse.json({
            slots: validSlots,
            meta: {
                requestedDate: date,
                dayOfWeek,
                openTime,
                closeTime,
                lunchStart,
                lunchEnd,
                timezoneOffset: tzOffsetMinutes,
                shopOpenUTC: shopOpenUTC.toISOString(),
                shopCloseUTC: shopCloseUTC.toISOString(),
                firstSlotUTC: validSlots[0]?.start ?? null,
                lastSlotUTC: validSlots[validSlots.length - 1]?.end ?? null
            }
        })
    }

    return NextResponse.json({ slots: validSlots })
}
