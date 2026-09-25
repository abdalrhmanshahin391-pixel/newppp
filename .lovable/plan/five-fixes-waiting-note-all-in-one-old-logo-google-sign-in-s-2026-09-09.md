# Five fixes: waiting note, All in one, old logo, Google sign-in, Special offers

## 1. The waiting note on Add questions

Replace the small grey line under the button with a clear red notice:

> **This takes time — you don't have to wait here.** Close the page and come back whenever you like; the questions keep being written and land in your sub-subject by themselves. Big files can take up to two hours, but it's usually under 30 minutes.

Red text in the RitaJet style (warm red, same font and size rules as the rest of the page). Nothing else on that page changes.

## 2. All in one stops after ten seconds

The Tuberculosis handbook is 310 pages and about 384,000 characters of text. Today the page reads the whole book in the browser and then sends all of it to each of the four steps in one go, with no size guard and no retry — which is why it ran for a few seconds and then died silently.

Fixes:
- Read big PDFs in the browser in batches with a live "page X of Y" line, and stop cleanly at a safe size instead of freezing.
- For books, use a smart selection of the text (beginning, middle, end plus the densest sections) so the AI always gets a workable amount instead of an oversized request that fails.
- Every step (study guide, summary, flashcards, questions) gets its own retry and its own visible error line, so one failing step never kills the whole run and you always see why.
- Show the same red "you can close this page" notice here too.
- Surface the real reason on failure instead of a silent stop.

Then run the real handbook end to end and confirm all four outputs appear.

## 3. The handbook as a shared sample

Add the Tuberculosis handbook lecture as a permanent read-only example inside All in one — visible to everyone (signed in or not) exactly like the sample question bank, with its study guide, summary, flashcards and questions already built. Nobody can edit or delete it; it can be played and read by all.

## 4. Bring back the old logo

Recover the previous RitaJet icon from the project's own history and use it everywhere the current one is used: the browser tab icon, the app icon, the site header, the footer, the sign-in window and the study workspace. Before applying it I'll show you the recovered picture so you can confirm it's the right one — if it isn't, you send me the file and I use that instead.

## 5. Remove Google sign-in completely

Delete the Google button, the Google callback page, the Google provider wiring, the leftover AquaQBank Google identifiers and any Google auth packages, then switch the Google provider off in the backend so it can't be used at all. Sign-in stays email and password only. I'll finish with a full search proving nothing Google-auth related is left.

## 6. Special offers page

Rebuild `/offers` in the home-page style: same cream and green colours, same headings, same pill buttons, same spacing rhythm. Cleaner layout — one clear offer card per row on phones, a tidy grid on desktop, a calm countdown, a proper empty state when no offer is live.

The page can already be switched off from the admin area; I'll make that switch obvious and complete: one clear on/off control in your admin menu that hides Special offers from the header, the footer, the plan page, and blocks the page itself when off.

## What stays untouched

Prices, plans, credits, quotas, checkout, the question bank, Lecture Lab, Memory Lab, German Lab, admin image editing and all existing content.

## Technical notes

- `src/routes/courses.$courseId.add-questions.tsx` — red notice component.
- `src/lib/pdf-text.ts` + `src/routes/study.all-in-one.index.tsx` — batched extraction, size caps, representative-text selection, per-step retry and error display.
- `src/lib/all-in-one.functions.ts` — accept a shared example lecture in `aioList`/detail reads; seed the handbook via migration with fixed UUIDs and `is_example = true`, with read policies matching the existing sample bank.
- Logo: recover `public/favicon.png` from git history, regenerate the icon sizes, repoint `src/components/brand/RitaBrand.tsx`, `__root.tsx`, manifest and auth screens.
- Google: remove `src/components/auth/GoogleButton.tsx`, `src/routes/auth.callback.tsx`, references in `AuthDialog.tsx`, `welcome.tsx`, `onboarding.ts`, then disable the provider with the social-auth tool.
- Offers: restyle `src/routes/offers.tsx` on the home tokens; keep `offers_page_enabled` as the single source of truth and add a guard inside the route.
