# Faster RitaJet, a real buy flow, and live payments

Four jobs in one pass: make the site open fast, clean out everything we no longer use, fix the Google button, and connect payments so you can start selling today.

## 1. Speed

First measure, then fix — no guessing. I will time the home page, look at what the browser has to download before anything appears, and work down the list of the biggest offenders.

What I expect to fix, based on what the project already contains:

- Heavy tools (PDF reading, charts, chemistry/maths rendering, zip files, animation) are currently pulled in far too early. They will only load on the pages that actually need them, so the home page no longer waits for them.
- The home page, pricing page and the guide will be pre-built at publish time, so they arrive as finished pages instead of being assembled on every visit. This needs the build toolkit updated first, otherwise the setting silently does nothing.
- Pictures: correct sizes, modern formats, and only the first visible one loaded eagerly.
- Fonts loaded without blocking the first paint.
- Trim work that runs on every page load before the screen can show.

This follows the same playbook large teams use: ship less code up front, pre-build pages that never change, and let everything else arrive later.

## 2. Clean-up

Remove retired pages and leftovers that no longer serve anyone, and delete unused code and unused packages. Only things proven unreachable get removed — nothing that a live page still uses. The retired `/about` and `/tour` addresses keep their redirect/gone behaviour so search results stay correct.

## 3. Google button

- Rebuild it in Google's official look: white pill, real Google logo, standard wording — this is the style Google requires and also what Paddle reviewers expect to see.
- Move it **above** the email and password fields, with a clear "or" divider underneath.
- Same treatment on both the sign-in and the create-account screens.
- Then I test it end to end and report whether the sign-in actually completes.

## 4. Buying a plan

Right now clicking a plan sends you to a checkout page that cannot take money, because payments were never connected.

- Clicking any plan or pack goes to your own branded checkout page with the order summary, and the payment form embedded inside it. That is the flow Paddle recommends and what big sites do — the buyer never feels thrown off your site.
- The two plan cards get the same side-by-side card treatment and button style as the first two cards on the home page.
- After payment, a clean confirmation page and the plan applied to the account automatically.

## 5. Connecting payments (today)

Paddle is the right fit for RitaJet: it handles tax, invoices and compliance worldwide as the seller of record, at one all-in fee per sale, and study software is fully accepted.

Steps:

1. I open the Paddle account form pre-filled with **Ritajetweb@outlook.com**; you approve it.
2. A test environment is created straight away, so we can run a full purchase without real money.
3. I create every plan and credit pack in Paddle to match your pricing page, wire the checkout and the payment notifications, and test a purchase from click to plan activated.
4. You then upload your business papers in Paddle for verification. Once approved, live payments switch on — that verification is the only part I cannot do for you.

The Lovable badge stays hidden.

## Technical notes

- Bump `@lovable.dev/vite-tanstack-config` to 2.20.0+, then enable `prerender` with `autoStaticPathsDiscovery: false` and an explicit `pages` list of the public marketing routes only.
- Route-level `React.lazy` / dynamic `import()` for `pdfjs-dist`, `unpdf`, `jszip`, `pdf-lib`, `recharts`, `katex`/`rehype-katex`, `html-to-image`; audit `framer-motion` usage on the home path.
- Inspect the client bundle report before and after; report the actual numbers.
- Remove unused dependencies from `package.json` only after `rg` proves no imports remain.
- Google button: official mark and wording, placed above the credential fields in `AuthDialog.tsx`; verify `lovable.auth.signInWithOAuth("google", ...)` completes in the browser.
- Checkout: keep the inline `frameTarget` flow in `usePaddleCheckout`, fix the pricing cards' navigation, verify `plans.paddle_price_*` values map to the products created in Paddle, and confirm the webhook at `/api/public/payments/webhook` grants plans and packs.
- Paddle is enabled through the payments integration (no API keys pasted by you); sandbox first, live after verification.
