import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const customerDataQuery = (userId: string) => queryOptions({
  queryKey: ["customer", userId],
  queryFn: async () => {
    const [profile, addresses] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("customer_addresses").select("*").eq("user_id", userId).order("created_at"),
    ]);
    if (profile.error) throw profile.error;
    if (addresses.error) throw addresses.error;
    return { profile: profile.data, addresses: addresses.data ?? [] };
  },
});
export const customerOrdersQuery = (userId: string) => queryOptions({
  queryKey: ["customer-orders", userId],
  queryFn: async () => {
    const { data, error } = await supabase.from("orders").select("*, order_items(*)").eq("customer_id", userId).order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});