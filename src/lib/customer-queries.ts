import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const customerDataQuery = (userId: string) => queryOptions({
  queryKey: ["customer", userId],
  staleTime: 30_000,
  queryFn: async () => {
    const [profile, addresses] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("customer_addresses").select("*").eq("user_id", userId).order("created_at"),
    ]);
    if (profile.error) throw profile.error;
    if (addresses.error) throw addresses.error;
    if (!profile.data) {
      // Insert only if missing: a repeat login must never overwrite a saved name.
      const created = await supabase.from("profiles").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
      if (created.error) throw created.error;
      const loaded = await supabase.from("profiles").select("*").eq("user_id", userId).single();
      if (loaded.error) throw loaded.error;
      return { profile: loaded.data, addresses: addresses.data ?? [] };
    }
    return { profile: profile.data, addresses: addresses.data ?? [] };
  },
});
export const customerOrdersQuery = (userId: string) => queryOptions({
  queryKey: ["customer-orders", userId],
  staleTime: 30_000,
  queryFn: async () => {
    const { data, error } = await supabase.from("orders").select("*, order_items(*)").eq("customer_id", userId).order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});