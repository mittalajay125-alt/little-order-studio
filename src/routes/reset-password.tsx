import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "Reset password — Chocolate-n-More" }, { name: "description", content: "Securely reset your Chocolate-n-More admin password." },
    { property: "og:title", content: "Reset password — Chocolate-n-More" }, { property: "og:description", content: "Set your new admin password." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: ResetPassword,
});
function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const recovery = new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";
    if (recovery) sessionStorage.setItem("cnm-password-recovery", "true");
    supabase.auth.getUser().then(({ data }) => setReady(!!data.user && sessionStorage.getItem("cnm-password-recovery") === "true"));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") { sessionStorage.setItem("cnm-password-recovery", "true"); setReady(!!session?.user); }
    });
    return () => data.subscription.unsubscribe();
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (!ready) { setError("Open a fresh password reset link from your email."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { setError(error.message); return; }
    sessionStorage.removeItem("cnm-password-recovery");
    await navigate({ to: "/admin", replace: true });
  }
  return <div className="flex min-h-screen items-center justify-center bg-cocoa-gradient px-4"><form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-card p-8 shadow-warm"><h1 className="text-2xl">Set a new password</h1>{ready ? <><label className="block text-sm">New password<input className="mt-1 w-full rounded-md border px-3 py-3" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} /></label><label className="block text-sm">Confirm password<input className="mt-1 w-full rounded-md border px-3 py-3" type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={e => setConfirm(e.target.value)} /></label><Button className="w-full" disabled={busy}>{busy ? "Saving…" : "Save new password"}</Button></> : <p className="text-sm">Open a fresh password reset link from your email to continue.</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Link to="/auth" className="block text-sm underline">Back to admin sign in</Link></form></div>;
}