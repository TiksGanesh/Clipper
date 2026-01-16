'use server'

import { createServerSupabaseClient } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { checkSubscriptionAccess } from '@/lib/subscription-access'

// Type helper for shop queries
type ShopIdResult = { data: { id: string } | null; error: any }

// Phone validation constants (matches admin flow)
const PHONE_DIGITS_MIN = 7
const PHONE_DIGITS_MAX = 15

function validatePhone(value: string | null, opts: { label: string; required: boolean }): { ok: boolean; message?: string; normalized: string | null } {
    if (!value || value.length === 0) {
        if (opts.required) {
            return { ok: false, message: `Enter a valid ${opts.label}`, normalized: null }
        }
        return { ok: true, normalized: null }
    }

    const trimmed = value.trim()
    const digitsOnly = trimmed.replace(/\D/g, '')

    if (digitsOnly.length < PHONE_DIGITS_MIN || digitsOnly.length > PHONE_DIGITS_MAX) {
        return { ok: false, message: `Enter a valid ${opts.label} (${PHONE_DIGITS_MIN}-${PHONE_DIGITS_MAX} digits).`, normalized: null }
    }

    if (trimmed.length > 20) {
        return { ok: false, message: `${opts.label} must be 20 characters or fewer.`, normalized: null }
    }

    return { ok: true, normalized: trimmed }
}

// Validation helpers for branding
function validateBrandColor(color: string): { ok: boolean; message?: string } {
    const hexRegex = /^#(?:[0-9a-f]{3}){1,2}$/i
    if (!hexRegex.test(color)) {
        return { ok: false, message: 'Invalid color format. Use hex code (e.g., #FF6B6B)' }
    }
    return { ok: true }
}

function validateUrl(url: string | null): { ok: boolean; message?: string } {
    if (!url || url.length === 0) {
        return { ok: true } // Optional field
    }
    try {
        new URL(url)
        return { ok: true }
    } catch {
        return { ok: false, message: 'Invalid URL format' }
    }
}

