import Razorpay from 'razorpay'
import { razorpayKeyId, razorpaySecret } from './env'

/**
 * Initialize Razorpay instance with credentials
 * This should only be used in server-side contexts (API routes, server actions)
 * Secrets are never exposed to the client
 */
const razorpayInstance = new Razorpay({
    key_id: razorpayKeyId,
    key_secret: razorpaySecret,
})

/**
 * Create a Razorpay order for booking payment
 *
 * @param amount - Amount in smallest currency unit (paise for INR)
 * @param bookingId - Associated booking ID (for reference)
 * @param description - Order description (e.g., service name)
 * @returns Order details including order ID
 */
export async function createRazorpayOrder(
    amount: number,
    bookingId: string,
    description: string
) {
    try {
        const order = await razorpayInstance.orders.create({
            amount, // in paise
            currency: 'INR',
            receipt: `booking_${bookingId.slice(0, 8)}`,
            notes: {
                booking_id: bookingId,
                description,
            },
        } as any)

        return {
            success: true,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
        }
    } catch (error) {
        console.error('Razorpay order creation failed:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create order',
        }
    }
}

/**
 * Verify Razorpay payment signature
 * Used in webhook handler to confirm payment authenticity
 *
 * @param orderId - Razorpay order ID
 * @param paymentId - Razorpay payment ID
 * @param signature - Webhook signature from Razorpay
 * @returns Boolean indicating if signature is valid
 */
export function verifyRazorpaySignature(
    orderId: string,
    paymentId: string,
    signature: string
): boolean {
    const crypto = require('crypto')
    const hmac = crypto.createHmac('sha256', razorpaySecret)
    hmac.update(`${orderId}|${paymentId}`)
    const computed_signature = hmac.digest('hex')
    return computed_signature === signature
}

/**
 * Fetch payment details from Razorpay
 * Useful for verification and reconciliation
 */
export async function getRazorpayPayment(paymentId: string) {
    try {
        const payment = await razorpayInstance.payments.fetch(paymentId)
        return {
            success: true,
            payment,
        }
    } catch (error) {
        console.error('Razorpay payment fetch failed:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch payment',
        }
    }
}
