'use server'

import { requireAdminContext } from '@/lib/auth'
import { createServiceSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { createTrialSubscription } from '@/lib/subscriptions'

const PHONE_DIGITS_MIN = 7
const PHONE_DIGITS_MAX = 15
const CREATE_ROUTE = '/admin/shops/create'

export async function createAdminShopAction(formData: FormData) {
    console.log('[createAdminShopAction] START - FormData keys:', Array.from(formData.keys()))
    
    await requireAdminContext()
    const supabase = createServiceSupabaseClient()

    let createdOwnerId: string | null = null
    let createdShopId: string | null = null
    let ownerCreatedHere = false

    const fail = async (message: string, redirectPath: string = CREATE_ROUTE) => {
        console.log('[createAdminShopAction] FAIL:', message)
        await cleanupPartialCreation(supabase, { shopId: createdShopId, ownerId: createdOwnerId })
        redirect(`${redirectPath}?error=${encodeURIComponent(message)}`)
    }

    // Helper to get field value, handling both direct and numbered field names
    const getFieldValue = (name: string): string | null => {
        let value = formData.get(name) as string | null
        if (!value) {
            // Try numbered variant (e.g., "1_name" for "name")
            value = formData.get(`1_${name}`) as string | null
        }
        return value
    }

    // Validate only allowed fields are present
    const allowedFields = ['name', 'owner_email', 'owner_password', 'owner_phone']
    const submittedFields = Array.from(formData.keys()).filter(field => !field.match(/^\d+$|^\$K\d+$/)) // Ignore numeric indices and React keys
    const unsupportedFields = submittedFields
        .map(field => field.replace(/^1_/, '')) // Remove the numeric prefix for validation
        .filter(field => !allowedFields.includes(field))
    
    if (unsupportedFields.length > 0) {
        await fail('Unsupported fields detected. Only shop name, owner email, owner password, and owner phone are allowed.')
    }

    const name = (getFieldValue('name') as string)?.trim()
    const ownerEmail = (getFieldValue('owner_email') as string)?.trim()
    const ownerPassword = (getFieldValue('owner_password') as string)?.trim()
    const ownerPhone = ((getFieldValue('owner_phone') as string) || '')?.trim() || null

    console.log('[createAdminShopAction] Extracted fields:', {
        name: name ? '***' : 'MISSING',
        ownerEmail,
        ownerPassword: ownerPassword ? '***' : 'MISSING',
        ownerPhone
    })

    if (!name || !ownerEmail || !ownerPassword) {
        await fail('Shop name, owner email, and owner password are required')
    }

    if (!isValidEmail(ownerEmail)) {
        await fail('Enter a valid owner email')
    }

    if (ownerPassword.length < 8) {
        await fail('Password must be at least 8 characters')
    }

    const ownerPhoneResult = validatePhone(ownerPhone, { label: 'owner phone', required: false })
    if (!ownerPhoneResult.ok) {
        await fail(ownerPhoneResult.message || 'Invalid owner phone')
    }

    const { id: existingOwnerId, error: ownerLookupError } = await safeFindUserIdByEmail(supabase, ownerEmail)
    console.log('[createAdminShopAction] Owner lookup:', { found: !!existingOwnerId, error: ownerLookupError })
    
    if (ownerLookupError) {
        await fail(ownerLookupError)
    }

    let resolvedOwnerId = existingOwnerId

    // If owner exists, ensure not admin and not already owning a shop
    if (resolvedOwnerId) {
        console.log('[createAdminShopAction] Checking if owner is admin:', resolvedOwnerId)
        const { data: adminMembership, error: adminCheckError } = await supabase
            .from('admin_users')
            .select('user_id')
            .eq('user_id', resolvedOwnerId)
            .maybeSingle()

        if (adminCheckError) {
            await fail('Unable to verify owner role. Please try again.')
        }

        if (adminMembership) {
            await fail('Admin users cannot own shops')
        }

    }

    // If owner does not exist, create the account (email invite disabled for now)
    if (!resolvedOwnerId) {
        console.log('[createAdminShopAction] Creating new owner account:', ownerEmail)
        const { data: created, error: createError } = await supabase.auth.admin.createUser({
            email: ownerEmail,
            password: ownerPassword,
            email_confirm: true,
        })

        console.log('[createAdminShopAction] Owner creation result:', {
            success: !!created?.user?.id,
            error: createError?.message,
            userId: created?.user?.id
        })

        if (createError || !created?.user) {
            // Retry-safe: if account already exists, reuse it
            const duplicateEmail = createError?.message?.toLowerCase().includes('already') || createError?.message?.toLowerCase().includes('exists')
            if (duplicateEmail) {
                console.log('[createAdminShopAction] Duplicate email detected, retrying lookup')
                const { id: fallbackOwnerId } = await safeFindUserIdByEmail(supabase, ownerEmail)
                if (fallbackOwnerId) {
                    resolvedOwnerId = fallbackOwnerId
                }
            }

            if (!resolvedOwnerId) {
                await fail('Unable to create owner account. Please try again with a different email.')
            }
        }
        if (!resolvedOwnerId && created?.user?.id) {
            resolvedOwnerId = created.user.id
            ownerCreatedHere = true
        }

        if (ownerCreatedHere) {
            createdOwnerId = resolvedOwnerId
        }
    }

    if (!resolvedOwnerId) {
        await fail('Unable to resolve owner account for this shop.')
    }

    // TypeScript assertion: resolvedOwnerId is guaranteed to be string here due to above check
    const ownerId = resolvedOwnerId as string
    console.log('[createAdminShopAction] Resolved owner ID:', ownerId)

    // For fresh owners, set a known password
    const shouldSetPassword = ownerCreatedHere
    if (shouldSetPassword) {
        console.log('[createAdminShopAction] Setting password for new owner')
        const { error: passwordError } = await supabase.auth.admin.updateUserById(ownerId, {
            password: ownerPassword,
        })

        if (passwordError) {
            console.log('[createAdminShopAction] Password error:', passwordError)
            await fail('Unable to set owner password. Please try again.')
        }
    }

    let shopId: string | null = null

    console.log('[createAdminShopAction] Checking for existing shops for owner:', ownerId)
    const { data: existingShop, error: existingShopError } = await supabase
        .from('shops')
        .select('id, deleted_at')
        .eq('owner_id', ownerId)
        .maybeSingle() as { data: { id: string; deleted_at: string | null } | null; error: any }

    console.log('[createAdminShopAction] Existing shop check:', { found: !!existingShop, error: existingShopError })

    if (existingShopError) {
        await fail('Unable to verify existing shops for this owner.')
    }

    if (existingShop?.deleted_at) {
        await fail('Owner already has an archived shop. Restore it instead of creating a new one.')
    }

    if (existingShop?.id) {
        shopId = existingShop.id
    }

    if (!shopId) {
        console.log('[createAdminShopAction] Creating new shop with data:', { name, ownerId })
        const { data: inserted, error: insertError } = (await supabase
            .from('shops')
            // @ts-ignore - Supabase service client type inference issue
            .insert({
                owner_id: ownerId,
                name,
                phone: ownerPhoneResult.normalized,
                address: null,
            })
            .select('id')
            .single()) as { data: { id: string } | null; error: any }

        console.log('[createAdminShopAction] Shop insert result:', {
            success: !!inserted?.id,
            error: insertError?.message,
            code: insertError?.code,
            shopId: inserted?.id
        })

        if (insertError || !inserted) {
            if (insertError?.code === '23505') {
                console.log('[createAdminShopAction] Duplicate key, attempting fallback lookup')
                const fallbackShopId = await findShopIdByOwnerId(supabase, ownerId)
                if (fallbackShopId) {
                    shopId = fallbackShopId
                }
            }

            if (!shopId) {
                await fail('Unable to create shop. Please try again.')
            }
        } else {
            shopId = inserted.id
            createdShopId = inserted.id
        }
    }

    if (!shopId) {
        await fail('Unable to resolve shop for this owner.')
    }

    // TypeScript assertion: shopId is guaranteed to be string here due to above check
    const finalShopId = shopId as string
    console.log('[createAdminShopAction] Final shop ID:', finalShopId)

    console.log('[createAdminShopAction] Checking for existing barbers')
    const { data: existingBarbers, error: existingBarbersError } = await supabase
        .from('barbers')
        .select('id, name, phone, deleted_at')
        .eq('shop_id', finalShopId)
        .is('deleted_at', null)

    if (existingBarbersError) {
        await fail('Unable to verify existing barbers for this shop.')
    }

    // If shop exists and has barbers, redirect to it
    if (existingShop && existingBarbers && existingBarbers.length > 0) {
        console.log('[createAdminShopAction] Shop already exists with barbers, redirecting')
        redirect(`/admin/shops/${finalShopId}`)
    }

    // If owner already has a shop without barbers, fail (don't want duplicate shops per owner)
    if (existingShop && (!existingBarbers || existingBarbers.length === 0)) {
        await fail('Owner already has a shop. Update that record instead of creating another.')
    }

    // Create trial subscription for the shop
    console.log('[createAdminShopAction] Creating trial subscription for shop:', finalShopId)
    await createTrialSubscription(finalShopId)
    console.log('[createAdminShopAction] SUCCESS - Shop created:', finalShopId)

    redirect(`/admin/shops/${finalShopId}?success=${encodeURIComponent('Shop created successfully')}`)
}

async function safeFindUserIdByEmail(supabase: ReturnType<typeof createServiceSupabaseClient>, email: string) {
    const normalized = email.toLowerCase()
    const perPage = 100
    for (let page = 1; page <= 10; page++) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
        if (error) {
            return { id: null, error: 'Unable to verify owner account. Please try again.' }
        }

        const found = data?.users?.find((u) => (u.email || '').toLowerCase() === normalized)
        if (found) return { id: found.id, error: undefined }

        if (!data || data.users.length < perPage) break
    }
    return { id: null, error: undefined }
}

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

function isValidEmail(email: string) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailPattern.test(email)
}

async function findShopIdByOwnerId(supabase: ReturnType<typeof createServiceSupabaseClient>, ownerId: string) {
    const { data } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', ownerId)
        .maybeSingle() as { data: { id: string } | null }

    return data?.id ?? null
}

async function cleanupPartialCreation(
    supabase: ReturnType<typeof createServiceSupabaseClient>,
    context: { shopId: string | null; ownerId: string | null }
) {
    try {
        if (context.shopId) {
            await supabase.from('barbers').delete().eq('shop_id', context.shopId)
            await supabase.from('shops').delete().eq('id', context.shopId)
        }

        if (context.ownerId) {
            await supabase.auth.admin.deleteUser(context.ownerId)
        }
    } catch (err) {
        // Best-effort cleanup; suppress errors to avoid masking the original issue
        console.error('Cleanup failed', err)
    }
}
