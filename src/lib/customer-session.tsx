import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthChangeEvent, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const CustomerSession = createContext<{ user: User | null; loading: boolean }>({ user: null, loading: true });
export function CustomerSessionProvider({ children, onIdentityChange }: { children: ReactNode; onIdentityChange?: (event: AuthChangeEvent) => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
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