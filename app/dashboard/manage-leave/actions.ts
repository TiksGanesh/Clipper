'use server'

import { createServerSupabaseClient } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { checkSubscriptionAccess } from '@/lib/subscription-access'

export async function addBarberLeaveAction(barberId: string, leaveDate: string) {
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

    // Insert barber leave record
    const { error: insertError } = await supabase.from('barber_leaves').insert({
        barber_id: barberId,
        leave_date: leaveDate,
    })

    if (insertError) {
        console.error('Error setting barber leave:', insertError)
        // Check if it's a duplicate
        if (insertError.code === '23505') {
            return {
                success: false,
                error: 'Leave already exists for this date',
            }
        }
        return {
            success: false,
            error: 'Failed to add leave',
        }
    }

    revalidatePath('/dashboard/manage-leave')
    return {
        success: true,
    }
}

export async function removeBarberLeaveAction(leaveId: string) {
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

    // Verify leave belongs to barber in this shop
    const { data: leave } = await supabase
        .from('barber_leaves')
        .select(`
            id,
            barber_id,
            barbers!inner(shop_id)
        `)
        .eq('id', leaveId)
        .maybeSingle()

    if (!leave || (leave as any).barbers?.shop_id !== shop.id) {
        return {
            success: false,
            error: 'Unauthorized',
        }
    }

    // Delete leave
    const { error: deleteError } = await supabase.from('barber_leaves').delete().eq('id', leaveId)

    if (deleteError) {
        console.error('Error removing barber leave:', deleteError)
        return {
            success: false,
            error: 'Failed to remove leave',
        }
    }

    revalidatePath('/dashboard/manage-leave')
    return {
        success: true,
    }
}
