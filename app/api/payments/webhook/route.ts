import { NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase'
import { verifyRazorpaySignature } from '@/lib/razorpay'
import { razorpayWebhookSecret } from '@/lib/env'
import crypto from 'crypto'

export async function POST(req: Request) {
    try {
        const body = await req.json()

        const {
            payment: {
                id: payment_id,
                order_id: order_id,
                status: payment_status,
                amount,
            },
        } = body

        // Razorpay sends webhook signature in headers
        const signature = req.headers.get('x-razorpay-signature') || ''

        // Verify signature
        const hmac = crypto.createHmac('sha256', razorpayWebhookSecret)
        const body_string = JSON.stringify(body)
        hmac.update(body_string)
        const computed_signature = hmac.digest('hex')

        if (computed_signature !== signature) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
        }

        const supabase = createServiceSupabaseClient()

        // Handle payment success
        if (payment_status === 'captured') {
            // Update payment record
            const { error: updateError } = await (supabase as any)
                .from('payments')
                .update({
                    razorpay_payment_id: payment_id,
                    status: 'paid',
                })
                .eq('razorpay_order_id', order_id)

            if (updateError) {
                console.error('Failed to update payment on webhook:', updateError)
                return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 })
            }

            return NextResponse.json({ success: true })
        }

        // Handle payment failure
        if (payment_status === 'failed') {
            const { error: updateError } = await (supabase as any)
                .from('payments')
                .update({
                    status: 'failed',
                })
                .eq('razorpay_order_id', order_id)

            if (updateError) {
                console.error('Failed to mark payment as failed:', updateError)
            }

            return NextResponse.json({ success: true })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Webhook handler error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
