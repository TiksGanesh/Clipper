import { NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase'
import { assertAdminSession } from '@/lib/auth'

interface TerminologyOverrides {
    staff_label?: string
    service_label?: string
    customer_label?: string
    booking_action?: string
    queue_msg?: string
}

/**
 * PATCH /api/admin/shops/[shopId]/terminology
 * Admin-only endpoint to update shop terminology overrides
 */
export async function PATCH(
    request: Request,
    { params }: { params: { shopId: string } }
) {
    try {
        const adminSession = await assertAdminSession()
        if (adminSession instanceof NextResponse) return adminSession

        const supabase = createServiceSupabaseClient()

        const { terminology_overrides } = await request.json() as {
            terminology_overrides: TerminologyOverrides | null
        }

        // Validate terminology_overrides structure
        if (terminology_overrides !== null) {
            const validKeys = ['staff_label', 'service_label', 'customer_label', 'booking_action', 'queue_msg']
            const invalidKeys = Object.keys(terminology_overrides).filter(key => !validKeys.includes(key))

            if (invalidKeys.length > 0) {
                return NextResponse.json(
                    { error: `Invalid terminology keys: ${invalidKeys.join(', ')}` },
                    { status: 400 }
                )
            }

            // Validate that values are strings and not empty
            for (const [key, value] of Object.entries(terminology_overrides)) {
                if (value !== undefined && value !== null && typeof value !== 'string') {
                    return NextResponse.json(
                        { error: `Invalid value type for ${key}: must be string` },
                        { status: 400 }
                    )
                }
            }
        }

        // Update terminology overrides
        const { data, error } = await (supabase as any)
            .from('shops')
            .update({
                terminology_overrides: terminology_overrides,
                updated_at: new Date().toISOString()
            })
            .eq('id', params.shopId)
            .select('id, name, business_type, terminology_overrides')
            .maybeSingle()

        if (error) {
            console.error('Error updating terminology:', error)
            return NextResponse.json({ error: 'Failed to update terminology' }, { status: 500 })
        }

        if (!data) {
            return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
        }

        return NextResponse.json({
            success: true,
            shop: data
        })

    } catch (error) {
        console.error('Terminology update error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/**
 * GET /api/admin/shops/[shopId]/terminology
 * Get current terminology overrides for a shop
 */
export async function GET(
    request: Request,
    { params }: { params: { shopId: string } }
) {
    try {
        const adminSession = await assertAdminSession()
        if (adminSession instanceof NextResponse) return adminSession

        const supabase = createServiceSupabaseClient()

        // Fetch shop terminology
        const { data: shop, error } = await (supabase as any)
            .from('shops')
            .select('id, name, business_type, terminology_overrides')
            .eq('id', params.shopId)
            .single()

        if (error || !shop) {
            return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
        }

        return NextResponse.json({
            shop: {
                id: shop.id,
                name: shop.name,
                business_type: shop.business_type,
                terminology_overrides: shop.terminology_overrides || {}
            }
        })

    } catch (error) {
        console.error('Get terminology error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
