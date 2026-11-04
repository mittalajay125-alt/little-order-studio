import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { safeReturnPath } from "@/lib/customer";
import { useCustomerSession } from "@/lib/customer-session";
import { APPROVAL_LINK_LIFETIME_MS, APPROVAL_POLL_INTERVAL_MS, createApprovalCapability, shouldPollApproval } from "@/lib/login-approval";
import { claimEmailApproval, requestEmailApproval } from "@/lib/login-approval.functions";

export const PENDING_KEY = "cnm-login-request";
type Pending = { requestId: string; browserSecret: string; email: string; createdAt: number };

export const Route = createFileRoute("/customer-login")({
  validateSearch: (search: Record<string, unknown>) => ({ returnTo: search["returnTo"] === "/checkout" ? "/checkout" as const : undefined }),
  head: () => ({ meta: [
    { title: "Customer login — Chocolate-n-More" },
    { name: "description", content: "Sign in to your Chocolate-n-More account with an email verification link." },
    { property: "og:title", content: "Customer login — Chocolate-n-More" },
    { property: "og:description", content: "Your dessert orders and saved addresses." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: CustomerLogin,
});

function readPending(): Pending | null {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "null") as Pending | null;
    return p && Date.now() - p.createdAt < APPROVAL_LINK_LIFETIME_MS ? p : null;
  } catch { return null; }
}

function CustomerLogin() {
  const navigate = useNavigate();
  const { returnTo } = Route.useSearch();
  const { user, loading } = useCustomerSession();
  const request = useServerFn(requestEmailApproval);
  const claim = useServerFn(claimEmailApproval);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [pollStart, setPollStart] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigating = useRef(false);

  const finishSignIn = useCallback(async () => {
    if (navigating.current) return;
    navigating.current = true;
    try {
      const destination = safeReturnPath(returnTo ?? sessionStorage.getItem("customer-login-return"));
      await navigate({ to: destination, replace: true });
      sessionStorage.removeItem("customer-login-return");
    } finally { navigating.current = false; }
  }, [returnTo, navigate]);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    if (search.get("link") === "blocked") setError("That link can't sign in this device. Use the verification link only to confirm, then return to the device where you requested sign-in.");
    const p = readPending();
    if (p) { setPending(p); setEmail(p.email); setPollStart(Date.now()); } else localStorage.removeItem(PENDING_KEY);
  }, []);

  // Already signed in on this browser: confirm with Auth, then continue.
  useEffect(() => {
    if (loading || !user) return;
    let active = true;
    void supabase.auth.getUser().then(async ({ data, error }) => {
      if (!active) return;
      if (error || !data.user) { setError("We could not confirm your sign-in. Please request a new link."); return; }
      await finishSignIn();
    }).catch(() => { if (active) setError("We could not finish signing you in. Check your connection and try again."); });
    return () => { active = false; };
  }, [loading, user, finishSignIn]);

  // Original browser polls every 2 seconds for up to 60 seconds.
  useEffect(() => {
    if (!pending || !pollStart) return;
    let active = true;
    setTimedOut(false);
    const tick = async () => {
      if (!active) return;
      if (!shouldPollApproval("pending", pollStart, Date.now())) { setTimedOut(true); return; }
      try {
        const r = await claim({ data: { requestId: pending.requestId, browserSecret: pending.browserSecret } });
        if (!active) return;
        if (r.status === "signedIn") {
          localStorage.removeItem(PENDING_KEY);
          const { error } = await supabase.auth.setSession({ access_token: r.accessToken, refresh_token: r.refreshToken });
          if (error) { setError("Verification succeeded but sign-in failed. Please request a new link."); setPending(null); return; }
          await finishSignIn();
          return;
        }
        if (r.status !== "pending") {
          localStorage.removeItem(PENDING_KEY); setPending(null);
          setError(r.status === "expired" ? "This sign-in request expired. Please request a new link." : "Sign-in could not be completed. Please request a new link.");
          return;
        }
      } catch { /* temporary network issue: keep polling */ }
      if (active) timer = setTimeout(tick, APPROVAL_POLL_INTERVAL_MS);
    };
    let timer = setTimeout(tick, APPROVAL_POLL_INTERVAL_MS);
    return () => { active = false; clearTimeout(timer); };
  }, [pending, pollStart, claim, finishSignIn]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      sessionStorage.setItem("customer-login-return", safeReturnPath(returnTo));
      const browserSecret = createApprovalCapability();
      const r = await request({ data: { email: email.trim(), browserSecret, origin: window.location.origin } });
      if (!r.ok) { setError(r.error); return; }
      const p = { requestId: r.requestId, browserSecret, email: email.trim(), createdAt: Date.now() };
      localStorage.setItem(PENDING_KEY, JSON.stringify(p));
      setPending(p); setPollStart(Date.now());
    } catch { setError("Could not send the verification email. Please try again."); }
    finally { setBusy(false); }
  }

  function changeEmail() { localStorage.removeItem(PENDING_KEY); setPending(null); setError(""); }

  const checking = loading || !!user;
  return <div className="min-h-screen"><SiteHeader />
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-6 text-3xl">{checking ? "Signing you in" : pending ? "Check your email" : "Customer login"}</h1>
      {checking ? <div className="space-y-4">
        {!error && <p role="status" className="text-sm text-muted-foreground">Confirming your sign-in…</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div> : pending ? <div className="space-y-4">
        <p className="text-sm">We sent a verification link to <strong>{pending.email}</strong>. Open it on any device — this screen will sign in automatically.</p>
        {!timedOut ? <p role="status" className="text-sm text-muted-foreground">Waiting for verification…</p>
          : <p role="status" className="text-sm text-muted-foreground">Still waiting. Tapped the link already? Check again.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {timedOut && <Button className="w-full" onClick={() => setPollStart(Date.now())}>Check again</Button>}
        <div className="flex flex-wrap justify-between gap-2">
          <Button type="button" variant="link" disabled={busy} onClick={() => void send()}>Send a new link</Button>
          <Button type="button" variant="link" disabled={busy} onClick={changeEmail}>Change email</Button>
        </div>
      </div> : <form onSubmit={send} className="space-y-4">
        <label className="block text-sm">Email<input className="mt-2 w-full rounded-md border bg-card px-4 py-3" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button className="w-full" disabled={busy}>{busy ? "Please wait…" : "Send verification link"}</Button>
        <p className="text-xs text-muted-foreground">New and returning customers use the same link. Only this browser will be signed in.</p>
      </form>}
      <Link to="/menu" className="mt-8 block text-sm text-muted-foreground underline">Back to menu</Link>
    </main>
  </div>;
}
