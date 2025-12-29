'use server'

import { createServiceSupabaseClient } from '@/lib/supabase'
import { verifyRazorpaySignature } from '@/lib/razorpay'

interface VerifyAndCreateBookingInput {
    razorpay_order_id: string
    razorpay_payment_id: string
    razorpay_signature: string
    barber_id: string
    service_ids: string[]
    slot_start: string
    customer_name: string
    customer_phone: string
    date: string
    timezone_offset: number
}

interface VerifyAndCreateBookingResponse {
    success: boolean
    booking_id?: string
    error?: string
}

/**
 * Verify Razorpay payment signature and create booking
 *
 * Flow:
 * 1. Verify payment signature (HMAC-SHA256)
 * 2. Update payment record with razorpay_payment_id and status 'paid'
 * 3. Create booking
 * 4. Link booking_id to payment record
 * 5. Return booking_id
 */
export async function verifyAndCreateBooking(
    input: VerifyAndCreateBookingInput
): Promise<VerifyAndCreateBookingResponse> {
    const supabase = createServiceSupabaseClient()
    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        barber_id,
        service_ids,
        slot_start,
        customer_name,
        customer_phone,
        date,
        timezone_offset,
    } = input

    try {
        // Verify Razorpay signature
        const isSignatureValid = verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)

        if (!isSignatureValid) {
            return {
                success: false,
                error: 'Invalid payment signature',
            }
        }

        // Fetch payment record to ensure it exists and hasn't been processed
        const { data: payment, error: paymentFetchError } = await supabase
            .from('payments')
            .select('id, status')
            .eq('razorpay_order_id', razorpay_order_id)
            .maybeSingle()

        if (paymentFetchError) {
            return {
                success: false,
                error: 'Failed to fetch payment record',
            }
        }

        if (!payment) {
            return {
                success: false,
                error: 'Payment record not found',
            }
        }

        // Prevent duplicate processing
        if ((payment as any).status === 'paid') {
            return {
                success: false,
                error: 'Payment already processed',
            }
        }

        // Call the stored procedure to create booking with all validations
        const { data: bookingResult, error: bookingError } = await (supabase as any).rpc('create_booking', {
            p_shop_id: null, // Will be derived from services
            p_barber_id: barber_id,
            p_service_ids: service_ids,
            p_customer_name: customer_name,
            p_customer_phone: customer_phone,
            p_start_time: slot_start,
            p_is_walk_in: false,
        })

        if (bookingError) {
            console.error('Booking creation failed:', bookingError)
            return {
                success: false,
                error: bookingError.message || 'Failed to create booking',
            }
        }

        const bookingId = bookingResult as string

        // Update payment record with payment_id and status 'paid'
        const { error: paymentUpdateError } = await (supabase as any)
            .from('payments')
            .update({
                razorpay_payment_id,
                status: 'paid',
                booking_id: bookingId,
            })
            .eq('razorpay_order_id', razorpay_order_id)

        if (paymentUpdateError) {
            console.error('Failed to update payment record:', paymentUpdateError)
            // Booking was created but payment record wasn't updated - this is a state inconsistency
            // In production, you might want to queue a reconciliation job
            return {
                success: true,
                booking_id: bookingId,
                // Return success since booking was created, but log the issue
            }
        }

        return {
            success: true,
            booking_id: bookingId,
        }
    } catch (error) {
        console.error('Verify and create booking failed:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to process booking',
        }
    }
}
