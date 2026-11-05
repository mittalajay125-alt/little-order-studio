import { cleanup, fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), request: vi.fn(), claim: vi.fn(), getUser: vi.fn(), setSession: vi.fn(), session: { user: null as null | { id: string }, loading: false } }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({ options, useSearch: () => ({ returnTo: "/checkout" }) }),
  useNavigate: () => mocks.navigate,
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/login-approval.functions", () => ({ requestEmailApproval: mocks.request, claimEmailApproval: mocks.claim }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getUser: mocks.getUser, setSession: mocks.setSession } } }));
vi.mock("@/lib/customer-session", () => ({ useCustomerSession: () => mocks.session }));
vi.mock("@/components/SiteHeader", () => ({ SiteHeader: () => null }));
import { Route } from "@/routes/customer-login";

const open = () => { const C = Route.options.component!; return render(<C />); };
const submitEmail = () => {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "customer@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Send verification link" }));
};

describe("Customer email-link approval login", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.useRealTimers(); sessionStorage.clear(); localStorage.clear(); mocks.session.user = null; mocks.session.loading = false; window.history.replaceState({}, "", "/customer-login"); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("has no 6-digit code field", () => {
    open();
    expect(screen.queryByLabelText("Email code")).toBeNull();
  });

  it("requests a link bound to a fresh 64-hex browser key", async () => {
    mocks.request.mockResolvedValue({ ok: true, requestId: "r1" }); open(); submitEmail();
    await screen.findByText(/Waiting for verification/);
    const arg = mocks.request.mock.calls[0]?.[0].data;
    expect(arg.email).toBe("customer@example.com");
    expect(arg.browserSecret).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.parse(localStorage.getItem("cnm-login-request")!).requestId).toBe("r1");
  });

  it("shows a server refusal and does not start waiting", async () => {
    mocks.request.mockResolvedValue({ ok: false, error: "Please wait 30 seconds before requesting another link." }); open(); submitEmail();
    expect((await screen.findByRole("alert")).textContent).toContain("30 seconds");
    expect(localStorage.getItem("cnm-login-request")).toBeNull();
  });

  it("polls every 2 seconds and signs in this browser once verified", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mocks.request.mockResolvedValue({ ok: true, requestId: "r1" });
    mocks.claim.mockResolvedValueOnce({ status: "pending" }).mockResolvedValueOnce({ status: "signedIn", accessToken: "a", refreshToken: "b" });
    mocks.setSession.mockResolvedValue({ error: null });
    open(); submitEmail();
    await screen.findByText(/Waiting for verification/);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(mocks.claim).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    await waitFor(() => expect(mocks.setSession).toHaveBeenCalledWith({ access_token: "a", refresh_token: "b" }));
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/checkout", replace: true });
  });

  it("stops polling after 60 seconds and offers to check again", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mocks.request.mockResolvedValue({ ok: true, requestId: "r1" });
    mocks.claim.mockResolvedValue({ status: "pending" });
    open(); submitEmail();
    await screen.findByText(/Waiting for verification/);
    await act(async () => { await vi.advanceTimersByTimeAsync(62_000); });
    expect(await screen.findByRole("button", { name: "Check again" })).toBeTruthy();
    const calls = mocks.claim.mock.calls.length;
    expect(calls).toBeLessThanOrEqual(30);
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(mocks.claim.mock.calls.length).toBe(calls);
  });

  it("does not sign in when the request expired", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mocks.request.mockResolvedValue({ ok: true, requestId: "r1" });
    mocks.claim.mockResolvedValue({ status: "expired" });
    open(); submitEmail();
    await screen.findByText(/Waiting for verification/);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect((await screen.findByRole("alert")).textContent).toContain("expired");
    expect(mocks.setSession).not.toHaveBeenCalled();
  });

  it("returns to checkout only after Auth revalidates an existing session", async () => {
    mocks.session.user = { id: "customer" };
    mocks.getUser.mockResolvedValue({ data: { user: { id: "customer" } }, error: null }); open();
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/checkout", replace: true }));
  });

  it("does not navigate if Auth rejects the apparent session", async () => {
    mocks.session.user = { id: "customer" };
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: "expired" } }); open();
    await screen.findByRole("alert");
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
