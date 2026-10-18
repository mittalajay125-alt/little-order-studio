import { Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart";

export function SiteHeader() {
  const { count } = useCart();
  return (
    <header className="sticky top-0 z-40 bg-cocoa text-cocoa-foreground shadow-warm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="font-display text-xl font-semibold tracking-tight">
          Chocolate<span className="text-caramel">-n-</span>More
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link to="/menu" className="hover:text-caramel" activeProps={{ className: "text-caramel" }}>Menu</Link>
          <Link to="/checkout" className="relative flex items-center gap-1 rounded-full bg-caramel px-3 py-1.5 font-medium text-accent-foreground">
            <ShoppingBag className="h-4 w-4" /> Cart
            {count > 0 && (
              <span className="ml-1 rounded-full bg-cocoa px-1.5 text-xs text-cocoa-foreground">{count}</span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 bg-cocoa text-cocoa-foreground">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm opacity-80">
        © {new Date().getFullYear()} Chocolate-n-More · Pay by Cash or UPI at the counter / on delivery
      </div>
    </footer>
  );
}
