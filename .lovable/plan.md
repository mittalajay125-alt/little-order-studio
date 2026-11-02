# Replace customer OTP with cross-device email approval

## Outcome
Keep the existing Chocolate-n-More website and customer data. Replace only customer login: a laptop requests a link, a phone confirms the request without signing in, and the original laptop signs in automatically. Admin password login remains unchanged.

## Proposed flow
1. The customer enters their email and selects **Send Login Link**. The server creates a unique request tied to a secret held only by the original browser.
2. Send a separate approval email, not the standard authentication link. The laptop displays **Login link sent to your email** and **Waiting for email verification…**, with cancel and resend controls.
3. The email opens a lightweight verification page. Require one explicit **Verify email** action before approval so email scanners cannot approve requests simply by opening links. Show the requesting device and a matching request phrase so customers can recognize requests they started. This is not an OTP and is not entered on the laptop.
4. After approval, the phone shows **Email Verified Successfully! You can now return to your original device.** It receives no customer session and never redirects to account, menu, or checkout. Same-device link opening shows the same confirmation; the original login tab completes sign-in.
5. The laptop checks every **2 seconds** and claims approval using its private browser secret. Only that browser receives the authenticated session, then returns to the allowlisted account or checkout destination with its cart intact.

## Expiration, cancellation, and safety
- Approval links are single-use and expire after **5 minutes**. Approval and session claim both enforce expiry using server time.
- Polling stops on success, cancellation, expiration, or after **60 seconds**. At timeout the request is cancelled and the customer can resend; its old link can no longer authorize login.
- Resend cancels the previous request, uses new independent secrets, and is subject to a server-enforced cooldown and abuse limits.
- Store only hashes of approval tokens and originating-browser secrets. No password, access token, or refresh token goes in a URL or log.
- Atomically claim approved requests before creating a session; concurrent or repeated claims fail closed. A failed claim cannot be reopened to mint another session.
- Approval never creates a phone session. Never silently switch an already signed-in browser to a different account.
- Reuse existing customer identities and profiles; create a new customer only after email approval, through the existing authentication infrastructure. Never overwrite saved profile fields or recreate existing customers.
- Check the existing owner/admin bootstrap configuration before testing new customers. If no authorized admin exists, block new-customer testing and report it rather than changing admin privileges or deleting records.

## Required configuration and limitations
**Email sending is currently blocked:** this project has no configured sender domain. Complete **More → Emails → Set up email domain** using a real domain you own. A Gmail address cannot serve as the verified sender. Custom-domain sending requires a paid plan; buying a domain may also cost money. No purchase or paid service will be enabled automatically.

After a domain is configured, scaffold the supported email delivery helper and create the dedicated approval message. The standard signup/magic-link email templates and numeric OTP length do not implement this flow and do not need to be repurposed.

The application will not be published automatically. Preview can exercise two isolated browser sessions on the same origin; actual laptop/phone testing requires both devices to reach the same version. The currently published website remains unchanged until you explicitly request publishing.

Login within **10 seconds** of approval is a target, not a guarantee: authentication and network latency still apply. Report the measured time from the real test.

## Technical implementation
- Add one private, server-owned login-request table and narrow atomic SQL functions via an additive migration. Grant only the privileged server access; enable RLS with no anonymous/customer access. Do not alter existing customer, order, product, price, address, or role records. This table tracks authentication requests, not an email queue.
- Use TanStack server functions for initiate, poll/claim, cancel, and explicit approval, retaining CSRF protection and enforcing allowed origins, server-side rate limits, immutable email/request binding, and no-store responses.
- Keep the original-browser secret in a Secure, HttpOnly, SameSite cookie; separate request IDs allow isolated pending requests. Email approval capabilities alone must never be sufficient to claim a session.
- Use a server-only Cloud Auth admin link-generation operation **only after approved atomic claim**, then redeem it with an isolated, non-persisting server authentication client. Never send its generated sign-in link or redeemable token to either device.
- Deliver session credentials only in the HTTPS, no-store claim response to the original browser and install them using the existing auth SDK. Browser-held sessions necessarily contain credentials; never hardcode them, expose them in URLs/telemetry, or send them to the phone. Preserve existing session storage and owner-scoped reads.
- Use a dedicated approval page with no third-party assets, no token-bearing query strings, no-referrer policy, and capability removal from the address bar before actions. Ensure existing error reporting cannot capture approval secrets.
- Replace obsolete customer OTP controls/tests and adjust customer session rules only as needed; preserve password recovery, managed protected-route gating, cart restoration, and existing admin access.
- Record the new authentication boundaries in project architecture notes.

## Verification and completion report
- Run existing login, account/profile, ownership, cart, and routing tests.
- Add concrete tests for 2-second polling, 60-second timeout, 5-minute expiry, single-use approval/claim, invalid tokens, wrong-browser secrets, cancellation, resend invalidation, concurrent claims, multiple requests, same-device opening, and existing/new customer handling.
- Exercise two separate browser contexts with an actual delivered email: request on the first, approve on the second, verify no second-device session, verify first-device account/checkout access and persisted cart/profile, and measure approval-to-login time.
- Check the latest website errors. Report exact files changed, tests passed, configuration still required, and any unverified scenarios. Do not claim the replacement works from mocked tests or an injected session alone.

**Implementation starts after architecture approval. Until email setup and real verification are complete, do not present this replacement as a working login.**