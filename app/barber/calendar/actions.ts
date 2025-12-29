'use server'

import { requireAuth } from '@/lib/auth'
import { createServerActionClient } from '@/lib/supabase'
import type { Database } from '@/types/database'

type BookingStatus = Database['public']['Enums']['booking_status']
const TARGETS: BookingStatus[] = ['completed', 'no_show', 'canceled']

function assertValidTarget(status: BookingStatus) {
    if (!TARGETS.includes(status)) {
        throw new Error('Unsupported status update')
    }
}

function ensureTransitionAllowed(current: BookingStatus, next: BookingStatus) {
    if (current === next) return
    if (current === 'completed') {
        throw new Error('Completed bookings are read-only')
    }
    if (current === 'canceled') {
        throw new Error('Canceled bookings cannot be changed')
    }
    // Allow transitions from confirmed/no_show to completed/no_show/canceled
    return
}

async function updateStatus({ bookingId, status }: { bookingId: string; status: BookingStatus }) {
    assertValidTarget(status)

    const user = await requireAuth()
    const supabase = await createServerActionClient()

    const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .maybeSingle<{ id: string }>()

    if (shopError) {
        throw new Error('Failed to load shop')
    }
    if (!shop?.id) {
        throw new Error('Shop not found')
    }

    const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('id, shop_id, status')
        .eq('id', bookingId)
        .maybeSingle<{ id: string; shop_id: string; status: BookingStatus }>()

    if (bookingError) {
        throw new Error('Failed to load booking')
    }
    if (!booking || booking.shop_id !== shop.id) {
        throw new Error('Not authorized to update this booking')
    }

    ensureTransitionAllowed(booking.status, status)

    const { error: updateError } = await supabase
        .from('bookings')
        // @ts-expect-error supabase types narrowed
        .update({ status })
        .eq('id', bookingId)

    if (updateError) {
        throw new Error(updateError.message)
    }

    return { ok: true }
}

export async function markBookingCompletedAction(input: { bookingId: string }) {
    return updateStatus({ bookingId: input.bookingId, status: 'completed' })
}

export async function markBookingNoShowAction(input: { bookingId: string }) {
    return updateStatus({ bookingId: input.bookingId, status: 'no_show' })
}

export async function cancelBookingAction(input: { bookingId: string }) {
    return updateStatus({ bookingId: input.bookingId, status: 'canceled' })
}

// Backward-compatible single entry point
export async function updateBookingStatusAction(input: { bookingId: string; status: BookingStatus }) {
    return updateStatus(input)
}
