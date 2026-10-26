import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { CartProvider, useCart } from "@/lib/cart";
afterEach(() => { cleanup(); localStorage.clear(); });
it("preserves stored cart items through a full-page sign-in or refresh", async () => {
  const items = [{ key: "brownie", productId: "existing", name: "Brownie", size: null, unitPrice: 100, toppings: [], quantity: 2 }];
  localStorage.setItem("cnm-cart-v1", JSON.stringify(items));
  function Contents() { const cart = useCart(); return <span>{cart.count}</span>; }
  render(<CartProvider><Contents /></CartProvider>);
  await screen.findByText("2");
  expect(JSON.parse(localStorage.getItem("cnm-cart-v1") ?? "[]")).toEqual(items);
});