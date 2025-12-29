'use server'

import { createServiceSupabaseClient } from '@/lib/supabase'
import { createRazorpayOrder } from '@/lib/razorpay'

interface InitiatePaymentInput {
    service_id: string
    barber_id: string
    date: string
    time: string
    customer_name: string
    customer_phone: string
}

interface InitiatePaymentResponse {
    success: boolean
    razorpay_order_id?: string
    amount?: number
    currency?: string
    error?: string
}

/**
 * Initiate payment for a booking with fixed ₹50 advance
 *
 * Flow:
 * 1. Validate service and barber
 * 2. Create Razorpay order for ₹50 (5000 paise)
 * 3. Store payment record in database with status 'created'
 * 4. Return order details to client
 *
 * Note: booking_id is NOT set yet. It will be linked after successful payment webhook.
 */
export async function initiateBookingPayment(
    input: InitiatePaymentInput
): Promise<InitiatePaymentResponse> {
    const supabase = createServiceSupabaseClient()
    const { service_id, barber_id, date, time, customer_name, customer_phone } = input

    console.log('initiateBookingPayment called with:', { service_id, barber_id, date, time, customer_name, customer_phone })

    try {
        // Validate inputs
        if (!service_id || !barber_id || !date || !time || !customer_name || !customer_phone) {
            console.error('Missing required fields in initiateBookingPayment')
            return {
                success: false,
                error: 'Missing required fields',
            }
        }

        // Validate service exists
        const { data: service, error: serviceError } = await supabase
            .from('services')
            .select('id, shop_id, is_active, deleted_at')
            .eq('id', service_id)
            .maybeSingle()

        console.log('Service fetched:', { service, serviceError })

        if (serviceError) {
            console.error('Service fetch error:', serviceError)
            return {
                success: false,
                error: 'Failed to fetch service',
            }
        }

        if (!service || (service as any).deleted_at || !(service as any).is_active) {
            return {
                success: false,
                error: 'Service not available',
            }
        }

        // Fixed advance payment amount: 50 INR (5000 paise)
        const ADVANCE_AMOUNT_PAISE = 5000 // 50 INR

        // Validate barber belongs to same shop
        const { data: barber, error: barberError } = await supabase
            .from('barbers')
            .select('id, shop_id, is_active, deleted_at')
            .eq('id', barber_id)
            .maybeSingle()

        if (barberError) {
            return {
                success: false,
                error: 'Failed to fetch barber',
            }
        }

        if (!barber || (barber as any).deleted_at || !(barber as any).is_active) {
            return {
                success: false,
                error: 'Barber not available',
            }
        }

        if ((barber as any).shop_id !== (service as any).shop_id) {
            return {
                success: false,
                error: 'Barber and service must belong to same shop',
            }
        }

        // Create Razorpay order with fixed amount
        const tempBookingRef = `${(service as any).shop_id.slice(0, 8)}_${Date.now()}`
        const razorpayResult = await createRazorpayOrder(
            ADVANCE_AMOUNT_PAISE,
            tempBookingRef,
            `Advance payment for service`
        )

        if (!razorpayResult.success) {
            return {
                success: false,
                error: razorpayResult.error || 'Failed to create Razorpay order',
            }
        }

        // Store payment record in database
        const { data: payment, error: paymentError } = await ((supabase as any)
            .from('payments')
            .insert({
                razorpay_order_id: razorpayResult.orderId,
                amount: razorpayResult.amount,
                status: 'created',
            })
            .select('id')
            .single())

        if (paymentError) {
            console.error('Failed to store payment record:', paymentError)
            return {
                success: false,
                error: 'Failed to store payment record',
            }
        }

        return {
            success: true,
            razorpay_order_id: razorpayResult.orderId,
            amount: Number(razorpayResult.amount),
            currency: razorpayResult.currency,
        }
    } catch (error) {
        console.error('Payment initiation failed:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Payment initiation failed',
        }
    }
}
