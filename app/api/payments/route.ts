import { NextResponse } from "next/server";
import Razorpay from "razorpay";

export async function POST(req: Request) {
  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    const { amount, userId } = await req.json();

    // 1. Create Order in Razorpay
    const order = await razorpay.orders.create({
      amount: amount * 100, // Amount in paise
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
      notes: { userId }, // Optional: Pass metadata
    });

    // 2. Save "Pending" Order to Supabase (Optional but Recommended)
    // const supabase = createServiceSupabaseClient();
    // await supabase.from('payments').insert({ razorpay_order_id: order.id, status: 'pending' });

    return NextResponse.json(order);
  } catch (error) {
    return NextResponse.json({ error: "Order creation failed" }, { status: 500 });
  }
}