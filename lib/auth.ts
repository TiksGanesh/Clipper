import { createServerSupabaseClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { redirect } from 'next/navigation'

/**
 * Get the current authenticated user from server components
 * Returns null if not authenticated
 */
export async function getUser() {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user
}

/**
 * Get the current session from server components
 * Returns null if not authenticated
 */
export async function getSession() {
    const supabase = await createServerSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session
}

/**
 * Require authentication - redirects to login if not authenticated
 * Use this in Server Components and Server Actions that require auth
 */
export async function requireAuth() {
    const user = await getUser()

    if (!user) {
        redirect('/login')
    }

    return user
}

/**
 * Check if user is an admin
 * Admins have elevated permissions in the system
 */
export async function isAdmin() {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return false
    }

    const { data: adminMembership, error: adminCheckError } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()

    return !!adminMembership && !adminCheckError
}

/**
 * Require admin access - redirects to dashboard if not admin
 */
export async function requireAdmin() {
    const user = await requireAuth()
    const supabase = await createServerSupabaseClient()
    const { data: adminMembership } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()

    if (!adminMembership) {
        redirect('/dashboard')
    }

    return user
}

export type AdminContext = {
    userId: string
    email: string | null
}

export class AdminAuthError extends Error {
    status: number
    constructor(message: string, status: number) {
        super(message)
        this.status = status
    }
}

// Server-side admin session validation without redirects or cookie handling
export async function requireAdminContext(): Promise<AdminContext> {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
        throw new AdminAuthError('Unauthorized', 401)
    }

    const { data: adminMembership, error: adminCheckError } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()

    if (adminCheckError) {
        throw new AdminAuthError('Unable to verify admin access', 500)
    }

    if (!adminMembership) {
        throw new AdminAuthError('Forbidden', 403)
    }

    return {
        userId: user.id,
        email: user.email ?? null,
    }
}

// Helper for route handlers: returns AdminContext or NextResponse with appropriate status
export async function assertAdminSession(): Promise<AdminContext | NextResponse> {
    try {
        return await requireAdminContext()
    } catch (error) {
        if (error instanceof AdminAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status })
        }
        throw error
    }
}
