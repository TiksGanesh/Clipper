'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createServerActionClient } from '@/lib/supabase'
import { checkSubscriptionAccess } from '@/lib/subscription-access'

const DASHBOARD_SERVICES_PATH = '/dashboard/services'

async function getShopIdForOwner() {
    const user = await requireAuth()
    const supabase = await createServerActionClient()

    const { data: shop } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .maybeSingle<{ id: string }>()

    if (!shop?.id) {
        redirect('/setup/shop')
    }

    // CRITICAL SECURITY: Check subscription access
    const accessCheck = await checkSubscriptionAccess(shop.id)
    if (!accessCheck.allowed) {
        throw new Error('Your subscription is not active. Please contact support.')
    }

    return { userId: user.id, shopId: shop.id, supabase }
}

export async function createServiceAction(formData: FormData) {
    const { shopId, supabase } = await getShopIdForOwner()

    const name = (formData.get('name') as string)?.trim()
    const duration = Number(formData.get('duration'))
    const price = Number(formData.get('price'))

    if (!name) {
        throw new Error('Service name is required')
    }

    const durationMinutes = Math.max(1, Math.floor(duration || 0))
    const priceValue = Number.isFinite(price) ? Math.max(0, price) : 0

    const { error } = await supabase
        .from('services')
        // @ts-expect-error - Supabase dynamic columns
        .insert({
            shop_id: shopId,
            name,
            duration_minutes: durationMinutes,
            price: priceValue,
            is_active: true,
        })

    if (error) {
        throw new Error(error.message)
    }

    revalidatePath(DASHBOARD_SERVICES_PATH)
}

export async function updateServiceAction(formData: FormData) {
    const { shopId, supabase } = await getShopIdForOwner()

    const id = (formData.get('id') as string)?.trim()
    const name = (formData.get('name') as string)?.trim()
    const duration = Number(formData.get('duration'))
    const price = Number(formData.get('price'))
    const isActive = formData.get('is_active') === 'on'

    if (!id) {
        throw new Error('Service ID is required')
    }
    if (!name) {
        throw new Error('Service name is required')
    }

    const durationMinutes = Math.max(1, Math.floor(duration || 0))
    const priceValue = Number.isFinite(price) ? Math.max(0, price) : 0

    const { error } = await supabase
        .from('services')
        // @ts-expect-error - Supabase dynamic columns
        .update({
            name,
            duration_minutes: durationMinutes,
            price: priceValue,
            is_active: isActive,
            deleted_at: null,
        })
        .eq('id', id)
        .eq('shop_id', shopId)

    if (error) {
        throw new Error(error.message)
    }

    revalidatePath(DASHBOARD_SERVICES_PATH)
}

export async function deleteServiceAction(formData: FormData) {
    const { shopId, supabase } = await getShopIdForOwner()

    const id = (formData.get('id') as string)?.trim()
    if (!id) {
        throw new Error('Service ID is required')
    }

    const deletedAt = new Date().toISOString()
    const { error } = await supabase
        .from('services')
        // @ts-expect-error - Supabase type inference issue
        .update({ deleted_at: deletedAt, is_active: false })
        .eq('id', id)
        .eq('shop_id', shopId)

    if (error) {
        throw new Error(error.message)
    }

    revalidatePath(DASHBOARD_SERVICES_PATH)
}
