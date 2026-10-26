import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type CartTopping = { id: string; name: string; price: number };
export type CartItem = {
  key: string;
  productId: string;
  name: string;
  size: "mini" | "full" | null;
  unitPrice: number;
  toppings: CartTopping[];
  quantity: number;
};

export const lineTotal = (i: CartItem) =>
  (i.unitPrice + i.toppings.reduce((s, t) => s + t.price, 0)) * i.quantity;

type Ctx = {
  items: CartItem[];
  add: (i: Omit<CartItem, "key">) => void;
  setQty: (key: string, q: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  count: number;
  subtotal: number;
};
const CartCtx = createContext<Ctx | null>(null);
const KEY = "cnm-cart-v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    setRestored(true);
  }, []);
  useEffect(() => {
    if (restored) localStorage.setItem(KEY, JSON.stringify(items));
  }, [items, restored]);

  const add: Ctx["add"] = (i) => {
    const key = `${i.productId}|${i.size}|${i.toppings.map((t) => t.id).sort().join(",")}`;
    setItems((prev) => {
      const ex = prev.find((p) => p.key === key);
      if (ex) return prev.map((p) => (p.key === key ? { ...p, quantity: Math.min(50, p.quantity + i.quantity) } : p));
      return [...prev, { ...i, key }];
    });
  };
  const setQty = (key: string, q: number) =>
    setItems((prev) => (q < 1 ? prev.filter((p) => p.key !== key) : prev.map((p) => (p.key === key ? { ...p, quantity: Math.min(50, q) } : p))));
  const remove = (key: string) => setItems((prev) => prev.filter((p) => p.key !== key));
  const clear = () => setItems([]);

  return (
    <CartCtx.Provider
      value={{
        items, add, setQty, remove, clear,
        count: items.reduce((s, i) => s + i.quantity, 0),
        subtotal: items.reduce((s, i) => s + lineTotal(i), 0),
      }}
    >
      {children}
    </CartCtx.Provider>
  );
}

export function useCart() {
  const c = useContext(CartCtx);
  if (!c) throw new Error("useCart outside provider");
  return c;
}

export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
