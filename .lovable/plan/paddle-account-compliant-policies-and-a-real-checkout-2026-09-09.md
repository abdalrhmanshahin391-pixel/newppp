# Paddle account, compliant policies, and a real checkout

Right now clicking "Buy" fails because no payment account is connected to the site yet — there is nothing behind the button. This plan sets up the account, makes the site meet Paddle's approval checklist, and rebuilds the checkout page so buying works and looks like the rest of RitaJet.

## 1. What Paddle asks for before approving a seller

Paddle reviews the live site against its checklist. The site already has most of it; I will confirm each item and fill the gaps:

- A clear description of what is sold and what each plan includes, before payment.
- Prices in a stated currency (USD), with tax added at checkout by Paddle.
- Terms of use, Privacy policy, Refund/cancellation policy — each on its own public page, linked from the footer and reachable from checkout.
- A real, monitored support email with a stated reply time, shown on the refund page and in the footer.
- Seller identity stated as an individual person (sole trader), not a company.
- Delivery explained (instant digital access, nothing shipped).
- Cancellation explained (self-serve, no fee, access until the period ends).
- The line Paddle requires: their name as Merchant of Record and handler of returns and billing enquiries.
- No prohibited content, no claims of accreditation, no other brand names.

The refund rules stay as they are today: 14 days money-back on a first purchase, cancel any time, pro-rata refund if a paid feature is withdrawn. The support email will be shown on the refund page, in the terms, in the footer, and on the checkout page itself so a buyer always has a way to reach a human.

## 2. Email and branding clean-up

- Replace `ritajetweb@outlook.com` with **ritajetnetwork@outlook.com** everywhere it appears (footer, legal pages, notification sender).
- Sweep the whole site for any leftover mention of AquaQbank, a university, or the old course product, and remove or reword it. RitaJet is described only as flashcards and study tools. (The private toolkit access code keeps its wording since it is not shown as a brand.)
- Wording everywhere describes one person running a web service — never "we are a company".

## 3. Creating the Paddle account

1. I open the Paddle sign-up form pre-filled with **ritajetnetwork@outlook.com**; you approve it.
2. A test environment is created immediately, so a full purchase can be run without real money.
3. I create every plan and credit pack in Paddle to match the pricing page, connect them to the site, and wire the payment notifications so a completed payment upgrades the account automatically.
4. I run a test purchase end to end and report the result.
5. You then upload your legal papers in Paddle for verification. That is the only step I cannot do for you; once approved, live payments switch on with no further code changes.

## 4. The checkout page

- Clicking any plan or pack lands on RitaJet's own checkout page with the payment form embedded inside it — the buyer never feels thrown off the site.
- Redesigned to match the first two cards of the home page and the toolkit section: same fonts, same pill buttons, same cream/green colours, rounded cards, generous spacing.
- Left side: the payment form. Right side: order summary with the plan name, price, billing period, what is included, and the trust row (secure payment, 14-day money-back, cancel any time, support reply time).
- Links to Terms, Privacy and Refund policy directly under the pay button, plus the support email.
- Clear, friendly messages instead of a raw error if anything goes wrong, and a clean confirmation page after payment with the plan already applied.

## Technical notes

- No `VITE_PAYMENTS_*` token exists in the environment, which is why `initializePaddle` throws "Payments are not configured" — this is the cause of the buy error, not the checkout code.
- Run `recommend_payment_provider`, then `enable_paddle_payments` with `suggested_email` set to the new address; create the catalog with `batch_create_product` mapped to `plans.paddle_price_monthly / _yearly / _once`.
- Keep the inline `frameTarget` flow in `usePaddleCheckout`; keep the sandbox fallback in `resolvePaddlePrice` until live is verified.
- Verify `/api/public/payments/webhook` grants plans and one-time packs against the created sandbox products.
- Update `SELLER_*` / `SUPPORT_EMAIL` constants in `src/lib/legal-content.ts` and the VAPID subject in `src/lib/web-push.server.ts`.
- Restyle `src/routes/checkout.index.tsx` and `checkout.success.tsx` against the home page card and button styles.
- The Lovable badge stays hidden.
