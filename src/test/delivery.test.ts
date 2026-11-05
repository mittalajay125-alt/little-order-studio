import { describe, expect, it } from "vitest";
import { deliveryCharge, deliveryQuote, straightLineKm } from "@/lib/delivery";

describe("delivery pricing", () => {
  it("charges ₹30 through 3 km", () => { expect(deliveryCharge(0)).toBe(30); expect(deliveryCharge(3)).toBe(30); });
  it("charges ₹40 above 3 through 6 km", () => { expect(deliveryCharge(3.000001)).toBe(40); expect(deliveryCharge(6)).toBe(40); });
  it("charges ₹60 above 6 through 10 km", () => { expect(deliveryCharge(6.000001)).toBe(60); expect(deliveryCharge(10)).toBe(60); });
  it("rejects above 10 km", () => { expect(deliveryCharge(10.000001)).toBeNull(); });
  it("does not guess missing coordinates", () => { expect(straightLineKm({ latitude: null, longitude: null }, { latitude: 0, longitude: 0 })).toBeNull(); });
  it("recalculates for changed addresses using straight-line distance", () => {
    const shop = { latitude: 26.857264188373723, longitude: 75.74637446436698 };
    expect(deliveryQuote(shop, shop)).toEqual({ distance: 0, charge: 30 });
    expect(deliveryQuote(shop, { ...shop, latitude: shop.latitude + 0.05 }).charge).toBe(40);
    expect(deliveryQuote(shop, { ...shop, latitude: shop.latitude + 0.1 }).charge).toBeNull();
  });
});