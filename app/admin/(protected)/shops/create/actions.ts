'use server'

import { requireAdminContext } from '@/lib/auth'
import { createServiceSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'

const PHONE_DIGITS_MIN = 7
const PHONE_DIGITS_MAX = 15
const CREATE_ROUTE = '/admin/shops/create'

export async function createAdminShopAction(formData: FormData) {
    await requireAdminContext()
    const supabase = createServiceSupabaseClient()

    let createdOwnerId: string | null = null
    let createdShopId: string | null = null
    let ownerCreatedHere = false

    const fail = async (message: string, redirectPath: string = CREATE_ROUTE) => {
        await cleanupPartialCreation(supabase, { shopId: createdShopId, ownerId: createdOwnerId })
        redirect(`${redirectPath}?error=${encodeURIComponent(message)}`)
    }

    const name = (formData.get('name') as string)?.trim()
    const phone = (formData.get('phone') as string)?.trim()
    const address = ((formData.get('address') as string) || '').trim() || null
    const ownerEmail = (formData.get('owner_email') as string)?.trim()
    const ownerPassword = (formData.get('owner_password') as string)?.trim()
    const barberName = (formData.get('barber_name') as string)?.trim()
    const barberPhone = ((formData.get('barber_phone') as string) || '')?.trim() || null

    if (!name || !phone || !ownerEmail || !ownerPassword || !barberName) {
        await fail('Shop, owner, and barber details are required')
    }

    if (!isValidEmail(ownerEmail)) {
        await fail('Enter a valid owner email')
    }

    if (ownerPassword.length < 8) {
        await fail('Password must be at least 8 characters')
    }

    const shopPhoneResult = validatePhone(phone, { label: 'shop phone', required: true })
    if (!shopPhoneResult.ok) {
        await fail(shopPhoneResult.message)
    }

    const barberPhoneResult = validatePhone(barberPhone, { label: 'barber phone', required: false })
    if (!barberPhoneResult.ok) {
        await fail(barberPhoneResult.message)
    }

    const { id: existingOwnerId, error: ownerLookupError } = await safeFindUserIdByEmail(supabase, ownerEmail)
    if (ownerLookupError) {
        await fail(ownerLookupError)
    }

    let resolvedOwnerId = existingOwnerId

    // If owner exists, ensure not admin and not already owning a shop
    if (resolvedOwnerId) {
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
        const { data: created, error: createError } = await supabase.auth.admin.createUser({
            email: ownerEmail,
            password: ownerPassword,
            email_confirm: true,
        })

        if (createError || !created?.user) {
            // Retry-safe: if account already exists, reuse it
            const duplicateEmail = createError?.message?.toLowerCase().includes('already') || createError?.message?.toLowerCase().includes('exists')
            if (duplicateEmail) {
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

    // For fresh owners, set a known password
    const shouldSetPassword = ownerCreatedHere
    if (shouldSetPassword) {
        const { error: passwordError } = await supabase.auth.admin.updateUserById(resolvedOwnerId, {
            password: ownerPassword,
        })

        if (passwordError) {
            await fail('Unable to set owner password. Please try again.')
        }
    }

    let shopId: string | null = null

    const { data: existingShop, error: existingShopError } = await supabase
        .from('shops')
        .select('id, deleted_at')
        .eq('owner_id', resolvedOwnerId)
        .maybeSingle()

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
        const { data: inserted, error: insertError } = await supabase
            .from('shops')
            .insert({
                owner_id: resolvedOwnerId,
                name,
                phone: shopPhoneResult.normalized,
                address,
            })
            .select('id')
            .single()

        if (insertError || !inserted) {
            if (insertError?.code === '23505') {
                const fallbackShopId = await findShopIdByOwnerId(supabase, resolvedOwnerId)
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

    const { data: existingBarbers, error: existingBarbersError } = await supabase
        .from('barbers')
        .select('id, name, phone, deleted_at')
        .eq('shop_id', shopId)
        .is('deleted_at', null)

    if (existingBarbersError) {
        await fail('Unable to verify existing barbers for this shop.')
    }

    if (existingShop && existingBarbers && existingBarbers.length > 0) {
        const duplicate = existingBarbers.some((barber) => matchesBarber(barber, barberName, barberPhoneResult.normalized))
        if (duplicate) {
            redirect(`/admin/shops/${shopId}`)
        }

        await fail('Owner already has a shop. Update that record instead of creating another.')
    }

    if (existingShop && (!existingBarbers || existingBarbers.length === 0)) {
        const { error: updateError } = await supabase
            .from('shops')
            .update({ name, phone: shopPhoneResult.normalized, address })
            .eq('id', shopId)

        if (updateError) {
            await fail('Unable to refresh existing shop details.')
        }
    }

    const duplicateBarber = (existingBarbers || []).some((barber) => matchesBarber(barber, barberName, barberPhoneResult.normalized))
    if (duplicateBarber) {
        redirect(`/admin/shops/${shopId}`)
    }

    if ((existingBarbers?.length || 0) >= 2) {
        await fail('Shop already has the maximum number of barbers.')
    }

    const { error: barberError } = await supabase
        .from('barbers')
        .insert({
            shop_id: shopId,
            name: barberName,
            phone: barberPhoneResult.normalized,
            is_active: true,
        })

    if (barberError) {
        await fail('Shop created, but adding the barber failed. Please retry.')
    }

    redirect(`/admin/shops/${shopId}`)
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
        .maybeSingle()

    return data?.id ?? null
}

function matchesBarber(barber: { name: string; phone: string | null }, name: string, phone: string | null) {
    const normalizedExistingName = barber.name.trim().toLowerCase()
    const normalizedIncomingName = name.trim().toLowerCase()
    const normalizedExistingPhone = (barber.phone || '').replace(/\D/g, '')
    const normalizedIncomingPhone = (phone || '').replace(/\D/g, '')

    return normalizedExistingName === normalizedIncomingName && normalizedExistingPhone === normalizedIncomingPhone
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
