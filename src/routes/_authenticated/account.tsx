import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Trash2, Plus, Check, LogOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { AddressEditor } from "@/components/AddressEditor";
import { customerDataQuery, customerOrdersQuery } from "@/lib/customer-queries";
import { formatAddress, type SavedAddress } from "@/lib/customer";
import { inr } from "@/lib/cart";

export const Route = createFileRoute("/_authenticated/account")({
  loader: async ({ context }) => {
    await Promise.all([context.queryClient.ensureQueryData(customerDataQuery(context.user.id)), context.queryClient.ensureQueryData(customerOrdersQuery(context.user.id))]);
  },
  head: () => ({ meta: [
    { title: "My Account — Chocolate-n-More" }, { name: "description", content: "Your profile, saved delivery addresses and Chocolate-n-More orders." },
    { property: "og:title", content: "My Account — Chocolate-n-More" }, { property: "og:description", content: "Manage your dessert orders and addresses." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: Account,
});
function Account() {
  const { user } = Route.useRouteContext();
  const { data } = useSuspenseQuery(customerDataQuery(user.id));
  const { data: orders } = useSuspenseQuery(customerOrdersQuery(user.id));
  const qc = useQueryClient(); const navigate = useNavigate();
  const [name, setName] = useState(data.profile?.full_name ?? "");
  const [editor, setEditor] = useState<SavedAddress | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  async function refresh() { await qc.invalidateQueries({ queryKey: ["customer", user.id] }); }
  async function profile(values: { full_name?: string; default_address_id?: string | null }) {
    setBusy(true);
    const { error } = await supabase.from("profiles").upsert({ user_id: user.id, full_name: data.profile?.full_name ?? "", ...values, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await refresh(); toast.success("Account updated");
  }
  async function remove(a: SavedAddress) {
    if (!window.confirm(`Delete ${a.label} address?`)) return;
    const { error } = await supabase.from("customer_addresses").delete().eq("id", a.id).eq("user_id", user.id);
    if (error) { toast.error(error.message); return; }
    await refresh();
  }
  async function logout() {
    await qc.cancelQueries(); qc.clear();
    const { error } = await supabase.auth.signOut();
    if (error) { toast.error(error.message); return; }
    await navigate({ to: "/customer-login", search: { returnTo: undefined }, replace: true });
  }
  return <div className="min-h-screen"><SiteHeader /><main className="mx-auto max-w-4xl space-y-10 px-4 py-10">
    <div className="flex items-center justify-between gap-4"><h1 className="text-3xl">My Account</h1><Button variant="outline" onClick={logout}><LogOut />Logout</Button></div>
    <section className="space-y-4"><h2 className="text-2xl">Profile</h2><p className="break-all text-sm">{user.email} {user.email_confirmed_at && <span className="text-muted-foreground">· Verified</span>}</p>
      <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); void profile({ full_name: name.trim() }); }}><label className="flex-1 text-sm">Customer name<input className="mt-1 block w-full rounded-md border bg-card px-3 py-2" value={name} required minLength={2} maxLength={80} onChange={e => setName(e.target.value)} /></label><Button disabled={busy}>Save profile</Button></form>
    </section>
    <section className="space-y-4"><div className="flex items-center justify-between gap-3"><h2 className="text-2xl">Saved addresses</h2><Button variant="outline" onClick={() => setEditor("new")}><Plus />Add address</Button></div>
      {!data.addresses.length && <p className="text-sm text-muted-foreground">No saved addresses.</p>}
      <div className="grid gap-4 sm:grid-cols-2">{data.addresses.map(a => <article className="rounded-md border bg-card p-4" key={a.id}><h3 className="font-semibold">{a.label}{data.profile?.default_address_id === a.id && <span className="ml-2 text-xs text-muted-foreground">Default</span>}</h3><p className="mt-2 text-sm">{a.full_name} · {a.phone}</p><p className="mt-1 text-sm text-muted-foreground">{formatAddress(a)}</p><div className="mt-3 flex flex-wrap gap-1"><Button variant="ghost" size="icon" title="Edit address" aria-label={`Edit ${a.label}`} onClick={() => setEditor(a)}><Pencil /></Button><Button variant="ghost" size="icon" title="Delete address" aria-label={`Delete ${a.label}`} onClick={() => remove(a)}><Trash2 /></Button>{data.profile?.default_address_id !== a.id && <Button variant="ghost" size="sm" disabled={busy} onClick={() => profile({ default_address_id: a.id })}><Check />Set default</Button>}</div></article>)}</div>
      {editor && <AddressEditor key={typeof editor === "string" ? "new" : editor.id} userId={user.id} name={name} initial={typeof editor === "string" ? undefined : editor} onCancel={() => setEditor(null)} onSaved={async a => { setEditor(null); if (!data.addresses.length) await profile({ default_address_id: a.id }); await refresh(); }} />}
    </section>
    <section className="space-y-4"><h2 className="text-2xl">My Orders</h2>{!orders.length && <p className="text-sm text-muted-foreground">No orders yet. <Link to="/menu" className="underline">Browse menu</Link></p>}
      <div className="divide-y">{orders.map(o => <article key={o.id} className="space-y-2 py-5"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{o.order_number}</h3><p>{inr(o.total)} · {o.status.replaceAll("_", " ")}</p></div><p className="text-sm text-muted-foreground">{new Date(o.created_at).toLocaleDateString()} · {o.fulfillment === "delivery" ? "Home Delivery" : "Stall Pickup"} · {o.payment_method.toUpperCase()} · {o.payment_status}</p><ul className="text-sm">{o.order_items.map(i => <li key={i.id}>{i.quantity} × {i.product_name} {i.size && `(${i.size})`} · {inr(i.line_total)}{Array.isArray(i.toppings) && i.toppings.length > 0 && <span className="block text-muted-foreground">{i.toppings.join(", ")}</span>}</li>)}</ul>{o.delivery_address && <p className="text-sm">{o.delivery_address}</p>}{o.notes && <p className="text-sm text-muted-foreground">{o.notes}</p>}</article>)}</div>
    </section>
  </main><SiteFooter /></div>;
}