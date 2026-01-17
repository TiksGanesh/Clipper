'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServiceSupabaseClient } from '@/lib/supabase'
import { requireAdminContext } from '@/lib/auth'

// Constants for trial extensions and reactivation
const TRIAL_EXTENSION_DAYS = 30
const REACTIVATION_EXTENSION_DAYS = 30

const BUSINESS_TYPES = ['barber', 'salon', 'clinic'] as const
type BusinessType = typeof BUSINESS_TYPES[number]

type ActionResult = {
    success: boolean
    message?: string
    error?: string
}

/**
 * Extend trial period by 30 days from current date
 * Keeps status as 'trial', useful when shop needs more evaluation time
 */
export async function extendTrialAction(shopId: string): Promise<ActionResult> {
    try {
        await requireAdminContext()
        const supabase = createServiceSupabaseClient()

        // Get current subscription
        const { data: subscription, error: fetchError } = await supabase
            .from('subscriptions')
            .select('id, status, trial_ends_at')
            .eq('shop_id', shopId)
            .is('deleted_at', null)
            .maybeSingle()

        if (fetchError || !subscription) {
            return { success: false, error: 'Subscription not found' }
        }

        // Calculate new trial end date (current date + 30 days)
        const newTrialEndDate = new Date()
        newTrialEndDate.setDate(newTrialEndDate.getDate() + TRIAL_EXTENSION_DAYS)

        // Update subscription
        const { error: updateError } = await supabase
            .from('subscriptions')
            // @ts-ignore - Supabase service client type inference issue
            .update({
                trial_ends_at: newTrialEndDate.toISOString(),
                current_period_end: newTrialEndDate.toISOString(),
                status: 'trial',
                updated_at: new Date().toISOString(),
            })
            .eq('shop_id', shopId)

        if (updateError) {
            return { success: false, error: `Failed to extend trial: ${updateError.message}` }
        }

        revalidatePath(`/book/${shopId}`)  // Add this line
        revalidatePath(`/admin/shops/${shopId}`)
        revalidatePath('/admin/shops')
        revalidatePath('/admin/dashboard')

        return {
            success: true,
            message: `Trial extended by ${TRIAL_EXTENSION_DAYS} days until ${newTrialEndDate.toLocaleDateString()}`,
        }
    } catch (error) {
        console.error('extendTrialAction error:', error)
        return { success: false, error: 'Failed to extend trial. Please try again.' }
    }
}

/**
 * Set custom subscription dates and activate subscription
 * Allows admin to manually set billing period (e.g., after offline payment)
 */
export async function setSubscriptionDatesAction(
    shopId: string,
    startDate: string,
    endDate: string
): Promise<ActionResult> {
    try {
        await requireAdminContext()
        const supabase = createServiceSupabaseClient()

        // Validate dates
        const start = new Date(startDate)
        const end = new Date(endDate)

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return { success: false, error: 'Invalid date format' }
        }

        if (end <= start) {
            return { success: false, error: 'End date must be after start date' }
        }

        // Get current subscription
        const { data: subscription, error: fetchError } = await supabase
            .from('subscriptions')
            .select('id')
            .eq('shop_id', shopId)
            .is('deleted_at', null)
            .maybeSingle()

        if (fetchError || !subscription) {
            return { success: false, error: 'Subscription not found' }
        }

        // Update subscription with custom dates and activate
        const { error: updateError } = await supabase
            .from('subscriptions')
            // @ts-ignore - Supabase service client type inference issue
            .update({
                current_period_start: start.toISOString(),
                current_period_end: end.toISOString(),
                trial_ends_at: null,
                status: 'active',
                canceled_at: null,
                updated_at: new Date().toISOString(),
            })
            .eq('shop_id', shopId)

        if (updateError) {
            return { success: false, error: `Failed to update dates: ${updateError.message}` }
        }

        revalidatePath(`/book/${shopId}`)  // Add this line
        revalidatePath(`/admin/shops/${shopId}`)
        revalidatePath('/admin/shops')
        revalidatePath('/admin/dashboard')

        return {
            success: true,
            message: `Subscription activated from ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`,
        }
    } catch (error) {
        console.error('setSubscriptionDatesAction error:', error)
        return { success: false, error: 'Failed to update subscription dates. Please try again.' }
    }
}

