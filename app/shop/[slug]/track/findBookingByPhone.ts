'use server'

import { createServiceSupabaseClient } from '@/lib/supabase'
import { getUtcDayRange } from '@/lib/slots'

type FindBookingResult =
    | { success: true; bookingId: string }
    | { success: false; message: string }

interface FindBookingByPhoneInput {
    shopSlug?: string
    phoneNumber: string
}

export async function findBookingByPhone({ shopSlug, phoneNumber }: FindBookingByPhoneInput): Promise<FindBookingResult> {
    const cleanedPhone = (phoneNumber || '').replace(/\D/g, '')

    if (!shopSlug) {
        return { success: false, message: 'Shop not found.' }
    }

    if (!cleanedPhone) {
        return { success: false, message: 'Please enter a phone number.' }
    }

    const supabase = createServiceSupabaseClient()

    // Resolve shop ID from slug
    const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('id')
        .eq('slug', shopSlug)
        .maybeSingle<{ id: string }>()

    if (shopError) {
        console.error('findBookingByPhone: shop lookup failed', { shopSlug, shopError })
        return { success: false, message: 'Unable to find shop.' }
    }

    if (!shop) {
        return { success: false, message: 'Shop not found.' }
    }

    const today = new Date().toISOString().split('T')[0]
    const { start, end } = getUtcDayRange(today)

    const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('id, deleted_at, status, start_time')
        .eq('shop_id', shop.id)
        .eq('customer_phone', cleanedPhone)
        .in('status', ['confirmed', 'seated'])
        .is('deleted_at', null)
        .gte('start_time', start.toISOString())
        .lt('start_time', end.toISOString())
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle<{ id: string; deleted_at: string | null; status: string; start_time: string }>()

    if (bookingError) {
        console.error('findBookingByPhone: booking lookup failed', { shopSlug, bookingError })
        return { success: false, message: 'Unable to find booking. Please try again.' }
    }

    if (!booking) {
        return { success: false, message: 'No active booking found for today.' }
    }

    return { success: true, bookingId: booking.id }
}
