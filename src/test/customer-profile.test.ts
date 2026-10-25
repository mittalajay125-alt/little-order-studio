import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), upsert: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
import { customerDataQuery } from "@/lib/customer-queries";

describe("Profile provisioning after login", () => {
  beforeEach(() => vi.clearAllMocks());
  function setup(profile: { user_id: string; full_name: string } | null) {
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.from.mockImplementation((table: string) => table === "profiles" ? {
      upsert: mocks.upsert,
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile, error: null }), single: async () => ({ data: { user_id: "customer", full_name: "" }, error: null }) }) }),
    } : { select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }) });
  }
  async function load() {
    const query = customerDataQuery("customer");
    if (typeof query.queryFn !== "function") throw new Error("Missing customer query");
    return query.queryFn({ queryKey: query.queryKey, signal: new AbortController().signal, client: {} as never, meta: undefined });
  }
  it("creates a missing profile without overwriting a concurrent profile", async () => {
    setup(null); await load();
    expect(mocks.upsert).toHaveBeenCalledWith({ user_id: "customer" }, { onConflict: "user_id", ignoreDuplicates: true });
  });
  it("preserves an existing customer's name on repeated login", async () => {
    setup({ user_id: "customer", full_name: "Ajay" });
    const result = await load();
    expect(result.profile?.full_name).toBe("Ajay");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});