import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { OTP_COOLDOWN_SECONDS, safeReturnPath } from "@/lib/customer";
import { useCustomerSession } from "@/lib/customer-session";

export const Route = createFileRoute("/customer-login")({
  validateSearch: (search: Record<string, unknown>) => ({ returnTo: search["returnTo"] === "/checkout" ? "/checkout" as const : undefined }),
  head: () => ({ meta: [
    { title: "Customer login — Chocolate-n-More" },
    { name: "description", content: "Sign in to your Chocolate-n-More account with a secure email link." },
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
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [slow, setSlow] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const checking = loading || !!user;
  useEffect(() => {
    setSlow(false);
    if (!checking) return;
    const timer = setTimeout(() => setSlow(true), 12_000);
    return () => clearTimeout(timer);
  }, [checking, attempt]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const search = new URLSearchParams(window.location.search);
    if (params.get("error") || search.get("error")) setError("This email link has already been used or has expired. Request a new email and open only the newest link once.");
  }, []);
  useEffect(() => {
    if (loading || !user) return;
    let active = true;
    setError("");
    void supabase.auth.getUser().then(async ({ data, error }) => {
      if (!active) return;
      if (error || !data.user) { setError(error?.message ?? "We could not confirm your sign-in. Request a new email link."); return; }
      const destination = safeReturnPath(returnTo ?? sessionStorage.getItem("customer-login-return"));
      await navigate({ to: destination, replace: true });
      sessionStorage.removeItem("customer-login-return");
    }).catch(() => { if (active) setError("We could not finish signing you in. Check your connection and try again."); });
    return () => { active = false; };
  }, [loading, user, returnTo, navigate, attempt]);
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
  async function sendLink() {
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
    } catch { setError("Could not send your sign-in link. Please try again."); }
    finally { setBusy(false); }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await sendLink();
  }
  return <div className="min-h-screen"><SiteHeader />
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-6 text-3xl">{checking ? "Signing you in" : sent ? "Check your email" : "Customer login"}</h1>
      {checking ? <div className="space-y-4" aria-busy={!error}>
        {!error && <p role="status" className="text-sm text-muted-foreground">{slow ? "Sign-in is taking longer than usual. Check your internet connection." : "Confirming your sign-in…"}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {(slow || error) && <Button variant="outline" onClick={() => { if (loading) window.location.reload(); else setAttempt(value => value + 1); }}>Try again</Button>}
      </div> : <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm">Email<input className="mt-2 w-full rounded-md border bg-card px-4 py-3" type="email" autoComplete="email" required readOnly={sent} value={email} onChange={e => setEmail(e.target.value)} /></label>
        {sent && <p className="text-sm text-muted-foreground">Open the newest email link in the browser you want to sign in. A link opened on your phone signs in your phone, not your laptop. No code is needed.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button className="w-full" disabled={busy || cooldown > 0}>{busy ? "Please wait…" : cooldown > 0 ? `Try again in ${cooldown}s` : sent ? "Resend sign-in link" : "Send sign-in link"}</Button>
        {sent && <Button type="button" variant="link" onClick={() => { setSent(false); setError(""); }}>Change email</Button>}
      </form>}
      <Link to="/menu" className="mt-8 block text-sm text-muted-foreground underline">Back to menu</Link>
    </main>
  </div>;
}