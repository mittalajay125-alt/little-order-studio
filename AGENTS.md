<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Orders are created only through the `place_order` security-definer SQL function, which recomputes all prices from the products/settings tables; never insert orders from the client or trust browser totals.
- Admin access is checked via `public.user_roles` + `has_role()`; the first account to sign up is auto-granted admin by a trigger on auth.users.
- Customer checkout calls `place_customer_order`, which delegates price calculation and order insertion to `place_order`; authenticated ownership and immutable address snapshots are derived in SQL, not from browser identity or totals.
- Customer query keys include user IDs and reads explicitly filter ownership; RLS remains authoritative and sign-out clears query caches to prevent cross-account data reuse.
- Location lookup uses browser geolocation only from the address action and a no-key OpenStreetMap reverse lookup with editable manual fallback; never send account credentials to the geocoding origin.
- Customer email callbacks preserve only allowlisted account/checkout destinations and revalidate the session with Auth before navigating; never treat an email-link click alone as authentication.
- CustomerSessionProvider owns the shared auth listener and defers identity invalidation outside the auth callback; the customer email callback owns its sign-in transition to avoid restarting verification. Keep the managed protected-route gate intact.
- Customer queries briefly reuse owner-keyed data and create missing profiles with insert-only conflict handling; repeat login must not overwrite saved profile fields.
- OTP verification trusts the server-validated verifyOtp response for navigation; returning sessions still use getUser and protected routes keep their managed gate. Profile email comes from Auth, contact phone from the existing profiles row.
- Cart persistence writes only after storage restoration completes, so full-page authentication and refresh cannot overwrite saved items with the initial empty state.
