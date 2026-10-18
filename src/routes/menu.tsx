import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { productsQuery, type Product } from "@/lib/shop";
import { useCart, inr } from "@/lib/cart";

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta: [
      { title: "Menu — Chocolate-n-More" },
      { name: "description", content: "Brownie bowls, fruit punch brownies, truffle balls, fruit cups and toppings with prices." },
      { property: "og:title", content: "Chocolate-n-More Menu" },
      { property: "og:description", content: "Pick your brownie, size and toppings and order online." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(productsQuery),
  component: Menu,
});

function Menu() {
  const { data } = useSuspenseQuery(productsQuery);
  const { count, subtotal } = useCart();
  const toppings = data.filter((p) => p.is_topping && p.available);
  const groups = useMemo(() => {
    const m = new Map<string, Product[]>();
    data.filter((p) => !p.is_topping).forEach((p) => m.set(p.category, [...(m.get(p.category) ?? []), p]));
    return [...m.entries()];
  }, [data]);
  const [active, setActive] = useState("all");

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-4xl font-bold">Our Menu</h1>
        <div className="sticky top-14 z-30 -mx-4 mt-6 flex gap-2 overflow-x-auto bg-background/95 px-4 py-3 backdrop-blur">
          {([["all", "All"], ...groups.map(([c]) => [c, c])] as [string, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setActive(k)}
              className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium transition ${active === k ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>
              {l}
            </button>
          ))}
        </div>
        {groups.filter(([c]) => active === "all" || active === c).map(([cat, items]) => (
          <section key={cat} className="mt-8">
            <h2 className="mb-4 text-2xl font-semibold text-primary">{cat}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((p) => <ProductCard key={p.id} p={p} toppings={toppings} />)}
            </div>
          </section>
        ))}
        {toppings.length > 0 && (
          <p className="mt-10 rounded-xl bg-secondary p-4 text-sm">
            <b>Toppings:</b> {toppings.map((t) => `${t.name} ${inr(t.price ?? 0)}`).join(" · ")} — add them to any item above.
          </p>
        )}
      </div>
      {count > 0 && (
        <Link to="/checkout" className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center justify-between rounded-full bg-cocoa px-6 py-4 text-cocoa-foreground shadow-warm">
          <span>{count} item{count > 1 ? "s" : ""} · {inr(subtotal)}</span>
          <span className="font-semibold text-caramel">View cart →</span>
        </Link>
      )}
      <SiteFooter />
    </div>
  );
}

function ProductCard({ p, toppings }: { p: Product; toppings: Product[] }) {
  const { add } = useCart();
  const sized = p.price == null;
  const [size, setSize] = useState<"mini" | "full">("mini");
  const [qty, setQty] = useState(1);
  const [sel, setSel] = useState<string[]>([]);
  const unit = sized ? (size === "mini" ? p.price_mini! : p.price_full!) : p.price!;
  const tops = toppings.filter((t) => sel.includes(t.id));
  const total = (unit + tops.reduce((s, t) => s + (t.price ?? 0), 0)) * qty;

  return (
    <div className={`flex flex-col rounded-2xl border bg-card p-5 shadow-warm ${!p.available ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg font-semibold leading-snug">{p.name}</h3>
        <span className="whitespace-nowrap font-semibold text-primary">
          {sized ? `${inr(p.price_mini!)} / ${inr(p.price_full!)}` : inr(p.price!)}
        </span>
      </div>
      {!p.available ? (
        <p className="mt-4 text-sm font-medium text-destructive">Currently unavailable</p>
      ) : (
        <>
          {sized && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {(["mini", "full"] as const).map((s) => (
                <button key={s} onClick={() => setSize(s)}
                  className={`rounded-lg border py-2 text-sm font-medium ${size === s ? "border-primary bg-primary text-primary-foreground" : ""}`}>
                  {s === "mini" ? "Mini" : "Full"} · {inr(s === "mini" ? p.price_mini! : p.price_full!)}
                </button>
              ))}
            </div>
          )}
          {toppings.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Add toppings</p>
              <div className="flex flex-wrap gap-2">
                {toppings.map((t) => {
                  const on = sel.includes(t.id);
                  return (
                    <button key={t.id} onClick={() => setSel(on ? sel.filter((x) => x !== t.id) : [...sel, t.id])}
                      className={`rounded-full border px-3 py-1 text-xs ${on ? "border-accent bg-accent text-accent-foreground" : ""}`}>
                      {t.name} +{inr(t.price ?? 0)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="mt-auto flex items-center justify-between gap-3 pt-5">
            <div className="flex items-center rounded-full border">
              <button aria-label="Decrease" className="p-2" onClick={() => setQty(Math.max(1, qty - 1))}><Minus className="h-4 w-4" /></button>
              <span className="w-6 text-center text-sm font-medium">{qty}</span>
              <button aria-label="Increase" className="p-2" onClick={() => setQty(Math.min(50, qty + 1))}><Plus className="h-4 w-4" /></button>
            </div>
            <button
              onClick={() => {
                add({ productId: p.id, name: p.name, size: sized ? size : null, unitPrice: unit,
                  toppings: tops.map((t) => ({ id: t.id, name: t.name, price: t.price ?? 0 })), quantity: qty });
                toast.success(`${p.name} added`);
                setQty(1); setSel([]);
              }}
              className="flex-1 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground">
              Add · {inr(total)}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
