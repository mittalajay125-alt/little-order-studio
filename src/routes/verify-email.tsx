import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/SiteHeader";
import { confirmEmailApproval } from "@/lib/login-approval.functions";

export const Route = createFileRoute("/verify-email")({
  head: () => ({ meta: [
    { title: "Verify your email — Chocolate-n-More" },
    { name: "description", content: "Confirm your Chocolate-n-More sign-in request." },
    { property: "og:title", content: "Verify your email — Chocolate-n-More" },
    { property: "og:description", content: "Confirm your Chocolate-n-More sign-in request." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: VerifyEmail,
});

function VerifyEmail() {
  const confirm = useServerFn(confirmEmailApproval);
  const [state, setState] = useState<"working" | "done" | "failed">("working");
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const search = new URLSearchParams(window.location.search);
    const requestId = search.get("rid") ?? "";
    const code = search.get("code") ?? "";
    // Remove the one-time code from the address bar and history; this device never signs in.
    window.history.replaceState({}, "", "/verify-email");
    if (!requestId || !code) { setState("failed"); return; }
    confirm({ data: { requestId, code } })
      .then(r => setState(r.ok ? "done" : "failed"))
      .catch(() => setState("failed"));
  }, [confirm]);
  return <div className="min-h-screen"><SiteHeader />
    <main className="mx-auto max-w-sm px-4 py-16 text-center">
      {state === "working" && <p role="status" className="text-muted-foreground">Verifying your email…</p>}
      {state === "done" && <><h1 className="mb-4 text-3xl">Your email is verified successfully</h1>
        <p className="text-sm text-muted-foreground">Go back to the device where you asked to sign in — it will sign in automatically. You can close this page.</p></>}
      {state === "failed" && <><h1 className="mb-4 text-3xl">Link not valid</h1>
        <p className="text-sm text-muted-foreground">This link has expired or was already used. Request a new link on the device where you want to sign in.</p>
        <Link to="/customer-login" search={{ returnTo: undefined }} className="mt-6 inline-block text-sm underline">Customer login</Link></>}
    </main>
  </div>;
}
