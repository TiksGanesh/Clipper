import { createServerSupabaseClient } from "@/lib/supabase";

export interface ShopBarber {
  id: string;
  name: string;
  phone: string | null;
}

export interface ShopService {
  id: string;
  name: string;
  duration_minutes: number;
  advance_amount: number;
}

export interface ShopWorkingHour {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

export interface ShopBooking {
  id: string;
  barber_id: string;
  service_id: string;
  customer_name: string;
  customer_phone: string;
  start_time: string;
  end_time: string;
  status: string;
  is_walk_in: boolean;
}

export interface ShopRelatedData {
  barbers: ShopBarber[];
  services: ShopService[];
  workingHours: ShopWorkingHour[];
  recentBookings: ShopBooking[];
}

/**
 * Fetches related shop data for admin/shop details (read-only, limited size).
 */
export async function getShopRelatedData(shopId: string): Promise<ShopRelatedData> {
  const supabase = await createServerSupabaseClient();

  // Barbers (max 2)
  const { data: barbers = [] } = await supabase
    .from("barbers")
    .select("id, name, phone")
    .eq("shop_id", shopId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(2);

  // Services (max 10)
  const { data: services = [] } = await supabase
    .from("services")
    .select("id, name, duration_minutes, advance_amount")
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(10);

  // Working hours (summary, max 7)
  const { data: workingHours = [] } = await supabase
    .from("working_hours")
    .select("day_of_week, open_time, close_time, is_closed")
    .eq("shop_id", shopId)
    .order("day_of_week", { ascending: true })
    .limit(7);

  // Recent bookings (last 14 days, max 10)
  const since = new Date();
  since.setDate(since.getDate() - 14);
  const sinceISO = since.toISOString();
  const { data: recentBookings = [] } = await supabase
    .from("bookings")
    .select("id, barber_id, service_id, customer_name, customer_phone, start_time, end_time, status, is_walk_in")
    .eq("shop_id", shopId)
    .is("deleted_at", null)
    .gte("start_time", sinceISO)
    .order("start_time", { ascending: false })
    .limit(10);

  return {
    barbers,
    services,
    workingHours,
    recentBookings,
  };
}
