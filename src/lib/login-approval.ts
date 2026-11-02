/** Shared policy for the approval flow. Persistence and authorization must be enforced server-side. */
export const APPROVAL_LINK_LIFETIME_MS = 5 * 60 * 1000;
export const APPROVAL_POLL_INTERVAL_MS = 2 * 1000;
export const APPROVAL_POLL_TIMEOUT_MS = 60 * 1000;

export type ApprovalStatus = "pending" | "approved" | "claiming" | "consumed" | "cancelled" | "failed";
export type ApprovalRecord = {
  status: ApprovalStatus;
  expiresAt: number;
  verificationHash: string;
  browserHash: string;
};

/** Independent 256-bit capabilities; call only inside a request/event handler. */
export function createApprovalCapability(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

export function validApprovalCapability(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

export async function hashApprovalCapability(value: string): Promise<string> {
  if (!validApprovalCapability(value)) throw new Error("Invalid approval capability");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function matchesDigest(actual: string, expected: string): boolean {
  if (!validApprovalCapability(actual) || !validApprovalCapability(expected)) return false;
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}

/** Guard only: production transitions additionally require an atomic database update. */
export function canApprove(record: ApprovalRecord, suppliedHash: string, now: number): boolean {
  return record.status === "pending" && now < record.expiresAt && matchesDigest(suppliedHash, record.verificationHash);
}

/** The emailed capability must never substitute for the original-browser secret. */
export function canClaimApproval(record: ApprovalRecord, suppliedBrowserHash: string, now: number): boolean {
  return record.status === "approved" && now < record.expiresAt && matchesDigest(suppliedBrowserHash, record.browserHash);
}

export function shouldPollApproval(status: ApprovalStatus, startedAt: number, now: number): boolean {
  return (status === "pending" || status === "approved") && now >= startedAt && now - startedAt < APPROVAL_POLL_TIMEOUT_MS;
}