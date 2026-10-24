import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { OTP_COOLDOWN_SECONDS, safeReturnPath, validOtp } from "@/lib/customer";
import { useCustomerSession } from "@/lib/customer-session";

export const Route = createFileRoute("/customer-login")({
  validateSearch: (search: Record<string, unknown>) => ({ returnTo: search["returnTo"] === "/checkout" ? "/checkout" as const : undefined }),
  head: () => ({ meta: [
    { title: "Customer login — Chocolate-n-More" },
    { name: "description", content: "Sign in to your Chocolate-n-More account with an email code." },
    { property: "og:title", content: "Customer login — Chocolate-n-More" },
    { property: "og:description", content: "Your dessert orders and saved addresses." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: CustomerLogin,
});
function CustomerLogin() {
  const navigate = useNavigate();
  const { returnTo } = Route.useSearch();
  const { user, loading } = useCustomerSession();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const search = new URLSearchParams(window.location.search);
    if (params.get("error") || search.get("error")) setError("This email link has already been used or has expired. Request a new email and open only the newest link once.");
  }, []);
  useEffect(() => {
    if (loading || !user) return;
    let active = true;
    void supabase.auth.getUser().then(({ data, error }) => {
      if (!active || error || !data.user) return;
      const destination = safeReturnPath(returnTo ?? sessionStorage.getItem("customer-login-return"));
      sessionStorage.removeItem("customer-login-return");
      void navigate({ to: destination, replace: true });
    });
    return () => { active = false; };
  }, [loading, user, returnTo, navigate]);
  useEffect(() => {
    const end = Number(sessionStorage.getItem("customer-otp-cooldown") ?? 0);
    const tick = () => setCooldown(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
    tick();
    const timer = setInterval(() => {
      const remaining = Number(sessionStorage.getItem("customer-otp-cooldown") ?? 0);
      setCooldown(Math.max(0, Math.ceil((remaining - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  async function sendCode() {
    if (busy || cooldown > 0) return;
    setBusy(true); setError("");
    try {
      const destination = safeReturnPath(returnTo);
      sessionStorage.setItem("customer-login-return", destination);
      const callback = new URL("/customer-login", window.location.origin);
      if (destination === "/checkout") callback.searchParams.set("returnTo", "/checkout");
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true, emailRedirectTo: callback.href } });
      if (error) { setError(error.message); return; }
      sessionStorage.setItem("customer-otp-cooldown", String(Date.now() + OTP_COOLDOWN_SECONDS * 1000));
      setCooldown(OTP_COOLDOWN_SECONDS); setSent(true);
    } catch { setError("Could not send your code. Please try again."); }
    finally { setBusy(false); }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sent) { await sendCode(); return; }
    if (!validOtp(code)) { setError("Enter the 6-digit code from your email."); return; }
    setBusy(true); setError("");
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: "email" });
      if (error || !data.session) { setError(error?.message ?? "This code could not be verified."); return; }
      await navigate({ to: safeReturnPath(returnTo) });
    } catch { setError("Could not verify your code. Please try again."); }
    finally { setBusy(false); }
  }
  return <div className="min-h-screen"><SiteHeader />
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-6 text-3xl">{sent ? "Check your email" : "Customer login"}</h1>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm">Email<input className="mt-2 w-full rounded-md border bg-card px-4 py-3" type="email" autoComplete="email" required readOnly={sent} value={email} onChange={e => setEmail(e.target.value)} /></label>
        {sent && <label className="block text-sm">6-digit code<input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} aria-label="6-digit code" className="mt-2 w-full rounded-md border bg-card px-4 py-3 text-center text-2xl" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} required /></label>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button className="w-full" disabled={busy || (!sent && cooldown > 0)}>{busy ? "Please wait…" : sent ? "Verify & continue" : cooldown > 0 ? `Try again in ${cooldown}s` : "Send code"}</Button>
        {sent && <div className="flex justify-between"><Button type="button" variant="link" disabled={busy || cooldown > 0} onClick={sendCode}>{cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}</Button><Button type="button" variant="link" onClick={() => { setSent(false); setCode(""); setError(""); }}>Change email</Button></div>}
      </form>
      <Link to="/menu" className="mt-8 block text-sm text-muted-foreground underline">Back to menu</Link>
    </main>
  </div>;
}