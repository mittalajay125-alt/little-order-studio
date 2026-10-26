import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthChangeEvent, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isBlockedEmailLink } from "@/lib/customer";

// Captured before the auth client reads and clears the URL fragment.
const blockedLink = typeof window !== "undefined" && isBlockedEmailLink(window.location.hash);

const CustomerSession = createContext<{ user: User | null; loading: boolean }>({ user: null, loading: true });
export function CustomerSessionProvider({ children, onIdentityChange }: { children: ReactNode; onIdentityChange?: (event: AuthChangeEvent) => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!blockedLink) return;
    // Customer login is code-only: discard the session an emailed link created on this device only.
    void supabase.auth.getSession()
      .then(() => supabase.auth.signOut({ scope: "local" }))
      .finally(() => window.location.replace("/customer-login?link=blocked"));
  }, []);
  useEffect(() => {
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (blockedLink) return;
      if (active) { setUser(session?.user ?? null); setLoading(false); }
      if (event === "PASSWORD_RECOVERY") sessionStorage.setItem("cnm-password-recovery", "true");
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        queueMicrotask(() => { if (active) onIdentityChange?.(event); });
      }
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [onIdentityChange]);
  return <CustomerSession.Provider value={{ user, loading }}>{children}</CustomerSession.Provider>;
}
export const useCustomerSession = () => useContext(CustomerSession);
