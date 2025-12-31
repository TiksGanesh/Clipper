'use server'

import { createServerSupabaseClient } from '@/lib/supabase'
import { getUtcDayRange } from '@/lib/slots'
import type { Database } from '@/types/database'

type BookingStatus = Database['public']['Tables']['bookings']['Row']['status']

export type BarberCalendarBooking = {
    id: string
    start_time: string
    end_time: string
    service_name: string
    customer_name: string
    customer_phone?: string
    status: BookingStatus
    is_walk_in: boolean
}

type ViewMode = 'day' | 'week'

type FetchParams = {
    barberId: string
    view: ViewMode
    date: string // ISO date (YYYY-MM-DD) for day view and week start
    endDate?: string // ISO date (YYYY-MM-DD) inclusive end for week view; defaults to +7 days from start
    shopId?: string // Optional: reinforce multi-tenant scoping alongside RLS
}

function resolveRange(view: ViewMode, date: string, endDate?: string) {
    if (view === 'day') {
        return getUtcDayRange(date)
    }

    const { start } = getUtcDayRange(date)
    let end: Date

    if (endDate) {
        const resolvedEnd = getUtcDayRange(endDate).end
        end = resolvedEnd
    } else {
        const plusSeven = new Date(start)
        plusSeven.setUTCDate(plusSeven.getUTCDate() + 7)
        end = plusSeven
    }

    return { start, end }
}

/**
 * Fetch bookings for a barber within a day (day view) or a date range (week view).
 * The range is [start, end) in UTC to align with stored timestamps.
 */
export async function fetchBarberBookings(params: FetchParams): Promise<BarberCalendarBooking[]> {
    const { barberId, view, date, endDate, shopId } = params
    const range = resolveRange(view, date, endDate)

    const supabase = await createServerSupabaseClient()

    let query = supabase
        .from('bookings')
        .select(
            'id, start_time, end_time, status, customer_name, customer_phone, is_walk_in, services!inner ( name )'
        )
        .eq('barber_id', barberId)
        .is('deleted_at', null)
        .is('services.deleted_at', null)
        .gte('start_time', range.start.toISOString())
        .lt('start_time', range.end.toISOString())
        .order('start_time', { ascending: true })

    if (shopId) {
        query = query.eq('shop_id', shopId)
    }

    const { data, error } = await query

    if (error) {
        throw new Error(`Failed to fetch bookings: ${error.message}`)
    }

    return (data as any ?? []).map((booking: any) => ({
        id: booking.id,
        start_time: booking.start_time,
        end_time: booking.end_time,
        status: booking.status as BookingStatus,
        customer_name: booking.customer_name,
        customer_phone: booking.customer_phone,
        is_walk_in: booking.is_walk_in,
        service_name: booking.services?.name ?? 'Unknown service',
    }))
}
