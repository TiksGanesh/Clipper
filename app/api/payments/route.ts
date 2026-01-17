import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { z } from "zod";
import { createServiceSupabaseClient } from "@/lib/supabase";

// Validation schema
const paymentSchema = z.object({
  amount: z.number().nonnegative().max(100000),
  userId: z.string().min(1).max(255),
  serviceIds: z.array(z.string().uuid()).min(1).max(20)
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Validate input
    const validation = paymentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ 
        error: "Invalid input", 
        details: validation.error.issues 
      }, { status: 400 });
    }
    
    const { amount, userId, serviceIds } = validation.data;
    
    // CRITICAL SECURITY: Verify amount against database service prices
    const supabase = createServiceSupabaseClient();
    const { data: services, error: servicesError } = await supabase
      .from('services')
      .select('id, price, is_active, deleted_at')
      .in('id', serviceIds);
    
    if (servicesError || !services) {
      return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 });
    }
    
    if (services.length !== serviceIds.length) {
      return NextResponse.json({ error: "Some services not found" }, { status: 400 });
    }
    
    // Check if any service is inactive or deleted
    const hasInactiveService = services.some((s: any) => s.deleted_at || s.is_active === false);
    if (hasInactiveService) {
      return NextResponse.json({ error: "Some services are inactive" }, { status: 400 });
    }
    
    // Calculate expected total from database prices
    const expectedTotal = services.reduce((sum: number, s: any) => sum + (s.price || 0), 0);
    
    // Verify client amount matches database total
    if (Math.abs(amount - expectedTotal) > 0.01) { // Allow for minor floating point differences
      return NextResponse.json({ 
        error: "Amount mismatch. Please refresh and try again.",
        expectedAmount: expectedTotal
      }, { status: 400 });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    // Use verified amount from database, not client input
    const order = await razorpay.orders.create({
      amount: expectedTotal * 100, // Amount in paise
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
      notes: { userId, serviceIds: serviceIds.join(',') },
    });

    return NextResponse.json(order);
  } catch (error) {
    console.error('Payment order creation error:', error);
    return NextResponse.json({ error: "Order creation failed" }, { status: 500 });
  }
}