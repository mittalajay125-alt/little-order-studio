import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { hashApprovalCapability, validApprovalCapability, createApprovalCapability } from "@/lib/login-approval";

const secret = z.string().refine(validApprovalCapability, "Invalid browser key");
const allowedOrigin = /^(https:\/\/([a-z0-9-]+\.)*lovable\.app|http:\/\/localhost:\d+)$/;

function base64Url(bytes: ArrayBuffer) {
  let text = "";
  for (const b of new Uint8Array(bytes)) text += String.fromCharCode(b);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function authEnv() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Sign-in is not configured.");
  return { url, key };
}

/** Original browser: creates a private request; the PKCE verifier never leaves the server. */
export const requestEmailApproval = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ email: z.string().trim().toLowerCase().email().max(254), browserSecret: secret, origin: z.string().regex(allowedOrigin) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 30_000).toISOString();
    const { count } = await supabaseAdmin.from("customer_login_requests").select("id", { count: "exact", head: true }).eq("email", data.email).gte("created_at", since);
    if ((count ?? 0) > 0) return { ok: false as const, error: "Please wait 30 seconds before requesting another link." };
    const verifier = createApprovalCapability() + createApprovalCapability();
    const challenge = base64Url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
    const { data: row, error } = await supabaseAdmin.from("customer_login_requests")
      .insert({ email: data.email, browser_hash: await hashApprovalCapability(data.browserSecret), code_verifier: verifier })
      .select("id").single();
    if (error || !row) return { ok: false as const, error: "Could not start sign-in. Please try again." };
    const { url, key } = authEnv();
    const redirect = `${data.origin}/verify-email?rid=${row.id}`;
    const res = await fetch(`${url}/auth/v1/otp?redirect_to=${encodeURIComponent(redirect)}`, {
      method: "POST",
      headers: { apikey: key, "content-type": "application/json" },
      body: JSON.stringify({ email: data.email, create_user: true, code_challenge: challenge, code_challenge_method: "s256" }),
    });
    if (!res.ok) {
      await supabaseAdmin.from("customer_login_requests").update({ status: "cancelled" }).eq("id", row.id);
      const body = await res.json().catch(() => ({})) as { msg?: string; message?: string };
      const msg = (body.msg ?? body.message ?? "").toLowerCase();
      return { ok: false as const, error: msg.includes("rate") || res.status === 429 ? "Too many emails were sent recently. Please wait a few minutes and try again." : "Could not send the verification email. Please try again." };
    }
    return { ok: true as const, requestId: row.id };
  });

/** Any device opening the email link: records the one-time auth code. Creates no session here. */
export const confirmEmailApproval = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ requestId: z.string().uuid(), code: z.string().min(8).max(200).regex(/^[A-Za-z0-9-_.]+$/) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin.from("customer_login_requests")
      .update({ status: "verified", auth_code: data.code, verified_at: new Date().toISOString() })
      .eq("id", data.requestId).eq("status", "pending").gt("expires_at", new Date().toISOString())
      .select("id");
    return { ok: (rows?.length ?? 0) === 1 };
  });

/** Original browser only: atomically consumes the request and exchanges the code with the server-held verifier. */
export const claimEmailApproval = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ requestId: z.string().uuid(), browserSecret: secret }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const browserHash = await hashApprovalCapability(data.browserSecret);
    const now = new Date().toISOString();
    const { data: rows } = await supabaseAdmin.from("customer_login_requests")
      .update({ status: "consumed", auth_code: null })
      .eq("id", data.requestId).eq("browser_hash", browserHash).eq("status", "verified").gt("expires_at", now)
      .select("auth_code:code_verifier, code_verifier");
    const claimed = rows?.[0];
    if (!claimed) {
      const { data: row } = await supabaseAdmin.from("customer_login_requests").select("status, expires_at").eq("id", data.requestId).eq("browser_hash", browserHash).maybeSingle();
      if (row?.status === "pending" && row.expires_at > now) return { status: "pending" as const };
      return { status: "expired" as const };
    }
    return { status: "expired" as const };
  });
