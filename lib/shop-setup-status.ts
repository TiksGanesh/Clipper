import { createServiceSupabaseClient } from "@/lib/supabase";

export interface ShopSetupStatus {
  barbersConfigured: boolean;
  servicesConfigured: boolean;
  hoursConfigured: boolean;
  isSetupComplete: boolean;
}

/**
 * Computes shop setup completeness for admin/shop details.
 * Checks for at least 1 barber (max 2), at least 1 service, and working hours configured.
 */
export async function getShopSetupStatus(shopId: string): Promise<ShopSetupStatus> {
  const supabase = createServiceSupabaseClient();

  // Barbers: at least 1, max 2
  const { count: barberCount } = await supabase
    .from("barbers")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId)
    .is("deleted_at", null);

  // Services: at least 1
  const { count: serviceCount } = await supabase
    .from("services")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId)
    .is("deleted_at", null)
    .eq("is_active", true);

  // Working hours: at least 1 row
  const { count: hoursCount } = await supabase
    .from("working_hours")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId);

  const barbersConfigured = (barberCount ?? 0) >= 1 && (barberCount ?? 0) <= 2;
  const servicesConfigured = (serviceCount ?? 0) >= 1;
  const hoursConfigured = (hoursCount ?? 0) >= 1;
  const isSetupComplete = barbersConfigured && servicesConfigured && hoursConfigured;

  return {
    barbersConfigured,
    servicesConfigured,
    hoursConfigured,
    isSetupComplete,
  };
}
