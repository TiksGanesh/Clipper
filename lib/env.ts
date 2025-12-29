/**
 * Environment variables with validation
 * 
 * CRITICAL: Variables prefixed with NEXT_PUBLIC_ are exposed to the browser.
 * Never prefix secrets (Razorpay secret, webhook secret) with NEXT_PUBLIC_
 */

// Client-side accessible (public)
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
export const razorpayKeyIdPublic = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!

// Server-side only (private) - accessed in API routes and server components
export const razorpayKeyId = process.env.RAZORPAY_KEY_ID!
export const razorpaySecret = process.env.RAZORPAY_SECRET!
export const razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!

/**
 * Validate required environment variables on startup
 * Call this in your root layout or API initialization
 * 
 * NOTE: Razorpay env vars are optional while payment flow is disabled.
 * Enable them when integrating payments.
 */
export function validateEnv() {
    const required = [
        { key: 'NEXT_PUBLIC_SUPABASE_URL', value: supabaseUrl },
        { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: supabaseAnonKey },
        // Razorpay env vars are optional for now (payment flow disabled)
        // Uncomment when enabling payment integration:
        // { key: 'NEXT_PUBLIC_RAZORPAY_KEY_ID', value: razorpayKeyIdPublic },
        // { key: 'RAZORPAY_KEY_ID', value: razorpayKeyId },
        // { key: 'RAZORPAY_SECRET', value: razorpaySecret },
        // { key: 'RAZORPAY_WEBHOOK_SECRET', value: razorpayWebhookSecret },
    ]

    const missing = required.filter(({ value }) => !value)

    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables:\n${missing.map(({ key }) => `  - ${key}`).join('\n')}`
        )
    }
}
