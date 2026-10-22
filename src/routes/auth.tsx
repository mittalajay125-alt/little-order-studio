import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Admin login — Chocolate-n-More" },
      { name: "description", content: "Staff sign-in for Chocolate-n-More." },
      { property: "og:title", content: "Admin login — Chocolate-n-More" },
      { property: "og:description", content: "Staff sign-in." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

type Mode = "in" | "up" | "forgot" | "reset";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // A password-recovery email link lands back here with ?type=recovery
    // (or fires PASSWORD_RECOVERY once the session is hydrated).
    if (new URLSearchParams(window.location.search).get("type") === "recovery") {
      setMode("reset");
    }
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("reset");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      navigate({ to: "/admin" });
    } else if (mode === "up") {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/admin` } });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Check your email to confirm your account, then sign in.");
      setMode("in");
    } else if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Password reset link sent — check your email, then set a new password.");
      setMode("in");
    } else {
      const { error } = await supabase.auth.updateUser({ password });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Password updated — you are signed in.");
      window.history.replaceState({}, "", "/auth");
      navigate({ to: "/admin" });
    }
  }

  const titles: Record<Mode, string> = {
    in: "Admin sign in",
    up: "Create admin account",
    forgot: "Reset your password",
    reset: "Set a new password",
  };

  const field = "w-full rounded-xl border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-ring";
  return (
    <div className="flex min-h-screen items-center justify-center bg-cocoa-gradient px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-card p-8 shadow-warm">
        <h1 className="text-2xl font-bold">{titles[mode]}</h1>
        {mode !== "reset" && (
          <input className={field} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        )}
        {mode !== "forgot" && (
          <input className={field} type="password" placeholder={mode === "reset" ? "New password" : "Password"} minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
        )}
        <button disabled={busy} className="w-full rounded-full bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-60">
          {busy ? "Please wait…" : mode === "in" ? "Sign in" : mode === "up" ? "Sign up" : mode === "forgot" ? "Send reset link" : "Save new password"}
        </button>
        {mode === "in" && (
          <button type="button" onClick={() => { setMode("forgot"); setPassword(""); }} className="w-full text-sm text-muted-foreground underline">
            Forgot password?
          </button>
        )}
        <button type="button" onClick={() => { setMode(mode === "up" ? "in" : "up"); setPassword(""); }} className="w-full text-sm text-muted-foreground underline">
          {mode === "up" ? "Have an account? Sign in" : "First time? Create the owner account"}
        </button>
        {(mode === "forgot" || mode === "reset") && (
          <button type="button" onClick={() => { setMode("in"); setPassword(""); }} className="w-full text-sm text-muted-foreground underline">
            Back to sign in
          </button>
        )}
      </form>
    </div>
  );
}
