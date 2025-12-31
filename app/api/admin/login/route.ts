import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST(request: NextRequest) {
    const { email, password } = await request.json().catch(() => ({})) as {
        email?: string
        password?: string
    }

    if (!email || !password) {
        return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const cookieJar: { name: string; value: string; options: any }[] = []

    const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
        cookies: {
            getAll() {
                return request.cookies.getAll()
            },
            setAll(cookies) {
                cookies.forEach((cookie) => cookieJar.push(cookie))
            },
        },
    })

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (signInError || !signInData?.user) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const { data: adminMembership, error: adminError } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', signInData.user.id)
        .maybeSingle()

    if (adminError) {
        return NextResponse.json({ error: 'Unable to verify admin access' }, { status: 500 })
    }

    if (!adminMembership) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = {
        user: {
            id: signInData.user.id,
            email: signInData.user.email,
        },
        session: signInData.session,
        accessToken: signInData.session?.access_token,
        refreshToken: signInData.session?.refresh_token,
    }

    const response = NextResponse.json(body, { status: 200 })
    cookieJar.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options)
    })

    return response
}
