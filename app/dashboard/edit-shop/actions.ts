'use server'

import { createServerSupabaseClient } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

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

export async function saveShopNameAction(shopName: string) {
    const user = await requireAuth()
    const supabase = await createServerSupabaseClient()

    if (!shopName?.trim()) {
        return {
            success: false,
            error: 'Shop name is required',
        }
    }

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

    // Update shop name
    const { error: updateError } = await supabase
        .from('shops')
        .update({ name: shopName.trim() })
        .eq('id', shop.id)

    if (updateError) {
        console.error('Error updating shop name:', updateError)
        return {
            success: false,
            error: 'Failed to update shop name',
        }
    }

    revalidatePath('/dashboard/edit-shop')
    return {
        success: true,
    }
}

export async function saveWorkingHoursAction(hours: {
    [day: string]: {
        isOpen: boolean
        openTime: string
        closeTime: string
    }
}) {
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

    // Map day names to day_of_week (0 = Monday, 6 = Sunday)
    const dayMap: { [key: string]: number } = {
        Monday: 0,
        Tuesday: 1,
        Wednesday: 2,
        Thursday: 3,
        Friday: 4,
        Saturday: 5,
        Sunday: 6,
    }

    // Validate hours
    for (const [day, timeData] of Object.entries(hours)) {
        if (!timeData.openTime || !timeData.closeTime) {
            return {
                success: false,
                error: `Invalid times for ${day}`,
            }
        }

        if (timeData.closeTime <= timeData.openTime) {
            return {
                success: false,
                error: `Close time must be after open time for ${day}`,
            }
        }
    }

    // Prepare working hours data for upsert
    const workingHoursData = Object.entries(hours).map(([day, timeData]) => ({
        shop_id: shop.id,
        day_of_week: dayMap[day] ?? 0,
        open_time: timeData.openTime,
        close_time: timeData.closeTime,
        is_closed: !timeData.isOpen,
    }))

    // Use upsert to avoid duplicate key conflicts
    const { error: upsertError } = await supabase
        .from('working_hours')
        .upsert(workingHoursData, {
            onConflict: 'shop_id,day_of_week',
        })

    if (upsertError) {
        console.error('Error upserting working hours:', upsertError)
        return {
            success: false,
            error: 'Failed to update working hours',
        }
    }

    revalidatePath('/dashboard/edit-shop')
    return {
        success: true,
    }
}

export async function saveBarberDetailsAction(barbers: Array<{ id: string; name: string; phone: string | null }>) {
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

    // Validate barbers
    for (const barber of barbers) {
        if (!barber.name?.trim()) {
            return {
                success: false,
                error: 'Barber name is required',
            }
        }
    }

    // Update each barber - only update name and phone fields
    // Don't change is_active status through this action
    for (const barber of barbers) {
        const { error: updateError } = await supabase
            .from('barbers')
            .update({
                name: barber.name.trim(),
                phone: barber.phone?.trim() || null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', barber.id)
            .eq('shop_id', shop.id)
            .is('deleted_at', null)  // Only update non-deleted barbers

        if (updateError) {
            console.error('Error updating barber:', updateError)
            // Check if error is about max barbers constraint
            if (updateError.message?.includes('Maximum 2 active barbers')) {
                return {
                    success: false,
                    error: 'You can only have a maximum of 2 active barbers per shop',
                }
            }
            return {
                success: false,
                error: `Failed to update barber details`,
            }
        }
    }

    revalidatePath('/dashboard/edit-shop')
    return {
        success: true,
    }
}

