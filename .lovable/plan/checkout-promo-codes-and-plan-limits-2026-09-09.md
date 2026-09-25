# Checkout, promo codes and plan limits

## 1. Remove shared questions completely

Sharing stays for flashcards only.

- Delete the three question-sharing pages (public list, single set, publish form) and the "Questions" tab inside classrooms and study groups.
- Remove the Flashcards/Questions switcher on the sharing page, and the import-into-Lecture-Lab action.
- Delete the stored shared question sets, their questions and their classroom links permanently from the database.
- I am not talking about the questions sample for everyone of course these are for each person and not under that idea so don't delete these it's example for people 

## 2. New checkout page (Everand-style)

Rebuild `/checkout` on the two-column layout from your reference, in RitaJet colours, fonts and pill buttons — no PayPal block.

- Left: the payment card form, embedded in the page.
- Right: "Today" price, the plan name and what it includes, a **Add promo code** row with an input and Apply button, then "Total due today" with the discounted amount.
- Under the button: the agreement line with Terms, Privacy, Refund and the required Paddle Merchant-of-Record sentence.
- Fix the crash you saw: the payment form container is looked up by class name, not by id — that mismatch is exactly what produced `document.getElementsByClassName(...)[0].appendChild` failing, so the box never appeared and the error banner showed instead. Also guard against the plan loading after the form opens.

## 3. Promo codes in the admin panel

A new admin page **Promo codes** that writes real discounts into the payment system, so the amount charged actually drops.

Each code supports:

- Code (or auto-generate), and an internal note.
- Type: percentage off, or fixed amount off.
- Which plans it applies to (all, or selected plans/billing periods).
- Recurring: first payment only, or a set number of renewals, or forever.
- Usage limit total, expiry date, and enable/disable.
- One-click enable in test and/or live.

The list shows each code with times used, remaining uses, status (active, expired, used up, disabled), and archive/disable buttons. Codes typed on the checkout page are validated live and show the new total before paying.

## 4. Plan changes really reach the payment system

When you edit a plan in the admin panel:

- Changing the monthly / yearly / one-time price updates the matching price in the payment system in the same save, so the pricing page, checkout and the amount charged can never disagree. Existing subscribers keep the price they bought at.
- Changing the plan name or description updates the payment product too.
- Changing feature limits saves as today, and the page shows a short "in sync" or "needs sync" marker per plan so you can see at a glance.
- A "Check sync" button compares every plan against the payment system and reports mismatches.

## 5. Limits are enforced before any AI spend

Audit every AI entry point (All-in-One, Add Questions, Lecture Lab, Archive solver, summaries, flashcard import, review) and make sure the plan check runs with the real job size **before** the file is parsed or any Gemini request is sent, so a blocked student never consumes tokens. Anything currently counting after the fact gets moved ahead of the call.

## 6. Friendlier account messages

Rework the sign-up errors the way large services do: no raw technical text.

- Username taken → inline under the field, with two or three suggested free usernames.
- Email already registered → an inline panel offering "Sign in instead" and "Reset password" rather than a red failure.
- Phone already used, weak password, invalid email → inline, calm, one sentence each, with what to do next.
- The submit button shows the failure count-free state; the form never clears what was typed.

## Technical notes

- Question-sharing removal: drop routes `share.questions.*`, `src/lib/share-questions.ts(.functions.ts)`, the space tab in `spaces.$spaceId.tsx`, then a migration dropping `shared_question_sets`, `shared_question_items`, `space_question_sets`.
- Checkout: Paddle inline `frameTarget` resolves via `getElementsByClassName`, so the container needs that value as a **class**; pass `discountCode` on open and re-open on apply.
- Promo codes: Paddle `/discounts` through the payments API (percentage/flat, `restrict_to`, `recur`, `usage_limit`, `expires_at`), created per environment; admin page under `/admin/promo-codes` following the existing admin page pattern.
- Plan sync: extend `plans-admin.functions.ts` save to call the price/product update path and store returned ids; keep human-readable ids stable.
- Quota: verify `assertBatchFits` / `assertFeature` placement in `all-in-one.functions.ts`, `rita-ai-38.*`, `lecture-lab.functions.ts`, `archive-solver.*`, `summaries.functions.ts`, `card-import.functions.ts`.