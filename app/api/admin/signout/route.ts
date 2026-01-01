import { createServerSupabaseClient } from '@/lib/supabase'
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient()

        // Sign out user from Supabase
        await supabase.auth.signOut()

        // Get the protocol from request
        const protocol = request.nextUrl.protocol
        
        // Try to get the host from forwarded headers first (for proxies like GitHub Codespaces)
        // Then fall back to host header (split to remove port)
        // Finally fallback to nextUrl.hostname
        const forwardedHost = request.headers.get('x-forwarded-host')
        const host = request.headers.get('host')
        
        // Use forwarded host if available (GitHub Codespaces proxy), otherwise use hostname without port
        const hostname = forwardedHost || host?.split(':')[0] || request.nextUrl.hostname
        
        const loginUrl = `${protocol}//${hostname}/admin/login`
        
        return NextResponse.redirect(loginUrl, {
            status: 302,
        })
    } catch (error) {
        console.error('Admin signout error:', error)
        return NextResponse.json(
            { error: 'Sign out failed' },
            { status: 500 }
        )
    }
}
