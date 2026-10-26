import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), send: vi.fn(), verify: vi.fn(), getUser: vi.fn(), session: { user: null as null | { id: string }, loading: false } }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({ options, useSearch: () => ({ returnTo: "/checkout" }) }),
  useNavigate: () => mocks.navigate,
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signInWithOtp: mocks.send, verifyOtp: mocks.verify, getUser: mocks.getUser } } }));
vi.mock("@/lib/customer-session", () => ({ useCustomerSession: () => mocks.session }));
vi.mock("@/components/SiteHeader", () => ({ SiteHeader: () => null }));
import { Route } from "@/routes/customer-login";

describe("Customer email-code authentication", () => {
  beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); mocks.session.user = null; mocks.session.loading = false; window.history.replaceState({}, "", "/customer-login"); });
  afterEach(cleanup);
  const open = () => {
    const Component = Route.options.component;
    if (!Component) throw new Error("Customer login component is missing");
    return render(<Component />);
  };
  it("requests account creation and a same-origin checkout callback", async () => {
    mocks.send.mockResolvedValue({ error: null }); open();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "customer@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledWith({ email: "customer@example.com", options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/customer-login?returnTo=%2Fcheckout` } }));
    expect(sessionStorage.getItem("customer-login-return")).toBe("/checkout");
  });
  it("does not record success or a cooldown after an Auth refusal", async () => {
    mocks.send.mockResolvedValue({ error: { message: "Email rate limit exceeded" } }); open();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "customer@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    await screen.findByRole("alert");
    expect(sessionStorage.getItem("customer-otp-cooldown")).toBeNull();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
  it("returns to checkout only after Auth revalidates the session", async () => {
    mocks.session.user = { id: "customer" };
    mocks.getUser.mockResolvedValue({ data: { user: { id: "customer" } }, error: null }); open();
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/checkout", replace: true }));
    expect(mocks.getUser).toHaveBeenCalled();
  });
  it("does not navigate if Auth rejects the apparent session", async () => {
    mocks.session.user = { id: "customer" };
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: "Session expired" } }); open();
    await screen.findByRole("alert");
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
  it("does not sign in the original browser just because its email was sent", async () => {
    mocks.send.mockResolvedValue({ error: null }); open();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "customer@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    await waitFor(() => expect(sessionStorage.getItem("customer-otp-cooldown")).not.toBeNull());
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
  it("verifies a callback once without an artificial navigation timer", async () => {
    mocks.session.user = { id: "customer" };
    mocks.getUser.mockResolvedValue({ data: { user: { id: "customer" } }, error: null }); open();
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledTimes(1));
    expect(mocks.getUser).toHaveBeenCalledTimes(1);
  });
  it("handles a failed verification connection without navigating", async () => {
    mocks.session.user = { id: "customer" };
    mocks.getUser.mockRejectedValue(new Error("Network unavailable")); open();
    await screen.findByRole("alert");
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
  it("verifies the six-digit code on the requesting device using email type", async () => {
    mocks.send.mockResolvedValue({ error: null });
    mocks.verify.mockResolvedValue({ data: { user: { id: "customer" }, session: { user: { id: "customer" } } }, error: null }); open();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "customer@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    await screen.findByLabelText("Email code");
    fireEvent.change(screen.getByLabelText("Email code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify code" }));
    await waitFor(() => expect(mocks.verify).toHaveBeenCalledWith({ email: "customer@example.com", token: "123456", type: "email" }));
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/checkout", replace: true });
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
  it("rejects invalid codes without signing the customer in", async () => {
    sessionStorage.setItem("customer-otp-email", "customer@example.com");
    mocks.verify.mockResolvedValue({ data: { user: null, session: null }, error: { message: "Code expired" } }); open();
    fireEvent.change(screen.getByLabelText("Email code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify code" }));
    await screen.findByRole("alert");
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
  it("does not verify a code shorter than six digits", async () => {
    sessionStorage.setItem("customer-otp-email", "customer@example.com"); open();
    fireEvent.change(screen.getByLabelText("Email code"), { target: { value: "12345" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify code" }));
    expect(mocks.verify).not.toHaveBeenCalled();
  });

});