/**
 * Reactivate a suspended/expired/canceled shop
 * Changes status to 'active' and extends period by 30 days to give time for payment setup
 */
export async function reactivateShopAction(shopId: string): Promise<ActionResult> {
    try {
        await requireAdminContext()
        const supabase = createServiceSupabaseClient()

        // Get current subscription
        const { data: subscription, error: fetchError } = await supabase
            .from('subscriptions')
            .select('id, status')
            .eq('shop_id', shopId)
            .is('deleted_at', null)
            .maybeSingle()

        if (fetchError || !subscription) {
            return { success: false, error: 'Subscription not found' }
        }

        // Calculate new end date (today + 30 days grace period)
        const now = new Date()
        const newEndDate = new Date()
        newEndDate.setDate(newEndDate.getDate() + REACTIVATION_EXTENSION_DAYS)

        // Reactivate subscription
        const { error: updateError } = await supabase
            .from('subscriptions')
            // @ts-ignore - Supabase service client type inference issue
            .update({
                status: 'active',
                current_period_start: now.toISOString(),
                current_period_end: newEndDate.toISOString(),
                canceled_at: null,
                updated_at: new Date().toISOString(),
            })
            .eq('shop_id', shopId)

        if (updateError) {
            return { success: false, error: `Failed to reactivate shop: ${updateError.message}` }
        }

        revalidatePath(`/book/${shopId}`)  // Add this line
        revalidatePath(`/admin/shops/${shopId}`)
        revalidatePath('/admin/shops')
        revalidatePath('/admin/dashboard')

        return {
            success: true,
            message: `Shop reactivated until ${newEndDate.toLocaleDateString()} (${REACTIVATION_EXTENSION_DAYS} days grace period)`,
        }
    } catch (error) {
        console.error('reactivateShopAction error:', error)
        return { success: false, error: 'Failed to reactivate shop. Please try again.' }
    }
}

/**
 * Update shop business type (enum: barber | salon | clinic)
 */
export async function updateBusinessTypeAction(formData: FormData) {
    await requireAdminContext()
    const supabase = createServiceSupabaseClient()

    const shopId = String(formData.get('shopId') || '').trim()
    const businessType = String(formData.get('businessType') || '').trim() as BusinessType

    if (!shopId) {
        throw new Error('Shop ID is required')
    }

    if (!BUSINESS_TYPES.includes(businessType)) {
        throw new Error('Invalid business type')
    }

    const { error } = await supabase
        .from('shops')
        // @ts-ignore service client type inference
        .update({ business_type: businessType, updated_at: new Date().toISOString() })
        .eq('id', shopId)
        .is('deleted_at', null)

    if (error) {
        throw new Error(`Failed to update business type: ${error.message}`)
    }

    revalidatePath(`/admin/shops/${shopId}`)
    revalidatePath('/admin/shops')
    revalidatePath(`/book/${shopId}`)

    redirect(`/admin/shops/${shopId}?success=Business%20type%20updated`)
}

/**
 * Update shop slug (unique, max 25 chars, alphanumeric + hyphen only)
 */
export async function updateShopSlugAction(formData: FormData) {
    await requireAdminContext()
    const supabase = createServiceSupabaseClient()

    const shopId = String(formData.get('shopId') || '').trim()
    const slug = String(formData.get('slug') || '').trim().toLowerCase()

    if (!shopId) {
        throw new Error('Shop ID is required')
    }

    if (!slug) {
        throw new Error('Slug is required')
    }

    // Validate slug format: max 25 chars, alphanumeric + hyphen only
    if (slug.length > 25) {
        throw new Error('Slug must be 25 characters or less')
    }

    if (!/^[a-z0-9-]+$/.test(slug)) {
        throw new Error('Slug can only contain lowercase letters, numbers, and hyphens')
    }

    if (slug.startsWith('-') || slug.endsWith('-')) {
        throw new Error('Slug cannot start or end with a hyphen')
    }

    // Check for uniqueness
    const { data: existing } = await supabase
        .from('shops')
        .select('id')
        .eq('slug', slug)
        .neq('id', shopId)
        .is('deleted_at', null)
        .maybeSingle()

    if (existing) {
        throw new Error('This slug is already taken by another shop')
    }

    // Update slug
    const { error } = await supabase
        .from('shops')
        // @ts-ignore service client type inference
        .update({ slug, updated_at: new Date().toISOString() })
        .eq('id', shopId)
        .is('deleted_at', null)

    if (error) {
        throw new Error(`Failed to update slug: ${error.message}`)
    }

    revalidatePath(`/admin/shops/${shopId}`)
    revalidatePath('/admin/shops')
    revalidatePath(`/book/${shopId}`)
    revalidatePath(`/shop/${slug}`)

    redirect(`/admin/shops/${shopId}?success=Slug%20updated`)
}

