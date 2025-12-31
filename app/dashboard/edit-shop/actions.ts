'use server'

import { createServerSupabaseClient } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth'

export async function saveShopClosureAction(
    closedFrom: string,
    closedTo: string,
    closureReason: string,
    isClosed: boolean
) {
    const user = await requireAuth()
    const supabase = await createServerSupabaseClient()

    // Get shop
    const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .maybeSingle()

    if (shopError || !shop) {
        return {
            success: false,
            error: 'Shop not found',
        }
    }

    // If closure is disabled, soft delete any existing closure
    if (!isClosed) {
        const { error: deleteError } = await supabase
            .from('shop_closures')
            .update({ deleted_at: new Date().toISOString() })
            .eq('shop_id', shop.id)
            .is('deleted_at', null)

        if (deleteError) {
            console.error('Error deleting closure:', deleteError)
            return {
                success: false,
                error: 'Failed to delete closure',
            }
        }

        return {
            success: true,
        }
    }

    // Validate dates
    if (!closedFrom || !closedTo) {
        return {
            success: false,
            error: 'Both dates are required',
        }
    }

    if (new Date(closedTo) < new Date(closedFrom)) {
        return {
            success: false,
            error: 'Closed To date cannot be before Closed From date',
        }
    }

    // Soft delete existing closure and insert new one
    await supabase
        .from('shop_closures')
        .update({ deleted_at: new Date().toISOString() })
        .eq('shop_id', shop.id)
        .is('deleted_at', null)

    const { error: insertError } = await supabase.from('shop_closures').insert({
        shop_id: shop.id,
        closed_from: closedFrom,
        closed_to: closedTo,
        reason: closureReason || null,
    })

    if (insertError) {
        console.error('Error creating closure:', insertError)
        return {
            success: false,
            error: 'Failed to save closure',
        }
    }

    return {
        success: true,
    }
}
