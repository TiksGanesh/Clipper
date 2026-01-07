import { NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase'
import type { Database } from '@/types/database'
import { z } from 'zod'

// Validation schema for confirming a held booking
const confirmBookingSchema = z.object({
    booking_id: z.string().uuid('Invalid booking ID'),
    customer_name: z.string().trim().min(1, 'Name is required').max(100, 'Name too long'),
    customer_phone: z.string().regex(/^\d{10,15}$/, 'Phone must be 10-15 digits'),
    razorpay_payment_id: z.string().optional(),
    razorpay_order_id: z.string().optional(),
    amount: z.number().positive().max(1000000).optional()
})

export async function POST(req: Request) {
    const supabase = createServiceSupabaseClient()

    let body: z.infer<typeof confirmBookingSchema>

    try {
        const rawBody = await req.json()
        const validation = confirmBookingSchema.safeParse(rawBody)
        
        if (!validation.success) {
            return NextResponse.json({ 
                error: 'Invalid input', 
                details: validation.error.issues 
            }, { status: 400 })
        }
        
        body = validation.data
    } catch (error) {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { booking_id, customer_name, customer_phone, razorpay_payment_id, razorpay_order_id, amount } = body

    // Fetch the pending booking
    const { data: booking, error: fetchError } = await (supabase as any)
        .from('bookings')
        .select('id, status, expires_at, deleted_at')
        .eq('id', booking_id)
        .single()

    if (fetchError || !booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Check if booking is still pending and not expired
    if (booking.status !== 'pending_payment') {
        return NextResponse.json({ error: 'Booking is not in pending state' }, { status: 400 })
    }

    if (booking.deleted_at) {
        return NextResponse.json({ error: 'Booking has been deleted' }, { status: 400 })
    }

    const now = new Date()
    const expiresAt = booking.expires_at ? new Date(booking.expires_at) : null
    
    if (expiresAt && expiresAt <= now) {
        return NextResponse.json({ error: 'Booking hold has expired. Please try again.' }, { status: 410 })
    }

    // Update the booking with customer details and confirm it
    const { error: updateError } = await (supabase as any)
        .from('bookings')
        .update({
            customer_name,
            customer_phone,
            status: 'confirmed',
            expires_at: null, // Clear expiration once confirmed
            updated_at: now.toISOString(),
        })
        .eq('id', booking_id)
        .eq('status', 'pending_payment') // Ensure it's still pending (avoid race conditions)

    if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Create payment record if payment details are provided
    if (razorpay_order_id && amount !== undefined) {
        const paymentInsert: Database['public']['Tables']['payments']['Insert'] = {
            booking_id: booking_id,
            razorpay_order_id: razorpay_order_id,
            razorpay_payment_id: razorpay_payment_id || null,
            amount: amount,
            status: razorpay_payment_id ? 'paid' : 'created'
        }
        
        const { error: paymentError } = await (supabase as any)
            .from('payments')
            .insert(paymentInsert)

        if (paymentError) {
            console.error('Failed to create payment record:', paymentError)
            // Note: Booking is already confirmed, so we don't rollback
            // The payment webhook will handle updates if needed
        }
    }

    return NextResponse.json({ 
        booking_id: booking_id,
        status: 'confirmed',
        message: 'Booking confirmed successfully'
    })
}
