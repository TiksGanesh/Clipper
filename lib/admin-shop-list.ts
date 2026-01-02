export type AdminShopListResult = {
  items: AdminShopListItem[]
  total_count: number
  current_page: number
  has_next_page: boolean
}

const PAGE_SIZE = 20

/**
 * Fetch paginated, filtered shop list for admin with pagination info.
 */
export async function getAdminShopListWithPagination({ status, search, page = 1 }: AdminShopListParams & { page?: number }): Promise<AdminShopListResult> {
  const limit = PAGE_SIZE
  const offset = (page - 1) * PAGE_SIZE
  const items = await getAdminShopList({ status, search, limit, offset })

  // Get total count (with filters)
  const supabase = await createServerSupabaseClient()
  let shopQuery = supabase
    .from('shops')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
  if (search) {
    shopQuery = shopQuery.ilike('name', `%${search}%`)
  }
  const { count, error } = await shopQuery
  if (error) throw error

  // Filter by status in-memory (since status is derived)
  let filteredCount = count ?? 0
  if (status) {
    // Re-run getAdminShopList with no limit/offset to count all matching
    const allItems = await getAdminShopList({ status, search, limit: 10000, offset: 0 })
    filteredCount = allItems.length
  }

  return {
    items,
    total_count: filteredCount,
    current_page: page,
    has_next_page: offset + items.length < filteredCount,
  }
}
import { createServerSupabaseClient } from '@/lib/supabase'

export type AdminShopListItem = {
  shop_id: string
  shop_name: string
  owner_email: string | null
  owner_phone: string | null
  status: 'setup_pending' | 'trial' | 'active' | 'past_due' | 'canceled' | 'expired'
  subscription_end: string | null
  created_at: string
}

export type AdminShopListParams = {
  status?: 'setup_pending' | 'trial' | 'active' | 'suspended' | 'expired'
  search?: string
  limit?: number
  offset?: number
}

/**
 * Fetch paginated, filtered shop list for admin.
 * Supports status and search filters. Returns owner contact, status, sub end, created_at.
 */
export async function getAdminShopList({ status, search, limit = 20, offset = 0 }: AdminShopListParams): Promise<AdminShopListItem[]> {
  const supabase = await createServerSupabaseClient()

  // 1. Get all shops (not deleted)
  let shopQuery = supabase
    .from('shops')
    .select('id, name, phone, owner_id, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) {
    // Search by shop name or phone (owner email handled after join)
    shopQuery = shopQuery.ilike('name', `%${search}%`)
  }

  const { data: shops, error: shopsError } = await shopQuery as { 
    data: Array<{ 
      id: string; 
      name: string; 
      phone: string | null; 
      owner_id: string; 
      created_at: string 
    }> | null; 
    error: any 
  }
  if (shopsError) throw shopsError
  if (!shops || shops.length === 0) return []

  // 2. Get subscriptions for these shops
  const shopIds = shops.map((s) => s.id)
  const { data: subs, error: subsError } = await supabase
    .from('subscriptions')
    .select('shop_id, status, current_period_end')
    .in('shop_id', shopIds)
    .is('deleted_at', null) as { 
      data: Array<{ 
        shop_id: string; 
        status: string; 
        current_period_end: string | null 
      }> | null; 
      error: any 
    }
  if (subsError) throw subsError
  const subByShop = new Map<string, { status: string; current_period_end: string | null }>()
  for (const sub of subs ?? []) {
    subByShop.set(sub.shop_id, { status: sub.status, current_period_end: sub.current_period_end })
  }

  // 3. Fetch owner emails from auth.users (RPC or fallback)
  const ownerIds = shops.map((s) => s.owner_id)
  let ownerIdToEmail = new Map<string, string | null>()
  try {
    // @ts-ignore - RPC function parameter type
    const { data: users, error: usersError } = await supabase.rpc('get_user_emails', { user_ids: ownerIds })
    if (usersError) throw usersError
    // @ts-ignore - users type from RPC
    for (const user of users ?? []) {
      ownerIdToEmail.set(user.id, user.email ?? null)
    }
  } catch (e) {
    ownerIdToEmail = new Map()
  }

  // 4. Compose results, filter by status if needed
  const results: AdminShopListItem[] = []
  for (const shop of shops) {
    let shopStatus: AdminShopListItem['status'] = 'setup_pending'
    let subscription_end: string | null = null
    const sub = subByShop.get(shop.id)
    if (sub) {
      shopStatus = sub.status as AdminShopListItem['status']
      subscription_end = sub.current_period_end
    }
    if (status && shopStatus !== status) continue
    // Search by owner email/phone if search param present
    if (search) {
      const email = ownerIdToEmail.get(shop.owner_id) ?? ''
      if (!shop.name.toLowerCase().includes(search.toLowerCase()) &&
          !(shop.phone ?? '').includes(search) &&
          !email.toLowerCase().includes(search.toLowerCase())) {
        continue
      }
    }
    results.push({
      shop_id: shop.id,
      shop_name: shop.name,
      owner_email: ownerIdToEmail.get(shop.owner_id) ?? null,
      owner_phone: shop.phone,
      status: shopStatus,
      subscription_end,
      created_at: shop.created_at,
    })
  }
  return results
}
