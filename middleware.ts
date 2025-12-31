import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware to protect routes and refresh auth tokens
 * 
 * Protected routes:
 * - /dashboard/* - requires authentication
 * - /admin/* - requires admin role (future)
 * 
 * Public routes:
 * - /login, /signup - redirects to dashboard if already authenticated
 * - /book/* - public booking pages for customers
 */
export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    const cookie = request.cookies.get(name)
                    return cookie?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    // Write cookies to the response (middleware cannot mutate the request cookies)
                    response.cookies.set(name, value, options)
                },
                remove(name: string, options: CookieOptions) {
                    response.cookies.set(name, '', { ...options, maxAge: 0 })
                },
            },
        }
    )

    // Refresh session if expired
    const { data: { user } } = await supabase.auth.getUser()

    const { pathname } = request.nextUrl

    // Protect dashboard and setup routes - require authentication
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/setup')) {
        if (!user) {
            const redirectUrl = new URL('/login', request.url)
            redirectUrl.searchParams.set('redirect', pathname)
            return NextResponse.redirect(redirectUrl)
        }
    }

    // Redirect authenticated users away from auth pages
    if ((pathname === '/login' || pathname === '/signup') && user) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Admin routes protection: enforce server-side admin membership
    // Exception: /admin/login and /admin/setup-user are public (for initial access)
    if (pathname.startsWith('/admin') && pathname !== '/admin/login' && pathname !== '/admin/setup-user') {
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: response.headers })
        }

        const { data: adminMembership, error: adminCheckError } = await supabase
            .from('admin_users')
            .select('user_id')
            .eq('user_id', user.id)
            .maybeSingle()

        const isAdmin = !!adminMembership && !adminCheckError
        if (!isAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: response.headers })
        }
    }

    return response
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public files (public folder)
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
