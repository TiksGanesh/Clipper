import { createServerSupabaseClient } from '@/lib/supabase'
import { fetchBarberBookings } from '@/lib/bookings'

type DayBooking = {
    id: string
    start_time: string
    end_time: string
    service_name: string
    customer_name: string
    status: 'confirmed' | 'completed' | 'canceled' | 'no_show'
    is_walk_in: boolean
}

type WeekPayload = {
    bookings: DayBooking[]
    weekStart: string
    weekEnd: string
}

export async function GET(request: Request): Promise<Response> {
    const { searchParams } = new URL(request.url)
    const barberId = searchParams.get('barber_id')
    const dateStr = searchParams.get('date')

    if (!barberId || !dateStr) {
        return Response.json({ error: 'Missing barber_id or date' }, { status: 400 })
    }

    try {
        const supabase = await createServerSupabaseClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: shop } = await supabase
            .from('shops')
            .select('id')
            .eq('owner_id', user.id)
            .is('deleted_at', null)
            .maybeSingle<{ id: string }>()

        if (!shop) {
            return Response.json({ error: 'Shop not found' }, { status: 404 })
        }

        // Validate barber exists and belongs to shop
        const { data: barber } = await supabase
            .from('barbers')
            .select('id')
            .eq('id', barberId)
            .eq('shop_id', shop.id)
            .is('deleted_at', null)
            .maybeSingle()

        if (!barber) {
            return Response.json({ error: 'Barber not found' }, { status: 404 })
        }

        // Get week range (Mon-Sun)
        const dateObj = new Date(dateStr + 'T00:00:00Z')
        const dayOfWeek = dateObj.getUTCDay()
        const monday = new Date(dateObj)
        monday.setUTCDate(dateObj.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))

        const weekStart = monday.toISOString().split('T')[0]
        const weekEnd = new Date(monday)
        weekEnd.setUTCDate(monday.getUTCDate() + 6)
        const weekEndStr = weekEnd.toISOString().split('T')[0]

        // Fetch bookings for the entire week
        const bookings = await fetchBarberBookings({
            barberId,
            view: 'week',
            date: weekStart,
            endDate: weekEndStr,
            shopId: shop.id,
        })

        const payload: WeekPayload = {
            bookings: bookings as DayBooking[],
            weekStart,
            weekEnd: weekEndStr,
        }

        return Response.json(payload)
    } catch (err: any) {
        return Response.json({ error: err.message || 'Internal server error' }, { status: 500 })
    }
}
