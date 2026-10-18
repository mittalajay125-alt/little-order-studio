import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Product = {
  id: string;
  category: string;
  name: string;
  price_mini: number | null;
  price_full: number | null;
  price: number | null;
  is_topping: boolean;
  available: boolean;
  sort_order: number;
};

export const productsQuery = queryOptions({
  queryKey: ["products"],
  queryFn: async () => {
    const { data, error } = await supabase.from("products").select("*").order("sort_order");
    if (error) throw error;
    return data as Product[];
  },
});

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async () => {
    const { data, error } = await supabase.from("settings").select("*").eq("id", 1).single();
    if (error) throw error;
    return data;
  },
});

export const ORDER_STATUSES = [
  ["new", "New"],
  ["accepted", "Accepted"],
  ["preparing", "Preparing"],
  ["ready", "Ready for Pickup"],
  ["out_for_delivery", "Out for Delivery"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
] as const;