/**
 * Suspend shop - blocks bookings but preserves data
 * Use for payment issues or temporary policy violations
 * Sets status to 'canceled' without setting canceled_at (can be reactivated)
 */
export async function suspendShopAction(shopId: string): Promise<ActionResult> {
    try {
        await requireAdminContext()
        const supabase = createServiceSupabaseClient()

        // Get current subscription
        const { data: subscription, error: fetchError } = await supabase
            .from('subscriptions')
            .select('id, status')
            .eq('shop_id', shopId)
            .is('deleted_at', null)
            .maybeSingle()

        if (fetchError || !subscription) {
            return { success: false, error: 'Subscription not found' }
        }

        if ((subscription as any).status === 'canceled') {
            return { success: false, error: 'Shop is already suspended/canceled' }
        }

        // Suspend subscription by setting to canceled (but without canceled_at for potential reactivation)
        const { error: updateError } = await supabase
            .from('subscriptions')
            // @ts-ignore - Supabase service client type inference issue
            .update({
                status: 'canceled',
                updated_at: new Date().toISOString(),
            })
            .eq('shop_id', shopId)

        if (updateError) {
            return { success: false, error: `Failed to suspend shop: ${updateError.message}` }
        }

        revalidatePath(`/book/${shopId}`)  // Add this line
        revalidatePath(`/admin/shops/${shopId}`)
        revalidatePath('/admin/shops')
        revalidatePath('/admin/dashboard')

        return {
            success: true,
            message: 'Shop suspended. All bookings are now blocked.',
        }
    } catch (error) {
        console.error('suspendShopAction error:', error)
        return { success: false, error: 'Failed to suspend shop. Please try again.' }
    }
}

/**
 * Emergency disable - hardest block for fraud/severe violations
 * Sets status to 'canceled' and records cancellation timestamp
 */
export async function emergencyDisableAction(shopId: string): Promise<ActionResult> {
    try {
        await requireAdminContext()
        const supabase = createServiceSupabaseClient()

        // Get current subscription
        const { data: subscription, error: fetchError } = await supabase
            .from('subscriptions')
            .select('id, status')
            .eq('shop_id', shopId)
            .is('deleted_at', null)
            .maybeSingle()

        if (fetchError || !subscription) {
            return { success: false, error: 'Subscription not found' }
        }

        if ((subscription as any).status === 'canceled') {
            return { success: false, error: 'Shop is already canceled' }
        }

        const now = new Date()

        // Cancel subscription immediately
        const { error: updateError } = await supabase
            .from('subscriptions')
            // @ts-ignore - Supabase service client type inference issue
            .update({
                status: 'canceled',
                canceled_at: now.toISOString(),
                current_period_end: now.toISOString(),
                updated_at: now.toISOString(),
            })
            .eq('shop_id', shopId)

        if (updateError) {
            return { success: false, error: `Failed to cancel shop: ${updateError.message}` }
        }

        revalidatePath(`/book/${shopId}`)  // Add this line
        revalidatePath(`/admin/shops/${shopId}`)
        revalidatePath('/admin/shops')
        revalidatePath('/admin/dashboard')

        return {
            success: true,
            message: 'Shop canceled immediately. All access blocked.',
        }
    } catch (error) {
        console.error('emergencyDisableAction error:', error)
        return { success: false, error: 'Failed to cancel shop. Please try again.' }
    }
}
