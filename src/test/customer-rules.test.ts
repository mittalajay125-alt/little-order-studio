import { describe, expect, it } from "vitest";
import { addressSchema, emptyAddress, validOtp, OTP_COOLDOWN_SECONDS, safeReturnPath, formatAddress } from "@/lib/customer";
const validAddress = { ...emptyAddress, full_name: "Test Customer", phone: "9999999999", house: "12", street: "Test Road", area: "Test Area", city: "Kolkata", state: "West Bengal", pin: "700001" };
describe("Customer requirements", () => {
  it("accepts only six-digit email codes", () => { expect(validOtp("123456")).toBe(true); expect(validOtp("12345")).toBe(false); expect(validOtp("1234567")).toBe(false); expect(validOtp("abcdef")).toBe(false); });
  it("has a resend cooldown", () => { expect(OTP_COOLDOWN_SECONDS).toBe(60); });
  it("requires complete delivery fields", () => { expect(addressSchema.safeParse(validAddress).success).toBe(true); for (const key of ["house", "street", "area", "city", "state", "full_name", "phone"]) expect(addressSchema.safeParse({ ...validAddress, [key]: "" }).success).toBe(false); });
  it("validates six-digit Indian PIN codes", () => { expect(addressSchema.safeParse({ ...validAddress, pin: "700001" }).success).toBe(true); for (const pin of ["70001", "7000011", "000001", "abcdef"]) expect(addressSchema.safeParse({ ...validAddress, pin }).success).toBe(false); });
  it("does not require a landmark or coordinates for manual entry", () => { expect(addressSchema.safeParse(validAddress).success).toBe(true); });
  it("returns to checkout without allowing external redirects", () => { expect(safeReturnPath("/checkout")).toBe("/checkout"); expect(safeReturnPath("https://example.com")).toBe("/account"); });
  it("formats address snapshots without mutating stored input", () => { const snapshot = formatAddress(validAddress); const changed = { ...validAddress, house: "25" }; expect(formatAddress(changed)).not.toBe(snapshot); expect(snapshot).toContain("12, Test Road"); });
});