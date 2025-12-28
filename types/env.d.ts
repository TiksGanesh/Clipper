declare namespace NodeJS {
    interface ProcessEnv {
        // Supabase (public - exposed to browser)
        NEXT_PUBLIC_SUPABASE_URL: string
        NEXT_PUBLIC_SUPABASE_ANON_KEY: string

        // Supabase (private - server-side only)
        SUPABASE_SERVICE_ROLE_KEY?: string

        // Razorpay (private - server-side only)
        RAZORPAY_KEY_ID: string
        RAZORPAY_SECRET: string
        RAZORPAY_WEBHOOK_SECRET: string
    }
}
