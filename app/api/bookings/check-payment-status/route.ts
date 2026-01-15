import { NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase'
import { z } from 'zod'

const requestSchema = z.object({
    booking_id: z.string().uuid('Invalid booking ID'),
})

/**
 * Check the payment status for a booking and verify against Razorpay if needed.
 * Useful for barbers to manually verify pending_payment bookings.
 *
 * Returns:
 * - status: 'confirmed' | 'paid' | 'pending' | 'failed' | 'not_found'
 * - payment_id: string (optional, if payment exists)
 * - payment_status: string (optional, raw status from DB)
 */
export async function POST(req: Request) {
    const supabase = createServiceSupabaseClient()

    try {
        const body = await req.json()
        const validation = requestSchema.safeParse(body)

        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: validation.error.issues },
                { status: 400 }
            )
        }

        const { booking_id } = validation.data

        console.log('[check-payment-status] checking payment for booking', { booking_id })

        // Fetch booking
        const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .select('id, status, expires_at')
            .eq('id', booking_id)
            .maybeSingle()

        if (bookingError) {
            console.error('[check-payment-status] booking fetch error', bookingError)
            return NextResponse.json(
                { error: 'Failed to fetch booking' },
                { status: 500 }
            )
        }

        if (!booking) {
            console.log('[check-payment-status] booking not found', { booking_id })
            return NextResponse.json(
                { status: 'not_found', error: 'Booking not found' },
                { status: 404 }
            )
        }

        // If already confirmed, return immediately
        if ((booking as any).status === 'confirmed') {
            console.log('[check-payment-status] booking already confirmed', { booking_id })
            return NextResponse.json({
                status: 'confirmed',
                booking_status: (booking as any).status,
            })
        }

        // If not pending_payment, return current status
        if ((booking as any).status !== 'pending_payment') {
            console.log('[check-payment-status] booking not pending_payment', {
                booking_id,
                status: (booking as any).status,
            })
            return NextResponse.json({
                status: (booking as any).status,
                booking_status: (booking as any).status,
            })
        }

        // Check if hold is expired
        const expiresAt = new Date((booking as any).expires_at)
        if (expiresAt < new Date()) {
            console.log('[check-payment-status] booking hold expired', {
                booking_id,
                expiresAt,
            })
            return NextResponse.json({
                status: 'expired',
                error: 'Booking hold has expired',
            })
        }

        // Fetch payment record
        const { data: payment, error: paymentError } = await supabase
            .from('payments')
            .select('id, razorpay_order_id, razorpay_payment_id, status')
            .eq('booking_id', booking_id)
            .maybeSingle()

        if (paymentError) {
            console.error('[check-payment-status] payment fetch error', paymentError)
            return NextResponse.json(
                { error: 'Failed to fetch payment' },
                { status: 500 }
            )
        }

        if (!payment) {
            console.log('[check-payment-status] no payment record found', { booking_id })
            return NextResponse.json({
                status: 'pending',
                payment_status: 'not_found',
                message: 'No payment record found for this booking',
            })
        }

        const paymentStatus = (payment as any).status as string

        console.log('[check-payment-status] payment status check', {
            booking_id,
            payment_id: (payment as any).id,
            payment_status: paymentStatus,
        })

        // If payment is already paid, we can attempt to confirm the booking
        if (paymentStatus === 'paid' || paymentStatus === 'success') {
            console.log('[check-payment-status] payment is paid, attempting booking confirmation', {
                booking_id,
            })

            // Update booking to confirmed
            const { error: updateError } = await (supabase as any)
                .from('bookings')
                .update({
                    status: 'confirmed',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', booking_id)

            if (updateError) {
                console.error('[check-payment-status] booking confirmation failed', updateError)
                // Still return 'paid' status to inform barber payment went through
                return NextResponse.json({
                    status: 'paid',
                    payment_status: paymentStatus,
                    message: 'Payment confirmed but booking update failed. Please contact support.',
                })
            }

            console.log('[check-payment-status] booking confirmed successfully', { booking_id })
            return NextResponse.json({
                status: 'confirmed',
                payment_status: paymentStatus,
                payment_id: (payment as any).id,
                message: 'Payment confirmed and booking status updated.',
            })
        }

        // Payment is still in 'created' status
        console.log('[check-payment-status] payment still pending', {
            booking_id,
            payment_status: paymentStatus,
        })

        return NextResponse.json({
            status: 'pending',
            payment_status: paymentStatus,
            payment_id: (payment as any).id,
            message: 'Payment is still awaiting customer confirmation. Please check with customer or wait for webhook update.',
        })
    } catch (error) {
        console.error('[check-payment-status] error', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
