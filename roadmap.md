# Phase 2 delivery charges
- [x] Inspect checkout, saved-address coordinates, settings, and order calculation structure.
- [ ] Obtain exact shop delivery location; blocked because shop coordinates and stall address are not configured.
- [ ] Implement configurable shop coordinates, straight-line delivery pricing, checkout distance display and range blocking, and saved order distance.
- [ ] Test delivery boundaries, pickup exemption, address changes, and authoritative order totals; do not publish automatically.

# Customer account upgrade
- [x] Replace customer OTP with originating-browser email approval (PKCE, default sender); 30 tests pass.
- [x] Approve architecture and prepare capability hashing, expiry, polling, and transition policy tests; these are not a working authentication flow.
- [x] Sender domain not required for the first implementation (uses default auth email).
- [ ] Verify actual emailed approval in separate browser sessions, including expiry, replay, cancellation, resend, and multiple requests; waiting on the user's real two-device test.
- [x] Implement six-digit OTP verification, resend cooldown, error handling, and checkout return; automated tests pass. Actual email delivery remains blocked below.
- [x] Save customer phone in existing profiles; desktop/mobile UI save and refresh passed, original values restored, existing email/name preserved.
- [x] Fix cart restoration across full callbacks and refresh; automated and desktop/mobile checks confirm preservation.
- [x] Diagnose separate-device sessions and redundant identity invalidation/listeners; streamline sign-in, existing-session account return measured about 2–3 seconds. Original 30–40-second real mailbox delay not reproduced.
- [x] Diagnose email-login mismatch and use requested link-only fallback; 12 tests pass, browser checks confirm the form and expired-link error, and build is OK. Real mailbox link consumption remains unverified.
- [x] Resolve verification-link return to checkout; validated signed-in session reaches checkout with cart intact and expired-link errors display. Six-digit email template still awaits sender-domain setup.
- [x] Add admin password recovery; reset request accepted and missing-link rejection tested.
- [x] Inspect current authentication, ordering, and deployment setup.
- [x] Add email OTP customer login controls and persistent account access.
- [x] Add secure customer profiles, saved addresses, and order ownership.
- [x] Integrate confirmed addresses and sign-in with checkout without losing cart.
- [x] Test signed-in address CRUD, checkout, immutable order addresses, admin cancellation, logout, mobile layout, and controlled location outcomes; eight automated tests pass.
- [x] Make customer login code-only: request/verify methods match, emailed sign-in links are rejected with a message; 24 tests pass.
- [x] Retire the previous code-only email configuration task; the latest request replaces OTP with originating-browser email approval.
- [ ] Verify real email signup/login and complete password reset: waiting on access to an emailed code/reset link; the reset request was accepted but receipt and password update are unverified.
- [ ] Verify two-customer isolation end-to-end: waiting on a second confirmed customer test account; owner-scoped policies reviewed, but tests used the owner's admin account.
- [x] Report completed features, configuration blockers, and test results.