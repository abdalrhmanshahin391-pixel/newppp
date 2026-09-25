# Card-only payments, a reliable RitaJet, and manual plan grants

This pass will make buying deliberately simple, stop blank-page failures from trapping visitors, tighten the visual system, and give you a proper way to grant access without taking payment.

## 1. Make checkout card-only and working

- Keep the existing built-in payment provider as the only payment system; there will be no second payment integration.
- Restrict the embedded checkout to **credit and debit cards only**. Hide PayPal, Apple Pay, Google Pay, and other optional methods.
- Hide the optional business/tax-number prompt where the provider allows it. Keep only legally required tax information that the payment provider must calculate as Merchant of Record; removing required tax handling would risk approval rather than help it.
- Simplify the page to one trustworthy card form, a clear order summary, promo code, total, refund promise, support address, and required policy links.
- Replace the current rounded/playful treatment with a restrained technology-company style: system-first typography, cleaner spacing, sharper hierarchy, compact RitaJet pills, and the existing brand colors.
- Verify every plan and billing period resolves to the correct test price, opens the card form, accepts a real test promo code, reaches the success page, and grants the purchased plan after the signed payment notice arrives.
- Do not claim live payment success before verification is complete. The current readiness checks all pass; identity verification is the remaining blocker for real charges.

## 2. Stop white pages and make the site resilient

The blank page is reproducible at the transport level: both the published home page and local preview timed out with no response during inspection. The code also lacks recovery when a newly published version invalidates an old browser tab’s downloaded files.

- Trace the production request path and current server logs, then fix the confirmed blocking request rather than masking it with a spinner.
- Remove nonessential database work from the first public page response and set strict, short fallbacks so the home page can still render when the backend is slow.
- Add recovery for outdated page files after a publish: retry once with the newest page, then show a real RitaJet error screen with Reload/Home actions instead of a white canvas.
- Catch background imports, account startup, and deferred tools so one failed request cannot unmount the whole site.
- Reduce first-load work on the home page: split below-the-fold sections, defer nonessential account/device/presence work, optimize the critical image/font path, and remove proven-unused eager code.
- Add a lightweight public health endpoint and useful client/server error reporting without exposing private account data.
- Validate cold and repeat loads on iPad/mobile and desktop, slow-network behavior, old-tab-after-publish behavior, signed-out and signed-in navigation, and failure fallbacks. Record response and first-render timings before and after.

## 3. Add useful information above “Share your flashcards”

- Add a concise, editorial information section immediately before the sharing band explaining how RitaJet turns notes into flashcards, supports focused review, and lets students publish useful decks.
- Keep it factual and visual, not a marketing wall, and match the cleaner technology-company typography and button treatment.

## 4. Build safe manual plan grants for admins

The admin area can currently move a username/email onto a plan, but the grant is permanent, has no history, and can be overwritten by later payment updates. Replace that basic control with a proper **Manual access** area.

- Search and select an exact username or email, show the matched account and current paid/manual access before confirming.
- Choose any plan, start date, optional expiry or no expiry, internal reason, and whether the grant should override a paid plan.
- Show active, upcoming, expired, and revoked grants with filters; support renew, change plan, revoke now, and add internal notes.
- Record who granted access and when. Keep manual grants separate from purchases so payment renewals/cancellations cannot silently destroy them.
- Resolve the user’s effective access safely: an active manual grant can override while it lasts, then access falls back to their valid paid plan or Starter automatically.
- Keep all controls admin-only with server-side authorization and row-level protection.

## 5. Final checks

- Confirm every content page keeps unique page metadata and no legal/payment requirement was accidentally removed.
- Run focused type, payment-notice, access-limit, grant-expiry, and browser checks.
- Complete a card checkout manually in the provider’s cross-site payment frame, because browser automation cannot enter card details there.

## Technical details

- Pass the provider-supported `allowedPaymentMethods: ["card"]` restriction when opening checkout and disable optional tax-ID collection if supported by the current checkout API.
- Keep the required `customData.userId`, success URL, verified payment-notice processing, and test/live separation.
- Add a dedicated manual-grants table with explicit grants, indexes, admin policies, audit fields, expiry/revocation, and service access; update effective-plan resolution and quota checks without weakening pre-AI limit enforcement.
- Add timeouts/fallbacks around the root bootstrap, stale dynamic-import recovery, and a nonblank top-level client failure screen.
