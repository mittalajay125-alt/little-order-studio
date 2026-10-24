import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { useCart, inr, lineTotal } from "@/lib/cart";
import { settingsQuery } from "@/lib/shop";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerSession } from "@/lib/customer-session";
import { customerDataQuery } from "@/lib/customer-queries";
import { AddressEditor } from "@/components/AddressEditor";
import { Button } from "@/components/ui/button";
import { formatAddress } from "@/lib/customer";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Cart & Checkout — Chocolate-n-More" },
      { name: "description", content: "Review your dessert order and choose pickup or home delivery." },
      { property: "og:title", content: "Checkout — Chocolate-n-More" },
      { property: "og:description", content: "Place your order. Pay by cash or UPI at pickup or delivery." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Checkout,
});

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  phone: z.string().trim().regex(/^\+?[0-9]{10,13}$/, "Enter a valid 10-digit mobile number"),
  address: z.string().max(500),
  notes: z.string().max(500),
});

function Checkout() {
  const cart = useCart();
  const { data: settings } = useQuery(settingsQuery);
  const navigate = useNavigate();
  const { user, loading: sessionLoading } = useCustomerSession();
  const customer = useQuery({ ...customerDataQuery(user?.id ?? ""), enabled: !!user });
  const [selectedAddress, setSelectedAddress] = useState("");
  const [addingAddress, setAddingAddress] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [notes, setNotes] = useState("");
  const [payment, setPayment] = useState<"cash" | "upi">("cash");
  const [busy, setBusy] = useState(false);

  const deliveryOn = settings?.delivery_enabled ?? true;
  const dc = fulfillment === "delivery" ? settings?.delivery_charge ?? 0 : 0;
  const total = cart.subtotal + dc;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const chosen = customer.data?.addresses.find(a => a.id === (selectedAddress || customer.data?.profile?.default_address_id));
    const parsed = schema.safeParse({ name: fulfillment === "delivery" ? chosen?.full_name ?? "" : name, phone: (fulfillment === "delivery" ? chosen?.phone ?? "" : phone).replace(/[\s-]/g, ""), address: "", notes });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Check your details"); return; }
    if (fulfillment === "delivery" && !chosen) { toast.error("Select a confirmed delivery address"); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("place_customer_order", {
      _name: parsed.data.name,
      _phone: parsed.data.phone,
      _fulfillment: fulfillment,
      _address_id: fulfillment === "delivery" ? chosen?.id ?? "" : "00000000-0000-0000-0000-000000000000",
      _notes: parsed.data.notes,
      _payment: payment,
      _items: cart.items.map((i) => ({ product_id: i.productId, size: i.size, quantity: i.quantity, toppings: i.toppings.map((t) => t.id) })),
    });
    setBusy(false);
    if (error) { toast.error(error.message || "Could not place order"); return; }
    cart.clear();
    navigate({ to: "/order/$number", params: { number: data as string } });
  }

  if (cart.items.length === 0)
    return (
      <div className="min-h-screen"><SiteHeader />
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="text-3xl font-bold">Your cart is empty</h1>
          <Link to="/menu" className="mt-6 inline-block rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground">Browse menu</Link>
        </div>
      </div>
    );

  const field = "w-full rounded-xl border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring";
  const opt = (on: boolean) => `rounded-xl border px-4 py-3 text-left text-sm font-medium ${on ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`;

  if (sessionLoading) return <div className="min-h-screen"><SiteHeader /><p className="px-4 py-16 text-center">Please wait…</p></div>;
  if (!user) return <div className="min-h-screen"><SiteHeader /><main className="mx-auto max-w-md space-y-6 px-4 py-16"><h1 className="text-3xl">Sign in to checkout</h1><Button asChild className="w-full"><Link to="/customer-login" search={{ returnTo: "/checkout" }}>Customer login</Link></Button><Link to="/menu" className="block text-sm underline">Back to menu</Link></main></div>;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <form id="checkout-form" onSubmit={submit} className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <section>
            <h1 className="mb-4 text-3xl font-bold">Your cart</h1>
            <ul className="divide-y rounded-2xl border bg-card">
              {cart.items.map((i) => (
                <li key={i.key} className="flex gap-3 p-4">
                  <div className="flex-1">
                    <p className="font-semibold">{i.name}{i.size && <span className="ml-1 text-sm text-muted-foreground">({i.size === "mini" ? "Mini" : "Full"})</span>}</p>
                    <p className="text-sm text-muted-foreground">{inr(i.unitPrice)} each</p>
                    {i.toppings.length > 0 && (
                      <p className="text-sm text-muted-foreground">+ {i.toppings.map((t) => `${t.name} ${inr(t.price)}`).join(", ")}</p>
                    )}
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex items-center rounded-full border">
                        <button type="button" aria-label="Decrease" className="p-1.5" onClick={() => cart.setQty(i.key, i.quantity - 1)}><Minus className="h-4 w-4" /></button>
                        <span className="w-6 text-center text-sm">{i.quantity}</span>
                        <button type="button" aria-label="Increase" className="p-1.5" onClick={() => cart.setQty(i.key, i.quantity + 1)}><Plus className="h-4 w-4" /></button>
                      </div>
                      <button type="button" aria-label="Remove" onClick={() => cart.remove(i.key)} className="text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <p className="font-semibold">{inr(lineTotal(i))}</p>
                </li>
              ))}
            </ul>
          </section>

          {fulfillment === "pickup" && <section className="space-y-3">
            <h2 className="text-2xl font-semibold">Your details</h2>
            <input className={field} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
            <input className={field} placeholder="Mobile number" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={15} required />
          </section>}

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">Pickup or delivery</h2>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" className={opt(fulfillment === "pickup")} onClick={() => setFulfillment("pickup")}>Stall Pickup</button>
              <button type="button" disabled={!deliveryOn} className={`${opt(fulfillment === "delivery")} disabled:opacity-50`} onClick={() => setFulfillment("delivery")}>
                Home Delivery{!deliveryOn && " (unavailable)"}
              </button>
            </div>
            {fulfillment === "delivery" && (
              <div className="space-y-3">
                <h3 className="font-semibold">Select Address</h3>
                {customer.isPending && <p className="text-sm">Loading addresses…</p>}
                {customer.error && <p role="alert" className="text-sm text-destructive">Could not load your addresses. <Button type="button" variant="link" onClick={() => customer.refetch()}>Retry</Button></p>}
                {customer.data?.addresses.map(a => <label key={a.id} className="flex gap-3 rounded-md border bg-card p-3"><input type="radio" name="delivery-address" value={a.id} checked={(selectedAddress || customer.data?.profile?.default_address_id) === a.id} onChange={() => setSelectedAddress(a.id)} /><span className="text-sm"><strong>{a.label}</strong> · {a.full_name}<span className="mt-1 block text-muted-foreground">{formatAddress(a)}</span></span></label>)}
                <Button type="button" variant="outline" onClick={() => setAddingAddress(true)}>Add new address</Button>
              </div>
            )}
            <textarea className={field} rows={2} placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">Payment</h2>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" className={opt(payment === "cash")} onClick={() => setPayment("cash")}>Cash</button>
              <button type="button" className={opt(payment === "upi")} onClick={() => setPayment("upi")}>UPI</button>
            </div>
            <p className="text-sm text-muted-foreground">Pay at the counter or on delivery. No online payment is taken.</p>
          </section>
        </div>

        <aside className="h-fit rounded-2xl bg-cocoa-gradient p-6 text-cocoa-foreground shadow-warm lg:sticky lg:top-20">
          <h2 className="text-xl font-semibold">Order summary</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt>Items</dt><dd>{inr(cart.subtotal)}</dd></div>
            {fulfillment === "delivery" && <div className="flex justify-between"><dt>Delivery charge</dt><dd>{inr(dc)}</dd></div>}
            <div className="flex justify-between border-t border-cocoa-foreground/20 pt-3 text-lg font-semibold"><dt>Total</dt><dd className="text-caramel">{inr(total)}</dd></div>
          </dl>
          <p className="mt-2 text-xs opacity-70">Final total is confirmed by our system when you place the order.</p>
          <button disabled={busy || (fulfillment === "delivery" && !(selectedAddress || customer.data?.profile?.default_address_id))} className="mt-6 w-full rounded-full bg-caramel py-3.5 font-semibold text-accent-foreground disabled:opacity-60">
            {busy ? "Placing order…" : `Place order · ${inr(total)}`}
          </button>
        </aside>
      </form>
      {addingAddress && <div className="mx-auto max-w-3xl px-4 pb-8"><AddressEditor userId={user.id} name={name || customer.data?.profile?.full_name} onCancel={() => setAddingAddress(false)} onSaved={async a => { setSelectedAddress(a.id); setAddingAddress(false); await customer.refetch(); }} /></div>}
      <SiteFooter />
    </div>
  );
}
