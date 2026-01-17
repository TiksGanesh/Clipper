import { requireAuth } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/shop/info
 * 
 * Returns the authenticated user's shop business type and terminology overrides.
 * Used by client components to get business-type-specific terminology.
 * 
 * Returns:
 * {
 *   business_type: 'barber' | 'salon' | 'clinic',
 *   terminology_overrides: object | null
 * }
 */
export async function GET(request: NextRequest) {
    try {
        const user = await requireAuth()
        const supabase = await createServerSupabaseClient()

        const { data: shop } = await supabase
            .from('shops')
            .select('business_type, terminology_overrides')
            .eq('owner_id', user.id)
            .is('deleted_at', null)
            .maybeSingle<{ business_type: string | null; terminology_overrides: any }>()

        if (!shop) {
            return NextResponse.json(
                { error: 'Shop not found' },
                { status: 404 }
            )
        }

        return NextResponse.json({
            business_type: shop.business_type || 'barber',
            terminology_overrides: shop.terminology_overrides || null,
        })
    } catch (error) {
        console.error('Error fetching shop info:', error)
        return NextResponse.json(
            { error: 'Failed to fetch shop info' },
            { status: 500 }
        )
    }
}
