'use server'

import { requireAuth } from '@/lib/auth'
import { createServerActionClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import type { Database } from '@/types/database'

const days = [
    { key: 0, label: 'Sunday' },
    { key: 1, label: 'Monday' },
    { key: 2, label: 'Tuesday' },
    { key: 3, label: 'Wednesday' },
    { key: 4, label: 'Thursday' },
    { key: 5, label: 'Friday' },
    { key: 6, label: 'Saturday' },
]

export async function createShopAction(formData: FormData) {
    const user = await requireAuth()
    const supabase = await createServerActionClient()

    const { data: adminMembership } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()

    if (adminMembership) {
        redirect('/admin/dashboard')
    }

    const name = (formData.get('name') as string)?.trim()
    const phone = (formData.get('phone') as string)?.trim()
    const address = (formData.get('address') as string)?.trim() || null

    if (!name || !phone) {
        redirect('/setup/shop?error=' + encodeURIComponent('Shop name and phone are required'))
    }

    // Try to update existing shop first
    const { data: updated, error: updateError } = await supabase
        .from('shops')
        // @ts-expect-error - Supabase type inference issue
        .update({
            name,
            phone,
            address,
            deleted_at: null,
        })
        .eq('owner_id', user.id)
        .select()

    // If update succeeded (found and updated a row), we're done
    if (!updateError && updated && updated.length > 0) {
        redirect('/setup/barbers')
    }

    // If update didn't find any rows (not an error, just nothing to update), try insert
    if (!updateError && (!updated || updated.length === 0)) {
        // @ts-expect-error - Supabase type inference issue
        const { error: insertError } = await supabase.from('shops').insert({
            owner_id: user.id,
            name,
            phone,
            address,
        })

        if (insertError) {
            // If insert fails due to duplicate, that's OK - means another request created it
            if (insertError.code === '23505') {
                redirect('/setup/barbers')
            }
            // Show actual error in development for debugging
            const errorMsg = process.env.NODE_ENV === 'development' 
                ? `Database error: ${insertError.message} (Code: ${insertError.code})`
                : 'Unable to create shop. Please try again.'
            redirect('/setup/shop?error=' + encodeURIComponent(errorMsg))
        }

        redirect('/setup/barbers')
    }

    // If there was an actual update error
    if (updateError) {
        const errorMsg = process.env.NODE_ENV === 'development'
            ? `Database error: ${updateError.message} (Code: ${updateError.code})`
            : 'Unable to save shop. Please try again.'
        redirect('/setup/shop?error=' + encodeURIComponent(errorMsg))
    }

    redirect('/setup/barbers')
}

export async function saveBarbersAction(formData: FormData) {
    const user = await requireAuth()
    const supabase = await createServerActionClient()

    const { data: adminMembership } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()

    if (adminMembership) {
        redirect('/admin/dashboard')
    }

    // Get shop_id for this user
    const { data: shop } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .maybeSingle<{ id: string }>()

    if (!shop?.id) {
        redirect('/setup/shop')
    }

    const names = [
        (formData.get('barber1') as string)?.trim(),
        (formData.get('barber2') as string)?.trim(),
    ].filter(Boolean) as string[]

    const phones = [
        (formData.get('phone1') as string)?.trim(),
        (formData.get('phone2') as string)?.trim(),
    ]

    if (names.length === 0) {
        throw new Error('Add at least one barber')
    }

    if (names.length > 2) {
        throw new Error('Maximum 2 barbers allowed')
    }

    // Delete existing barbers for idempotency (handles admin-seeded shops and re-runs)
    const { error: deleteError } = await supabase
        .from('barbers')
        .delete()
        .eq('shop_id', shop.id)

    if (deleteError) {
        throw new Error(`Failed to clear existing barbers: ${deleteError.message}`)
    }

    const rows = names.map((name, idx) => ({
        shop_id: shop.id,
        name,
        phone: phones[idx] || null,
        is_active: true,
    }))

    // @ts-expect-error - Supabase type inference issue
    const { error: insertError } = await supabase.from('barbers').insert(rows)
    if (insertError) {
        throw new Error(insertError.message)
    }

    redirect('/setup/hours')
}

export async function saveHoursAction(formData: FormData) {
    const user = await requireAuth()
    const supabase = await createServerActionClient()

    const { data: adminMembership } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()

    if (adminMembership) {
        redirect('/admin/dashboard')
    }

    const { data: shop } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .maybeSingle<{ id: string }>()

    if (!shop?.id) {
        redirect('/setup/shop')
    }

    const rows = days.map((d) => {
        const isClosed = formData.get(`closed_${d.key}`) === 'on'
        const open = (formData.get(`open_${d.key}`) as string) || null
        const close = (formData.get(`close_${d.key}`) as string) || null
        return {
            shop_id: shop.id,
            day_of_week: d.key,
            is_closed: isClosed,
            open_time: isClosed ? null : (open ? `${open}:00` : null),
            close_time: isClosed ? null : (close ? `${close}:00` : null),
        }
    })

    // Upsert working hours for all days
    const { error } = await supabase
        .from('working_hours')
        // @ts-expect-error - Supabase type inference issue
        .upsert(rows, { onConflict: 'shop_id,day_of_week' })

    if (error) {
        throw new Error(error.message)
    }

    redirect('/setup/services')
}

export async function saveServicesAction(formData: FormData) {
    const user = await requireAuth()
    const supabase = await createServerActionClient()

    const { data: adminMembership } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()

    if (adminMembership) {
        redirect('/admin/dashboard')
    }

    const { data: shop } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .maybeSingle<{ id: string }>()

    if (!shop?.id) {
        redirect('/setup/shop')
    }

    const ids = formData.getAll('service_id').map((v) => (v as string).trim()).filter(Boolean)
    const names = formData.getAll('service_name').map((v) => (v as string).trim())
    const durations = formData.getAll('service_duration').map((v) => Number(v))
    const prices = formData.getAll('service_price').map((v) => Number(v))

    // Build rows while filtering out empty names; keep index alignment via original arrays
    const rows: Database['public']['Tables']['services']['Insert'][] = []
    names.forEach((name, idx) => {
        if (!name) return
        const row: Database['public']['Tables']['services']['Insert'] = {
            shop_id: shop.id,
            name,
            duration_minutes: Math.max(1, Math.floor(durations[idx] || 0)),
            price: Math.max(0, prices[idx] || 0),
            is_active: true,
        }
        const existingId = ids[idx]
        if (existingId) {
            row.id = existingId
        }
        rows.push(row)
    })

    if (rows.length === 0) {
        throw new Error('Add at least one service')
    }

    // Upsert to avoid duplicate rows when setup is revisited
    const { error } = await supabase
        .from('services')
        // @ts-expect-error - Supabase type inference issue
        .upsert(rows, { onConflict: 'id' })

    if (error) {
        throw new Error(error.message)
    }

    redirect('/dashboard')
}
