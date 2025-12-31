import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
    const { email, password } = await request.json().catch(() => ({})) as {
        email?: string
        password?: string
    }

    if (!email || !password) {
        return NextResponse.json(
            { error: 'Email and password are required' },
            { status: 400 }
        )
    }

    if (password.length < 8) {
        return NextResponse.json(
            { error: 'Password must be at least 8 characters' },
            { status: 400 }
        )
    }

    try {
        const supabase = createServiceSupabaseClient()

        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        })

        if (authError || !authUser?.user) {
            return NextResponse.json(
                { error: authError?.message || 'Failed to create auth user' },
                { status: 400 }
            )
        }

        const { error: adminError } = await supabase
            .from('admin_users')
            .insert({ user_id: authUser.user.id })

        if (adminError) {
            return NextResponse.json(
                { error: 'Failed to grant admin role' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            message: 'Admin user created successfully',
            user: {
                id: authUser.user.id,
                email: authUser.user.email,
            },
        })
    } catch (error) {
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
