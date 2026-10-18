import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ORDER_STATUSES, productsQuery, settingsQuery, type Product } from "@/lib/shop";
import { inr } from "@/lib/cart";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin dashboard — Chocolate-n-More" },
      { name: "description", content: "Manage orders, products and delivery settings." },
      { property: "og:title", content: "Admin — Chocolate-n-More" },
      { property: "og:description", content: "Staff dashboard." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

type Item = { id: string; product_name: string; size: string | null; unit_price: number; toppings: string[]; quantity: number; line_total: number };
type Order = {
  id: string; order_number: string; customer_name: string; customer_phone: string; fulfillment: string;
  delivery_address: string | null; notes: string | null; subtotal: number; delivery_charge: number; total: number;
  payment_method: string; status: string; payment_status: string; created_at: string; order_items: Item[];
};

function Admin() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"orders" | "products" | "settings">("orders");
  const role = useQuery({
    queryKey: ["is-admin", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      return !!data;
    },
  });

  async function signOut() {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (role.isLoading) return <p className="p-10">Loading…</p>;
  if (!role.data)
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-2xl font-bold">Not authorised</h1>
        <p className="mt-2 text-muted-foreground">This account doesn't have admin access.</p>
        <button onClick={signOut} className="mt-6 rounded-full bg-primary px-5 py-2 text-primary-foreground">Sign out</button>
      </div>
    );

  return (
    <div className="min-h-screen">
      <header className="bg-cocoa text-cocoa-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <span className="font-display text-xl font-semibold">Admin · Chocolate-n-More</span>
          <div className="flex items-center gap-2 text-sm">
            {(["orders", "products", "settings"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-full px-3 py-1.5 capitalize ${tab === t ? "bg-caramel text-accent-foreground" : ""}`}>{t}</button>
            ))}
            <button onClick={signOut} aria-label="Sign out" className="p-2"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        {tab === "orders" && <Orders />}
        {tab === "products" && <Products />}
        {tab === "settings" && <Settings />}
      </main>
    </div>
  );
}

function Orders() {
  const [filter, setFilter] = useState("active");
  const q = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*, order_items(*)").order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return data as unknown as Order[];
    },
    refetchInterval: 30000,
  });
  useEffect(() => {
    const ch = supabase.channel("orders-admin")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, () => { toast.success("New order received!"); q.refetch(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function update(id: string, patch: Partial<Pick<Order, "status" | "payment_status">>) {
    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    q.refetch();
  }

  const orders = (q.data ?? []).filter((o) =>
    filter === "all" ? true : filter === "active" ? !["completed", "cancelled"].includes(o.status) : o.status === filter);
  const newCount = (q.data ?? []).filter((o) => o.status === "new").length;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-3xl font-bold">Orders {newCount > 0 && <span className="ml-2 rounded-full bg-caramel px-2.5 py-0.5 align-middle text-sm text-accent-foreground">{newCount} new</span>}</h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-lg border bg-card px-3 py-2 text-sm">
          <option value="active">Active</option><option value="all">All</option>
          {ORDER_STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button onClick={() => q.refetch()} className="rounded-lg border bg-card p-2" aria-label="Refresh"><RefreshCw className="h-4 w-4" /></button>
      </div>
      {q.isLoading && <p>Loading…</p>}
      {!q.isLoading && orders.length === 0 && <p className="text-muted-foreground">No orders here yet.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {orders.map((o) => (
          <article key={o.id} className={`rounded-2xl border bg-card p-5 shadow-warm ${o.status === "new" ? "ring-2 ring-caramel" : ""}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-display text-xl font-bold">{o.order_number}</p>
                <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("en-IN")}</p>
              </div>
              <p className="text-xl font-bold text-primary">{inr(o.total)}</p>
            </div>
            <div className="mt-3 text-sm">
              <p><b>{o.customer_name}</b> · <a className="underline" href={`tel:${o.customer_phone}`}>{o.customer_phone}</a></p>
              <p>{o.fulfillment === "delivery" ? "🚚 Home Delivery" : "🏪 Stall Pickup"} · {o.payment_method.toUpperCase()}</p>
              {o.delivery_address && <p className="mt-1 rounded-lg bg-muted p-2">{o.delivery_address}</p>}
              {o.notes && <p className="mt-1 italic text-muted-foreground">Note: {o.notes}</p>}
            </div>
            <ul className="mt-3 divide-y border-y text-sm">
              {o.order_items.map((i) => (
                <li key={i.id} className="flex justify-between py-2">
                  <span>{i.quantity} × {i.product_name}{i.size && ` (${i.size === "mini" ? "Mini" : "Full"})`}
                    {i.toppings.length > 0 && <span className="block text-xs text-muted-foreground">+ {i.toppings.join(", ")}</span>}</span>
                  <span>{inr(i.line_total)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-right text-xs text-muted-foreground">Items {inr(o.subtotal)}{o.delivery_charge > 0 && ` + delivery ${inr(o.delivery_charge)}`}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <select value={o.status} onChange={(e) => update(o.id, { status: e.target.value })} className="rounded-lg border bg-background px-2 py-2 text-sm">
                {ORDER_STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select value={o.payment_status} onChange={(e) => update(o.id, { payment_status: e.target.value })}
                className={`rounded-lg border px-2 py-2 text-sm ${o.payment_status === "paid" ? "bg-success/15" : "bg-background"}`}>
                <option value="unpaid">Unpaid</option><option value="paid">Paid</option>
              </select>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function Products() {
  const qc = useQueryClient();
  const { data } = useQuery(productsQuery);
  async function save(p: Product, patch: Partial<Product>) {
    const { error } = await supabase.from("products").update(patch).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["products"] });
  }
  const num = (v: string) => (v === "" ? null : Math.max(0, Math.round(Number(v))));
  return (
    <div>
      <h1 className="mb-5 text-3xl font-bold">Products & prices</h1>
      <div className="space-y-3">
        {data?.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
            <div className="min-w-48 flex-1">
              <input defaultValue={p.name} onBlur={(e) => e.target.value.trim() && e.target.value !== p.name && save(p, { name: e.target.value.trim() })}
                className="w-full rounded border-transparent bg-transparent font-semibold focus:border-input" />
              <p className="text-xs text-muted-foreground">{p.category}</p>
            </div>
            {p.price == null ? (
              <>
                <label className="text-xs">Mini ₹<input type="number" min={0} defaultValue={p.price_mini ?? ""} onBlur={(e) => num(e.target.value) !== p.price_mini && save(p, { price_mini: num(e.target.value) })} className="ml-1 w-20 rounded border px-2 py-1" /></label>
                <label className="text-xs">Full ₹<input type="number" min={0} defaultValue={p.price_full ?? ""} onBlur={(e) => num(e.target.value) !== p.price_full && save(p, { price_full: num(e.target.value) })} className="ml-1 w-20 rounded border px-2 py-1" /></label>
              </>
            ) : (
              <label className="text-xs">Price ₹<input type="number" min={0} defaultValue={p.price} onBlur={(e) => num(e.target.value) !== p.price && save(p, { price: num(e.target.value) ?? 0 })} className="ml-1 w-20 rounded border px-2 py-1" /></label>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={p.available} onChange={(e) => save(p, { available: e.target.checked })} className="h-4 w-4 accent-primary" />
              Available
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

function Settings() {
  const qc = useQueryClient();
  const { data } = useQuery(settingsQuery);
  const [form, setForm] = useState<Record<string, string | number | boolean> | null>(null);
  useEffect(() => { if (data && !form) setForm({ ...data }); }, [data]);
  if (!form) return <p>Loading…</p>;
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("settings").update({
      delivery_charge: Math.max(0, Math.round(Number(form!.delivery_charge) || 0)),
      delivery_enabled: !!form!.delivery_enabled,
      contact_phone: String(form!.contact_phone).slice(0, 30),
      contact_whatsapp: String(form!.contact_whatsapp).slice(0, 30),
      stall_address: String(form!.stall_address).slice(0, 300),
      instagram: String(form!.instagram).slice(0, 100),
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
    qc.invalidateQueries({ queryKey: ["settings"] });
  }
  const f = "w-full rounded-xl border bg-card px-4 py-2.5";
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  return (
    <form onSubmit={save} className="max-w-lg space-y-4">
      <h1 className="text-3xl font-bold">Settings</h1>
      <label className="flex items-center gap-2"><input type="checkbox" checked={!!form.delivery_enabled} onChange={(e) => setForm({ ...form, delivery_enabled: e.target.checked })} className="h-4 w-4 accent-primary" /> Offer home delivery</label>
      <label className="block text-sm">Delivery charge (₹)<input type="number" min={0} className={f} value={String(form.delivery_charge)} onChange={set("delivery_charge")} /></label>
      <label className="block text-sm">Phone<input className={f} value={String(form.contact_phone)} onChange={set("contact_phone")} /></label>
      <label className="block text-sm">WhatsApp<input className={f} value={String(form.contact_whatsapp)} onChange={set("contact_whatsapp")} /></label>
      <label className="block text-sm">Stall address<input className={f} value={String(form.stall_address)} onChange={set("stall_address")} /></label>
      <label className="block text-sm">Instagram<input className={f} value={String(form.instagram)} onChange={set("instagram")} /></label>
      <button className="rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground">Save settings</button>
    </form>
  );
}
