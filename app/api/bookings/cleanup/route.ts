import { NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase'

/**
 * Cleanup API for expired pending bookings
 * This endpoint should be called periodically via a cron job
 * Authorization: Check for a cron secret to prevent unauthorized access
 */
export async function POST(req: Request) {
    const supabase = createServiceSupabaseClient()

    // Simple auth check using a cron secret
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'changeme'
    
    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Call the database function to clean up expired bookings
        const { data, error } = await supabase.rpc('cleanup_expired_pending_bookings')

        if (error) {
            console.error('Cleanup error:', error)
            return NextResponse.json({ 
                error: 'Failed to cleanup expired bookings',
                details: error.message 
            }, { status: 500 })
        }

        const deletedCount = data || 0

        return NextResponse.json({ 
            success: true,
            deleted_count: deletedCount,
            message: `Cleaned up ${deletedCount} expired booking(s)`,
            timestamp: new Date().toISOString()
        })
    } catch (error: any) {
        console.error('Cleanup exception:', error)
        return NextResponse.json({ 
            error: 'Internal server error',
            message: error.message 
        }, { status: 500 })
    }
}

/**
 * GET endpoint for health check
 */
export async function GET() {
    return NextResponse.json({ 
        status: 'ok',
        endpoint: 'bookings-cleanup',
        message: 'Use POST with authorization header to trigger cleanup'
    })
}