function validateTagline(tagline: string | null): { ok: boolean; message?: string } {
    if (!tagline || tagline.length === 0) {
        return { ok: true } // Optional field
    }
    if (tagline.length > 150) {
        return { ok: false, message: 'Tagline must be 150 characters or less' }
    }
    return { ok: true }
}

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
        .maybeSingle() as ShopIdResult

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

    // If closure is disabled, soft delete any existing closure
    if (!isClosed) {
        const { error: deleteError } = await supabase
            .from('shop_closures')
            // @ts-ignore - Supabase service client type inference issue
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
        // @ts-ignore - Supabase service client type inference issue
        .update({ deleted_at: new Date().toISOString() })
        .eq('shop_id', shop.id)
        .is('deleted_at', null)

    // @ts-ignore - Supabase service client type inference issue
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
        .maybeSingle() as ShopIdResult

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

    // Update shop name
    const { error: updateError } = await supabase
        .from('shops')
        // @ts-ignore - Supabase service client type inference issue
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

export async function saveLunchBreakAction(lunchStart: string, lunchEnd: string) {
    const user = await requireAuth()
    const supabase = await createServerSupabaseClient()

    // Get shop
    const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .maybeSingle() as ShopIdResult

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

    // Validate lunch times if both provided
    if (lunchStart && lunchEnd) {
        if (lunchEnd <= lunchStart) {
            return {
                success: false,
                error: 'Lunch end time must be after lunch start time',
            }
        }
    }

    // If both are empty, clear lunch break
    const lunchStartValue = lunchStart ? lunchStart : null
    const lunchEndValue = lunchEnd ? lunchEnd : null

    // Update shop with lunch break times
    const { error: updateError } = await supabase
        .from('shops')
        // @ts-ignore - Supabase service client type inference issue
        .update({
            lunch_start: lunchStartValue,
            lunch_end: lunchEndValue,
        })
        .eq('id', shop.id)

    if (updateError) {
        console.error('Error updating lunch break:', updateError)
        return {
            success: false,
            error: 'Failed to save lunch break',
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
        .maybeSingle() as ShopIdResult

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

    // Map day names to day_of_week (0 = Sunday, 6 = Saturday)
    const dayMap: { [key: string]: number } = {
        Sunday: 0,
        Monday: 1,
        Tuesday: 2,
        Wednesday: 3,
        Thursday: 4,
        Friday: 5,
        Saturday: 6,
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
        // @ts-ignore - Supabase service client type inference issue
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
        .maybeSingle() as ShopIdResult

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
            // @ts-ignore - Supabase service client type inference issue
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

export async function saveShopContactAction(phone: string | null, address: string | null) {
    const user = await requireAuth()
    const supabase = await createServerSupabaseClient()

    // Get shop
    const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .maybeSingle() as ShopIdResult

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

    // Validate phone (required for shop)
    const phoneResult = validatePhone(phone, { label: 'shop phone', required: true })
    if (!phoneResult.ok) {
        return {
            success: false,
            error: phoneResult.message || 'Invalid phone',
        }
    }

    // Validate address (optional, trim if provided)
    const normalizedAddress = address && address.trim().length > 0 ? address.trim() : null

    // Update shop contact info
    const { error: updateError } = await supabase
        .from('shops')
        // @ts-ignore - Supabase service client type inference issue
        .update({
            phone: phoneResult.normalized,
            address: normalizedAddress,
        })
        .eq('id', shop.id)

    if (updateError) {
        console.error('Error updating shop contact:', updateError)
        return {
            success: false,
            error: 'Failed to update shop contact',
        }
    }

    revalidatePath('/dashboard/edit-shop')
    return {
        success: true,
    }
}

export async function addBarberAction(name: string, phone: string | null) {
    const user = await requireAuth()
    const supabase = await createServerSupabaseClient()

    // Get shop
    const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .maybeSingle() as ShopIdResult

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

    // Validate barber name
    if (!name?.trim()) {
        return {
            success: false,
            error: 'Barber name is required',
        }
    }

    // Validate phone (optional for barbers)
    const phoneResult = validatePhone(phone, { label: 'barber phone', required: false })
    if (!phoneResult.ok) {
        return {
            success: false,
            error: phoneResult.message || 'Invalid phone',
        }
    }

    // Server-side check: Ensure shop has less than 2 active barbers
    const { data: existingBarbers, error: countError } = await supabase
        .from('barbers')
        .select('id')
        .eq('shop_id', shop.id)
        .eq('is_active', true)
        .is('deleted_at', null)

    if (countError) {
        console.error('Error counting barbers:', countError)
        return {
            success: false,
            error: 'Failed to check existing barbers',
        }
    }

    if (existingBarbers && existingBarbers.length >= 2) {
        return {
            success: false,
            error: 'You can only have a maximum of 2 active barbers per shop',
        }
    }

    // Insert new barber
    // @ts-expect-error - Supabase type inference issue
    const { error: insertError } = await supabase.from('barbers').insert({
        shop_id: shop.id,
        name: name.trim(),
        phone: phoneResult.normalized,
        is_active: true,
    })

    if (insertError) {
        console.error('Error creating barber:', insertError)
        // Check if error is about max barbers constraint
        if (insertError.message?.includes('Maximum 2 active barbers')) {
            return {
                success: false,
                error: 'You can only have a maximum of 2 active barbers per shop',
            }
        }
        return {
            success: false,
            error: 'Failed to create barber',
        }
    }

    revalidatePath('/dashboard/edit-shop')
    return {
        success: true,
    }
}

export async function saveBrandingAction(
    brandColor: string,
    logoUrl: string | null,
    tagline: string | null,
    splashImageUrl: string | null
) {
    const user = await requireAuth()
    const supabase = await createServerSupabaseClient()

    // Validate brand color
    const colorValidation = validateBrandColor(brandColor)
    if (!colorValidation.ok) {
        return { success: false, error: colorValidation.message }
    }

    // Validate logo URL
    const logoValidation = validateUrl(logoUrl)
    if (!logoValidation.ok) {
        return { success: false, error: logoValidation.message }
    }

    // Validate splash image URL
    const splashValidation = validateUrl(splashImageUrl)
    if (!splashValidation.ok) {
        return { success: false, error: splashValidation.message }
    }

    // Validate tagline
    const taglineValidation = validateTagline(tagline)
    if (!taglineValidation.ok) {
        return { success: false, error: taglineValidation.message }
    }

    // Get shop
    const { data: shop, error: shopError } = await supabase
        .from('shops')
        .select('id, slug')
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .maybeSingle() as ShopIdResult

    if (shopError || !shop) {
        return { success: false, error: 'Shop not found' }
    }

    // CRITICAL SECURITY: Check subscription access
    const accessCheck = await checkSubscriptionAccess(shop.id)
    if (!accessCheck.allowed) {
        return {
            success: false,
            error: 'Your subscription is not active. Please contact support.',
        }
    }

    // Update branding fields
    const { error: updateError } = await supabase
        .from('shops')
        // @ts-expect-error - Supabase type inference issue
        .update({
            brand_color: brandColor,
            logo_url: logoUrl || null,
            tagline: tagline || null,
            splash_image_url: splashImageUrl || null,
        })
        .eq('id', shop.id)

    if (updateError) {
        console.error('Error updating branding:', updateError)
        return {
            success: false,
            error: 'Failed to save branding. Please try again.',
        }
    }

    revalidatePath('/dashboard/edit-shop')

    return { success: true }
}

