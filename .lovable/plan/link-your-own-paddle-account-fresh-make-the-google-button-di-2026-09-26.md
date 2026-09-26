# Link your own Paddle account fresh + make the Google button display-only

## 1. Google button: keep the look, remove everything behind it
- Keep the white "Continue with Google" / "Sign up with Google" buttons exactly as they look now on the sign-in and sign-up windows.
- Pressing them does nothing that leaves the site: no redirect, no Google link, no data sent. It shows a small note "Google sign-in is coming soon" so people are not confused.
- Remove the old Google sign-in plumbing completely: the Lovable sign-in helper, its package, and the Google return/redirect handling.
- Turn off the Google sign-in provider in the backend so no old Google settings remain. Email + password sign-in stays exactly as it is, and existing accounts are untouched.
- Result: a clean slate for you to build Google sign-in from scratch later.

## 2. Paddle: connect your own approved account from zero
- Disconnect the current built-in test payments setup from the site.
- Connect your own Paddle account through a secure connect card (you sign in / paste your Paddle key there, never in chat). Both your live and sandbox (test) keys can be added.
- Start fresh: clear the old saved plan prices, payment IDs and stored checkout records that pointed to the previous setup, so nothing old conflicts. Accounts, admin roles and study data are NOT touched.
- Rebuild the plans (monthly/packs/toolkit) as new products and prices in your Paddle account, using the same names and prices shown on the site today (I'll confirm them with you before creating).
- Set up the payment notification address (webhook) for your domain and give you the exact URL + steps to paste into Paddle, with its signing secret saved securely.
- Make sure your approved website domain is the one checkout opens on.

## 3. Verification
- Google button: click it on phone and desktop, confirm no redirect happens and no Google request is made.
- Email sign-in and sign-out still work with your admin account.
- Paddle: test purchase in sandbox, confirm the plan activates on "My plan", confirm webhook arrives; then switch to live.

## What you will need to do
1. Approve this plan.
2. Complete the Paddle connect card (live + sandbox keys from Paddle > Developer tools > Authentication).
3. Paste the webhook URL I give you into Paddle > Notifications and save the secret in the secure form.
4. Publish after the sandbox test passes.

## Technical detail
- Remove `lovable.auth.signInWithOAuth` calls in `AuthDialog.tsx` (`handleGoogle`, `googleSignUp`) → toast only; delete `src/integrations/lovable/index.ts`; `bun remove @lovable.dev/cloud-auth-js`; disable Google via `supabase--configure_social_auth`.
- Paddle: replace managed gateway (`paddle.server.ts` gatewayFetch via connector-gateway, `VITE_PAYMENTS_*` tokens) with BYOK Paddle connection (`standard_connectors--connect paddle`), respecting the returned `uses_connector_gateway` flag; client-side token from the connection's public field.
- Migration clearing old price-mapping/subscription/webhook-event rows (after reading the actual tables), keeping profiles/roles/content.
- Webhook stays at `/api/public/payments/webhook` with signature verification using the new secret.

do u want to apply it like lovable
