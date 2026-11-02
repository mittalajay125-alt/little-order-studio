import { webcrypto } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  APPROVAL_LINK_LIFETIME_MS, APPROVAL_POLL_INTERVAL_MS, APPROVAL_POLL_TIMEOUT_MS,
  canApprove, canClaimApproval, createApprovalCapability, hashApprovalCapability,
  shouldPollApproval, validApprovalCapability, type ApprovalRecord,
} from "@/lib/login-approval";

beforeAll(() => { vi.stubGlobal("crypto", webcrypto); });
const verificationHash = "a".repeat(64);
const browserHash = "b".repeat(64);
const request = (status: ApprovalRecord["status"] = "pending"): ApprovalRecord => ({ status, expiresAt: 300_000, verificationHash, browserHash });

describe("Cross-device login approval policy", () => {
  it("expires approval links after five minutes", () => {
    expect(APPROVAL_LINK_LIFETIME_MS).toBe(300_000);
    expect(canApprove(request(), verificationHash, 299_999)).toBe(true);
    expect(canApprove(request(), verificationHash, 300_000)).toBe(false);
    expect(canClaimApproval(request("approved"), browserHash, 300_000)).toBe(false);
  });
  it("uses two-second polling", () => { expect(APPROVAL_POLL_INTERVAL_MS).toBe(2_000); });
  it("stops polling at sixty seconds", () => {
    expect(APPROVAL_POLL_TIMEOUT_MS).toBe(60_000);
    expect(shouldPollApproval("pending", 10_000, 69_999)).toBe(true);
    expect(shouldPollApproval("pending", 10_000, 70_000)).toBe(false);
  });
  it("rejects reused verification capabilities", () => {
    expect(canApprove(request(), verificationHash, 1)).toBe(true);
    for (const status of ["approved", "claiming", "consumed", "cancelled", "failed"] as const) {
      expect(canApprove(request(status), verificationHash, 1)).toBe(false);
    }
  });
  it("rejects invalid and substituted approval capabilities", () => {
    expect(canApprove(request(), "invalid", 1)).toBe(false);
    expect(canApprove(request(), browserHash, 1)).toBe(false);
  });
  it("requires approval and the originating browser secret to claim", () => {
    expect(canClaimApproval(request(), browserHash, 1)).toBe(false);
    expect(canClaimApproval(request("approved"), browserHash, 1)).toBe(true);
    expect(canClaimApproval(request("approved"), verificationHash, 1)).toBe(false);
    expect(canClaimApproval(request("claiming"), browserHash, 1)).toBe(false);
    expect(canClaimApproval(request("consumed"), browserHash, 1)).toBe(false);
  });
  it("stops polling on success, cancellation, and failure", () => {
    for (const status of ["claiming", "consumed", "cancelled", "failed"] as const) {
      expect(shouldPollApproval(status, 0, 1)).toBe(false);
    }
  });
  it("isolates separate pending requests and invalidates a cancelled request", () => {
    const second = { ...request(), verificationHash: "c".repeat(64), browserHash: "d".repeat(64) };
    expect(canApprove(second, verificationHash, 1)).toBe(false);
    expect(canClaimApproval({ ...second, status: "approved" }, browserHash, 1)).toBe(false);
    expect(canApprove(request("cancelled"), verificationHash, 1)).toBe(false);
  });
  it("creates independent capabilities and stores a digest rather than the capability", async () => {
    const capability = createApprovalCapability();
    expect(validApprovalCapability(capability)).toBe(true);
    expect(createApprovalCapability()).not.toBe(capability);
    const digest = await hashApprovalCapability(capability);
    expect(validApprovalCapability(digest)).toBe(true);
    expect(digest).not.toBe(capability);
    expect(await hashApprovalCapability(capability)).toBe(digest);
    await expect(hashApprovalCapability("invalid")).rejects.toThrow("Invalid approval capability");
  });
});