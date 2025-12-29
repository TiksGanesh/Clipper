import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { fetchBarberBookings } from '@/lib/bookings'
import { getUtcDayRange } from '@/lib/slots'

export async function GET(req: Request) {
    const url = new URL(req.url)
    const barberId = url.searchParams.get('barber_id')
    const date = url.searchParams.get('date')

    if (!barberId || !date) {
        return NextResponse.json({ error: 'barber_id and date are required' }, { status: 400 })
    }

    let dayOfWeek: number
    try {
        const range = getUtcDayRange(date)
        dayOfWeek = range.start.getUTCDay()
    } catch {
        return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()

    const { data: barber, error: barberError } = await supabase
        .from('barbers')
        .select('id, shop_id, is_active, deleted_at')
        .eq('id', barberId)
        .maybeSingle()

    if (barberError) {
        return NextResponse.json({ error: 'Failed to load barber' }, { status: 500 })
    }

    if (!barber || (barber as any).deleted_at || (barber as any).is_active === false) {
        return NextResponse.json({ error: 'Barber not available' }, { status: 404 })
    }

    const shopId = (barber as any).shop_id as string

    const { data: workingHours, error: hoursError } = await supabase
        .from('working_hours')
        .select('open_time, close_time, is_closed, day_of_week')
        .eq('shop_id', shopId)
        .eq('day_of_week', dayOfWeek)
        .maybeSingle()

    if (hoursError) {
        return NextResponse.json({ error: 'Failed to fetch working hours' }, { status: 500 })
    }

    try {
        const bookings = await fetchBarberBookings({ barberId, view: 'day', date, shopId })
        return NextResponse.json({ working_hours: workingHours ?? null, bookings })
    } catch (err: any) {
        console.error('[calendar/day] Booking fetch failed:', err.message)
        // Return working hours even if bookings fetch fails (graceful degradation)
        if (err.message?.includes('fetch') || err.message?.includes('bookings')) {
            return NextResponse.json({ working_hours: workingHours ?? null, bookings: [] })
        }
        return NextResponse.json({ error: err.message || 'Failed to fetch bookings' }, { status: 500 })
    }
}
