import { createServerActionClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Auth callback route for Supabase email confirmation
 * This handles the redirect after a user clicks the confirmation link in their email
 */
export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const next = requestUrl.searchParams.get('next') || '/dashboard'

    if (code) {
        const supabase = await createServerActionClient()
        await supabase.auth.exchangeCodeForSession(code)
    }

    // Redirect to the next URL or dashboard
    return NextResponse.redirect(new URL(next, request.url))
}
