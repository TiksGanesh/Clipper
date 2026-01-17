
import { createServiceSupabaseClient } from "@/lib/supabase";
import type { Database } from "@/types/database";


export interface AdminShopDetail {
  shop_id: string;
  shop_name: string;
  slug: string;
  business_type: 'barber' | 'salon' | 'clinic';
  status: string;
  owner_email: string | null;
  owner_phone: string | null;
  created_at: string;
  subscription_start: string | null;
  subscription_end: string | null;
}


/**
 * Fetches core shop details for admin by shopId.
 * Throws error if not found.
 */
export async function getAdminShopDetailById(shopId: string): Promise<AdminShopDetail> {
  const supabase = createServiceSupabaseClient();

  // Restore joins for owner and subscription
  // Fetch shop and subscription in one query
  const { data, error } = await supabase
    .from("shops")
    .select(`
      id,
      name,
      slug,
      business_type,
      created_at,
      owner_id,
      subscription:subscriptions!subscriptions_shop_id_fkey(current_period_start, current_period_end, status)
    `)
    .eq("id", shopId)
    .limit(1)
    .single() as { 
      data: {
        id: string;
        name: string;
        slug: string;
        business_type: 'barber' | 'salon' | 'clinic';
        created_at: string;
        owner_id: string;
        subscription?: {
          current_period_start: string;
          current_period_end: string;
          status: string;
        } | null;
      } | null;
      error: any;
    }

  if (error) {
    // eslint-disable-next-line no-console
    console.error("Supabase error fetching shop detail (shop+subscription):", error);
  }

  if (error || !data) {
    throw Object.assign(new Error("Shop not found"), { status: 404 });
  }

  // Fetch owner info from auth.users (separate query)
  let owner_email: string | null = null;
  let owner_phone: string | null = null;
  try {
    // @ts-ignore - RPC function to get auth user data
    const { data: owner, error: ownerError } = await supabase.rpc('get_user_by_id', { user_id: data.owner_id });
    if (!ownerError && owner) {
      // @ts-ignore - owner type from RPC
      owner_email = owner.email ?? null;
      // @ts-ignore - owner type from RPC
      owner_phone = owner.phone ?? null;
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Supabase error fetching owner from auth.users:", e);
  }

  return {
    shop_id: data.id,
    shop_name: data.name,
    slug: data.slug,
    business_type: data.business_type,
    status: data.subscription?.status ?? "unknown",
    owner_email,
    owner_phone,
    created_at: data.created_at,
    subscription_start: data.subscription?.current_period_start ?? null,
    subscription_end: data.subscription?.current_period_end ?? null,
  };
}
