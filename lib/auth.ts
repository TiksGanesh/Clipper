import { createServerSupabaseClient } from '@/lib/supabase'
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
    const user = await getUser()

    if (!user) {
        return false
    }

    // Check user metadata or a dedicated admins table
    // For now, checking if user has admin role in metadata
    return user.user_metadata?.role === 'admin'
}

/**
 * Require admin access - redirects to dashboard if not admin
 */
export async function requireAdmin() {
    const user = await requireAuth()
    const admin = await isAdmin()

    if (!admin) {
        redirect('/dashboard')
    }

    return user
}
