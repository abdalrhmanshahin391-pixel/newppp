# RitaJet: repair Paddle checkout on iPad and polish the purchase experience

## Brief to give Antigravity
Repair the existing Paddle integration rather than replacing it or adding a second payment provider. Desktop checkout reportedly works, while iPad fails after Apple Pay was enabled. Preserve working purchases, accounts, prices, promo codes, and plan access. Do not blame a tool or assume Apple Pay is the cause without reproducing the error.

## Confirmed in the current code
- Touch-primary devices use Paddle overlay checkout; desktop uses inline checkout. This is selected by pointer type, not actual payment capability.
- The option named `cardsOnly` currently permits both `card` and `paypal`, which contradicts its name.
- Checkout opens automatically after plan and account data load.
- The page marks checkout ready immediately after `Checkout.open()`, not after a Paddle loaded event.
- Paddle initialization has no event callback, and script loading has no timeout.
- Checkout already passes a success URL and the signed-in user's ID. Preserve both.

These observations identify weaknesses, not a proven explanation of the reported iPad error.

## 1. Reproduce before changing behavior
- Obtain the exact error text or screenshot, iPadOS version, browser, page URL, and whether failure happens before or after selecting Apple Pay.
- Reproduce on a real iPad Safari using the same plan, account, domain, and payment environment as the working desktop test.
- Capture sanitized Paddle events, failed requests, and error codes. Never record payment details, tokens, or personal customer data.
- Distinguish an application crash from a Paddle load failure, Apple Pay eligibility issue, merchant validation failure, or declined payment.

## 2. Correct Apple Pay and card availability
- Check current official Paddle documentation for Apple Pay eligibility, supported environments, domain requirements, and iframe restrictions for the chosen checkout mode.
- Verify the exact domain used by customers, including www versus non-www, against applicable Paddle requirements. Do not claim domain verification is the cause without evidence.
- Keep Apple Pay available only where Paddle supports it; always provide a working card alternative.
- Make `cardsOnly` actually allow only cards. Do not silently enable PayPal.
- Do not build a separate Apple Pay integration or collect card data in RitaJet.

## 3. Make checkout reliable
- Initialize Paddle once with a retryable script loader, bounded timeout, and event callback.
- Track loading, loaded, closed, completed, and failed states from documented Paddle events; do not treat calling `Checkout.open()` as successful loading.
- Provide an explicit Continue to secure payment button, especially for the mobile overlay, rather than relying only on automatic opening.
- Prevent duplicate opens and stale callbacks when plans or promo codes change; provide a clear reopen action after closing the overlay.
- Choose inline or overlay based on tested support, not the unsupported blanket claim that iOS cannot use cross-origin inline checkout.
- Show useful inline errors with Retry, Pay by card, and Back to plans. Keep the order summary visible.
- Remove unconditional “Nothing was charged” claims after ambiguous failures; check transaction status before advising another payment.

## 4. Polish the page without redesigning the site
- Use RitaJet's existing typography and compact pill buttons.
- Clearly show the selected plan, billing interval, renewal terms, discount, and Paddle-confirmed total including applicable taxes.
- Avoid competing payment buttons, duplicate loading indicators, empty payment areas, and overlapping panels.
- Keep support, privacy, terms, and refund links accessible. Retain Paddle-required disclosures and legally required fields.
- Ensure portrait and landscape iPad layouts fit without horizontal scrolling, including with the on-screen keyboard open.

## 5. Preserve payment correctness
- Verify token, resolved price, promo code, and webhook environment agree. Keep test mode explicit; do not switch to live as a debugging shortcut.
- Preserve authenticated user attribution and success URLs.
- Verify existing webhook signature checks and idempotent processing; grant access only from verified server-side payment state, never from the success-page URL alone.
- Confirm the success page handles delayed webhook delivery without asking the customer to pay twice.

## Acceptance tests
- Real iPad Safari: open, close, reopen, card fallback, eligible Apple Pay, portrait/landscape, and keyboard use.
- Desktop: existing successful flow remains working.
- Slow connection, blocked Paddle script, invalid promo, declined card, refresh, and delayed confirmation show recoverable states rather than a blank page.
- Complete a manual test payment and verify the intended account receives the correct plan exactly once.
- Use browser automation for the surrounding page and checkout opening; real-device manual testing is required to establish Apple Pay works.
- Report the reproduced root cause, changed files, test results, and any remaining Paddle/account approval blocker. Do not declare success based only on compilation or a desktop screenshot.

## Technical scope
Primary files: `src/hooks/usePaddleCheckout.ts`, `src/lib/paddle.ts`, and `src/routes/checkout.index.tsx`. Inspect price resolution, success handling, and webhook code before changing them. No unrelated auth rewrite, database cleanup, provider replacement, or site-wide redesign.
