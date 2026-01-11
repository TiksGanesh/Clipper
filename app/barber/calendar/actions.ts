'use server'

import { requireAuth } from '@/lib/auth'
import { createServerActionClient } from '@/lib/supabase'
import type { Database } from '@/types/database'
import { checkSubscriptionAccess } from '@/lib/subscription-access'

type BookingStatus = Database['public']['Enums']['booking_status']
const TARGETS: BookingStatus[] = ['seated', 'completed', 'no_show', 'canceled']

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
    if (current === 'no_show') {
        throw new Error('No-show bookings cannot be changed')
    }
    // Allow transitions:
    // confirmed -> seated, completed, no_show, canceled
    // seated -> completed, canceled
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

    // Revalidate the dashboard to reflect status changes
    const { revalidatePath } = await import('next/cache')
    revalidatePath('/dashboard')
    revalidatePath('/barber/calendar')

    return { ok: true }
}

export async function seatCustomerAction(input: { bookingId: string }) {
    return updateStatus({ bookingId: input.bookingId, status: 'seated' })
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

/**
 * Create a 30-minute personal break block for a barber on a given start time.
 * Constraints:
 * - Max 2 breaks per day per barber (count non-canceled with notes='BREAK')
 * - Uses/creates a hidden 'Break' service (30 min) for the shop to satisfy FK
 */
export async function createBreakAction(input: { barberId: string; startTimeIso: string }) {
    const user = await requireAuth()
    const supabase = await createServerActionClient()

    // Resolve barber and shop
    const { data: barber, error: barberError } = await supabase
        .from('barbers')
        .select('id, shop_id, is_active, deleted_at')
        .eq('id', input.barberId)
        .maybeSingle<{ id: string; shop_id: string; is_active: boolean; deleted_at: string | null }>()

    if (barberError) throw new Error('Failed to load barber')
    if (!barber || barber.deleted_at || !barber.is_active) throw new Error('Barber not available')

    // Verify user owns this shop via subscription access check
    const accessCheck = await checkSubscriptionAccess(barber.shop_id)
    if (!accessCheck.allowed) {
        throw new Error('Shop subscription is not active')
    }

    // Enforce daily limit: max 2 breaks per day
    const dateStr = input.startTimeIso.split('T')[0]
    const dayStart = new Date(dateStr + 'T00:00:00.000Z').toISOString()
    const dayEnd = new Date(dateStr + 'T23:59:59.999Z').toISOString()

    const { count: breakCount, error: countError } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('barber_id', input.barberId)
        .eq('shop_id', barber.shop_id)
        .is('deleted_at', null)
        .neq('status', 'canceled')
        .eq('notes', 'BREAK')
        .gte('start_time', dayStart)
        .lte('start_time', dayEnd)

    if (countError) throw new Error('Failed to validate break limit')
    if ((breakCount ?? 0) >= 2) {
        throw new Error('Daily break limit (2) reached.')
    }

    // Ensure a 'Break' service exists (30 minutes, price 0, active)
    const { data: existingBreakService } = (await supabase
        .from('services')
        .select('id, duration_minutes, is_active, deleted_at')
        .eq('shop_id', barber.shop_id)
        .eq('name', 'Break')
        .maybeSingle()) as { data: { id: string; duration_minutes: number; is_active: boolean; deleted_at: string | null } | null }

    let breakServiceId = existingBreakService?.id
    if (!breakServiceId || existingBreakService?.deleted_at) {
        // Create a fresh client to avoid type pollution from previous queries
        const insertClient = await createServerActionClient()
        const { data: inserted, error: insertError } = await insertClient
            .from('services')
            // @ts-expect-error - supabase types narrowed by previous maybeSingle calls
            .insert({
                shop_id: barber.shop_id,
                name: 'Break',
                duration_minutes: 30,
                price: 0,
                advance_amount: 0,
                requires_advance: false,
                is_active: true,
            })
            .select('id')
            .single()

        if (insertError) throw new Error('Failed to create Break service')
        breakServiceId = (inserted as any).id as string
    }

    // Compute end time exactly +30 minutes
    const start = new Date(input.startTimeIso)
    const end = new Date(start)
    end.setMinutes(end.getMinutes() + 30)

    // Insert booking directly (status confirmed, notes BREAK)
    const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        // @ts-expect-error - supabase types narrowed by previous maybeSingle calls
        .insert({
            shop_id: barber.shop_id,
            barber_id: input.barberId,
            service_id: breakServiceId!,
            customer_name: 'Personal Break',
            customer_phone: '',
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            status: 'confirmed',
            is_walk_in: false,
            notes: 'BREAK',
        })
        .select('id')
        .single()

    if (bookingError) {
        // Map overlap violations to a user-friendly message
        const code = (bookingError as any).code
        if (code === '23P01') {
            throw new Error('Selected slot overlaps with another booking')
        }
        throw new Error(bookingError.message)
    }

    return { ok: true, bookingId: (booking as any)?.id as string }
}
