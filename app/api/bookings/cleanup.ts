import { NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase'

/**
 * Cleanup expired pending_payment bookings
 * This route can be called periodically (e.g., every minute) to clean up bookings
 * that have expired (10 minutes old).
 * 
 * Called from: External cron/scheduler (e.g., Vercel Cron, GitHub Actions, or manual trigger)
 */
export async function POST(req: Request) {
    const supabase = createServiceSupabaseClient()

    // Optional: Add a secret key check for security
    const authHeader = req.headers.get('authorization')
    const cleanupSecret = process.env.CLEANUP_SECRET
    
    if (cleanupSecret && authHeader !== `Bearer ${cleanupSecret}`) {
        console.warn('[bookings-cleanup] unauthorized cleanup attempt')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        console.log('[bookings-cleanup] starting cleanup of expired holds...')

        // Find all pending_payment bookings that have expired
        const { data: expiredBookings, error: fetchError } = await supabase
            .from('bookings')
            .select('id, shop_id, barber_id, expires_at')
            .eq('status', 'pending_payment')
            .is('deleted_at', null)
            .lt('expires_at', new Date().toISOString())

        if (fetchError) {
            console.error('[bookings-cleanup] fetch error', fetchError)
            return NextResponse.json({ error: 'Failed to fetch expired bookings' }, { status: 500 })
        }

        if (!expiredBookings || expiredBookings.length === 0) {
            console.log('[bookings-cleanup] no expired bookings found')
            return NextResponse.json({ cleaned: 0, message: 'No expired bookings found' }, { status: 200 })
        }

        console.log(`[bookings-cleanup] found ${expiredBookings.length} expired bookings to clean up`)

        // Soft delete the expired bookings (set deleted_at)
        const bookingIds = expiredBookings.map((b: any) => b.id)
        const { error: deleteError } = await (supabase as any)
            .from('bookings')
            .update({ deleted_at: new Date().toISOString() })
            .in('id', bookingIds)

        if (deleteError) {
            console.error('[bookings-cleanup] delete error', deleteError)
            return NextResponse.json({ error: 'Failed to cleanup bookings' }, { status: 500 })
        }

        console.log(`[bookings-cleanup] successfully cleaned up ${expiredBookings.length} expired bookings`)

        return NextResponse.json({
            cleaned: expiredBookings.length,
            message: `Cleaned up ${expiredBookings.length} expired booking holds`,
            bookingIds
        }, { status: 200 })

    } catch (err: any) {
        console.error('[bookings-cleanup] unexpected error', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/**
 * GET endpoint to check cleanup status without performing cleanup
 */
export async function GET(req: Request) {
    const supabase = createServiceSupabaseClient()

    try {
        // Count expired bookings
        const { count, error } = await supabase
            .from('bookings')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending_payment')
            .is('deleted_at', null)
            .lt('expires_at', new Date().toISOString())

        if (error) {
            console.error('[bookings-cleanup] status check error', error)
            return NextResponse.json({ error: 'Failed to check status' }, { status: 500 })
        }

        return NextResponse.json({
            expired_count: count || 0,
            current_time: new Date().toISOString()
        }, { status: 200 })

    } catch (err: any) {
        console.error('[bookings-cleanup] unexpected error', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
