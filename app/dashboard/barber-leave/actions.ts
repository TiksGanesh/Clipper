'use server'

import { createServerSupabaseClient } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth'
import { checkSubscriptionAccess } from '@/lib/subscription-access'

export async function setBarberLeaveAction(barberId: string, isOnLeave: boolean) {
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

    // CRITICAL SECURITY: Check subscription access
    const accessCheck = await checkSubscriptionAccess(shop.id)
    if (!accessCheck.allowed) {
        return {
            success: false,
            error: 'Your subscription is not active. Please contact support.',
        }
    }

    // Verify barber belongs to this shop
    const { data: barber, error: barberError } = await supabase
        .from('barbers')
        .select('id, shop_id')
        .eq('id', barberId)
        .is('deleted_at', null)
        .maybeSingle()

    if (barberError || !barber) {
        return {
            success: false,
            error: 'Barber not found',
        }
    }

    if ((barber as any).shop_id !== shop.id) {
        return {
            success: false,
            error: 'Unauthorized',
        }
    }

    const today = new Date().toISOString().split('T')[0]

    if (isOnLeave) {
        // Insert barber leave record for today
        const { error: insertError } = await supabase.from('barber_leaves').insert({
            barber_id: barberId,
            leave_date: today,
        })

        if (insertError) {
            console.error('Error setting barber leave:', insertError)
            return {
                success: false,
                error: 'Failed to mark unavailable',
            }
        }

        return {
            success: true,
        }
    } else {
        // Remove barber leave record for today
        const { error: deleteError } = await supabase
            .from('barber_leaves')
            .delete()
            .eq('barber_id', barberId)
            .eq('leave_date', today)

        if (deleteError) {
            console.error('Error removing barber leave:', deleteError)
            return {
                success: false,
                error: 'Failed to mark available',
            }
        }

        return {
            success: true,
        }
    }
}

export async function getBarberLeaveStatus(barberId: string): Promise<boolean> {
    const supabase = await createServerSupabaseClient()
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
        .from('barber_leaves')
        .select('id')
        .eq('barber_id', barberId)
        .eq('leave_date', today)
        .maybeSingle()

    if (error) {
        console.error('Error fetching barber leave status:', error)
        return false
    }

    return !!data
}
