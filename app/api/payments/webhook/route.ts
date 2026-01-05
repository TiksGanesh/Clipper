// src/app/api/payments/webhook/route.ts
import { NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase'
import { razorpayWebhookSecret } from '@/lib/env'
import crypto from 'crypto'

export async function POST(req: Request) {
    try {
        // 1. Get RAW BODY as text for signature verification
        const rawBody = await req.text()

        // 2. Get Signature from headers
        const signature = req.headers.get('x-razorpay-signature') || ''

        // 3. Verify Signature using the RAW body
        const hmac = crypto.createHmac('sha256', razorpayWebhookSecret)
        hmac.update(rawBody)
        const computed_signature = hmac.digest('hex')

        if (computed_signature !== signature) {
            console.error("Signature mismatch")
            return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
        }

        // 4. Parse the verified body
        const body = JSON.parse(rawBody)

        // 5. Correctly extract payment entity (Standard Razorpay Structure)
        // Structure is: { payload: { payment: { entity: { ... } } } }
        const paymentEntity = body?.payload?.payment?.entity || body?.payload?.order?.entity

        if (!paymentEntity) {
            // If it's a "ping" event or different structure, just return 200 to keep Razorpay happy
            return NextResponse.json({ success: true })
        }

        const {
            id: payment_id,
            order_id: order_id,
            status: payment_status,
        } = paymentEntity

        const supabase = createServiceSupabaseClient()

        // Handle payment success
        if (body.event === 'payment.captured' || payment_status === 'captured') {
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
        }

        // Handle payment failure
        else if (body.event === 'payment.failed' || payment_status === 'failed') {
            const { error: updateError } = await (supabase as any)
                .from('payments')
                .update({
                    status: 'failed',
                })
                .eq('razorpay_order_id', order_id)

            if (updateError) console.error('DB Error:', updateError)
        }

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('Webhook handler error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}