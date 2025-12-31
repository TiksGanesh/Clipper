export type SetupPendingShop = {
  shop_id: string
  shop_name: string
  owner_email: string | null
  owner_phone: string
  created_at: string
}

/**
 * Fetch latest setup-pending shops (no subscription row).
 * Returns up to 10 shops with owner email/phone, shop_id, shop_name, created_at.
 */
export async function getLatestSetupPendingShops(limit = 10): Promise<SetupPendingShop[]> {
  const supabase = await createServerSupabaseClient()

  // Get shops (not deleted)
  const { data: shops, error: shopsError } = await supabase
    .from('shops')
    .select('id, name, phone, created_at, owner_id')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit * 2)

  if (shopsError) throw shopsError
  if (!shops) return []

  // Get all shop ids
  const shopIds = shops.map((s) => s.id)
  // Get subscriptions for these shops
  const { data: subs, error: subsError } = await supabase
    .from('subscriptions')
    .select('shop_id')
    .in('shop_id', shopIds)
    .is('deleted_at', null)
  if (subsError) throw subsError
  const subShopIds = new Set(subs?.map((s) => s.shop_id) ?? [])

  // Filter to shops with no subscription
  const setupPending = shops.filter((shop) => !subShopIds.has(shop.id)).slice(0, limit)
  if (setupPending.length === 0) return []

  // Fetch owner emails from auth.users
  const ownerIds = setupPending.map((s) => s.owner_id)
  // Query auth.users for owner emails using RPC (if available)
  let ownerIdToEmail = new Map<string, string | null>()
  try {
    const { data: users, error: usersError } = await supabase.rpc('get_user_emails', { user_ids: ownerIds })
    if (usersError) throw usersError
    for (const user of users ?? []) {
      ownerIdToEmail.set(user.id, user.email ?? null)
    }
  } catch (e) {
    // If RPC not available, fallback to no email
    ownerIdToEmail = new Map()
  }

  return setupPending.map((shop) => ({
    shop_id: shop.id,
    shop_name: shop.name,
    owner_email: ownerIdToEmail.get(shop.owner_id) ?? null,
    owner_phone: shop.phone,
    created_at: shop.created_at,
  }))
}
import { createServerSupabaseClient } from '@/lib/supabase'

export type ShopAdminDashboardCounts = {
  total: number
  active: number
  trial: number
  suspended: number
  expired: number
  setup_pending: number
}

/**
 * Fetches shop counts for admin dashboard, grouped by lifecycle state.
 * - Uses server-side aggregation only.
 * - States: setup_pending, trial, active, suspended, expired
 */
export async function getShopAdminDashboardCounts(): Promise<ShopAdminDashboardCounts> {
  const supabase = await createServerSupabaseClient()

  // 1. Get all shops (not deleted)
  const { data: shops, error: shopsError } = await supabase
    .from('shops')
    .select('id')
    .is('deleted_at', null)

  if (shopsError) throw shopsError

  if (!shops || shops.length === 0) {
    return {
      total: 0,
      active: 0,
      trial: 0,
      suspended: 0,
      expired: 0,
      setup_pending: 0,
    }
  }

  // 2. Get subscriptions for all shops
  const { data: subs, error: subsError } = await supabase
    .from('subscriptions')
    .select('shop_id, status')
    .in('shop_id', shops.map((s) => s.id))
    .is('deleted_at', null)

  if (subsError) throw subsError

  // 3. Aggregate counts by state
  let trial = 0, active = 0, suspended = 0, expired = 0, setup_pending = 0
  const shopIdToStatus = new Map<string, string>()
  for (const sub of subs ?? []) {
    shopIdToStatus.set(sub.shop_id, sub.status)
  }
  for (const shop of shops) {
    const status = shopIdToStatus.get(shop.id)
    if (!status) {
      setup_pending++
    } else if (status === 'trial') {
      trial++
    } else if (status === 'active') {
      active++
    } else if (status === 'past_due' || status === 'canceled') {
      suspended++
    } else if (status === 'expired') {
      expired++
    }
  }
  return {
    total: shops.length,
    active,
    trial,
    suspended,
    expired,
    setup_pending,
  }
}
