import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware to protect routes and manage dual sessions
 * 
 * Session Strategy:
 * - Barber: Standard Supabase cookies (default storage)
 * - Admin: Separate admin session detection via admin_users table
 * 
 * Protected routes:
 * - /dashboard/* - requires barber authentication
 * - /admin/* - requires admin role
 * - /setup/* - admin-only (create new shop from admin dashboard)
 * 
 * Public routes:
 * - /login - barber login
 * - /admin/login - admin login
 * - /book/* - public booking pages
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
                    response.cookies.set(name, value, options)
                },
                remove(name: string, options: CookieOptions) {
                    response.cookies.set(name, '', { ...options, maxAge: 0 })
                },
            },
        }
    )

    // Get barber session from Supabase
    const { data: { user: barberUser } } = await supabase.auth.getUser()

    const { pathname } = request.nextUrl

    // Check if barber user is also an admin
    let isAdmin = false
    if (barberUser) {
        const { data: adminMembership, error: adminCheckError } = await supabase
            .from('admin_users')
            .select('user_id')
            .eq('user_id', barberUser.id)
            .maybeSingle()

        isAdmin = !!adminMembership && !adminCheckError
    }

    // BARBER ROUTE PROTECTION
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/barber')) {
        // Prevent admin users from accessing barber routes
        if (isAdmin) {
            return NextResponse.redirect(new URL('/admin/dashboard', request.url))
        }
        // Require barber authentication
        if (!barberUser) {
            const redirectUrl = new URL('/login', request.url)
            redirectUrl.searchParams.set('redirect', pathname)
            return NextResponse.redirect(redirectUrl)
        }
    }

    // SETUP ROUTE PROTECTION - Admin only, never public
    if (pathname.startsWith('/setup')) {
        if (!barberUser || !isAdmin) {
            return NextResponse.redirect(new URL('/admin/login', request.url))
        }
    }

    // BARBER AUTH PAGES - Redirect authenticated barbers away
    if ((pathname === '/login' || pathname === '/signup') && barberUser && !isAdmin) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // ADMIN ROUTE PROTECTION
    if (pathname.startsWith('/admin') && pathname !== '/admin/login' && pathname !== '/admin/setup-user') {
        if (!barberUser) {
            return NextResponse.redirect(new URL('/admin/login', request.url))
        }
        if (!isAdmin) {
            // Barber trying to access admin routes - redirect to barber dashboard
            return NextResponse.redirect(new URL('/dashboard', request.url))
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
