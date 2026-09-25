# Fix the checkout page and put payments in test mode

Clicking a plan currently lands on the "This page didn't load" screen instead of a payment form. The published site is set to live payments, but the plan catalogue only exists in the test account, and the live payment key/catalogue mismatch is the most likely cause. The exact crash is not confirmed yet, so step 1 is to reproduce it and read the real error before changing anything else.

## 1. Confirm the cause

- Open the published checkout for a paid plan while signed in and capture the browser console plus the server log for that request.
- Check whether the plan being clicked has a payment ID stored for the chosen billing period (monthly / yearly / one-time).
- Only then apply the fix below; if the log shows a different cause, fix that instead and say so.

## 2. Force test mode everywhere until Paddle approves the account

- Decide the payment environment in one place on the server, not from the browser token: if the test catalogue is the only one that has the plan, the page opens the test payment form with the test token.
- Add the test token to the published settings so the published site can open a test payment form (today only a live token exists in production, which is why a test price cannot open).
- Keep the orange "all payments here are test payments" strip visible whenever the test environment is in use.

## 3. Make the page never show the broken screen

- No purchase step may crash the page: missing plan, missing price, payment script blocked, or payment service error all render a calm message inside the checkout card with a "Try again" button and the support email.
- If the plan or billing period in the address is unknown, show a short "pick a plan" card linking back to the plans page instead of failing.
- Keep the page useful for a signed-out visitor (so Paddle's reviewer can see it) instead of bouncing straight to sign-in: show the order summary and a "Sign in to pay" button.

## 4. Meet Paddle's checkout requirements

The page keeps, in clearly visible places:
- Plan name, exact amount, currency and billing period before payment.
- Cards only, no other payment brands added by us.
- Links to Terms, Privacy and Refund policy plus the Merchant-of-Record sentence naming Paddle.
- Support email and the promo-code field.

## 5. Verify

- Signed-in test purchase with the test card, ending on the success page and the plan appearing on the account.
- Wrong/unknown plan, no network, and blocked payment script all show the friendly card, never the error screen.
- Desktop and iPad widths, no console errors.

## Technical notes

- `src/lib/paddle.ts`: environment/token selection currently derives from `VITE_PAYMENTS_CLIENT_TOKEN` prefix and falls back to a `VITE_PAYMENTS_TEST_CLIENT_TOKEN` that is not defined in `.env.production`; initializing `sandbox` with a `live_` token fails. Return the environment and the matching token together, sourced from the resolver result.
- `src/utils/payments.functions.ts`: keep the sandbox fallback, but return a structured result (`{ paddlePriceId, environment }` or `{ error }`) instead of throwing, so the UI can render a message.
- `src/routes/checkout.index.tsx`: wrap plan query, price resolution and `openCheckout` in explicit states (loading / not-purchasable / failed / ready); remove the sign-in redirect in favour of a sign-in call to action.
- `src/hooks/usePaddleCheckout.ts`: keep `allowedPaymentMethods: ["card"]` and `showAddTaxId: false`; surface Paddle's `checkout.error` event into the same failure state.
- Add `VITE_PAYMENTS_TEST_CLIENT_TOKEN` to `.env.production` so the published site can run the test form until live is approved.
