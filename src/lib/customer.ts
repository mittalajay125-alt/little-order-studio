import { z } from "zod";

export const addressSchema = z.object({
  label: z.string().trim().min(1).max(40),
  full_name: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^\+?[0-9]{10,13}$/, "Enter a valid mobile number"),
  house: z.string().trim().min(1).max(100),
  street: z.string().trim().min(1).max(150),
  area: z.string().trim().min(1).max(100),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().min(1).max(80),
  pin: z.string().regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit PIN code"),
  landmark: z.string().trim().max(150),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
});
export type AddressInput = z.infer<typeof addressSchema>;
export type SavedAddress = AddressInput & { id: string; user_id: string };
export const emptyAddress: AddressInput = { label: "Home", full_name: "", phone: "", house: "", street: "", area: "", city: "", state: "", pin: "", landmark: "", latitude: null, longitude: null };
export function formatAddress(a: AddressInput) {
  return [a.house, a.street, a.area, a.city, a.state, a.pin, a.landmark].filter(Boolean).join(", ");
}
export function safeReturnPath(value: unknown) {
  return value === "/checkout" ? "/checkout" : "/account";
}
export const OTP_COOLDOWN_SECONDS = 60;
export function validOtp(value: string) { return /^[0-9]{6}$/.test(value); }
/** Customer sign-in is code-only: a session arriving from an emailed sign-in/sign-up link is rejected. Password recovery links stay allowed. */
export function isBlockedEmailLink(hash: string) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const type = params.get("type");
  return !!params.get("access_token") && (type === "magiclink" || type === "signup");
}
export function otpErrorMessage(message: string | undefined) {
  const text = (message ?? "").toLowerCase();
  if (text.includes("expired") || text.includes("invalid")) return "That code is invalid or has expired. Request a new code and enter the latest 6-digit code from your email.";
  if (text.includes("rate limit") || text.includes("security purposes")) return "Too many attempts. Please wait a minute before requesting another code.";
  return message || "We could not verify your code. Please try again.";
}