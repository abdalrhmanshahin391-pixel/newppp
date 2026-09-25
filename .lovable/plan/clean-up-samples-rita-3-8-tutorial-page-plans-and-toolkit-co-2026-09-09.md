# Clean-up: samples, Rita 3.8, Tutorial page, plans and toolkit code

## 1. Question bank: rheumatic fever becomes the shared sample

- Keep the 8 rheumatic-fever questions produced by the text and photo (OCR) runs.
- Delete the 15 older seeded heart questions and the 4 tuberculosis questions, with their choices and any saved answers, so they never appear again.
- Put the surviving 8 under a clearly named public sub-subject ("Rheumatic fever — shared example") inside the sample course, and mark that course/subject as an example so every visitor, signed in or not, sees and can open them.
- Access rules stay read-only for everyone else: people can study the sample but not edit or delete it.

## 2. Remove Rita 3.8 completely

- Delete the Rita 3.8 page and remove it from the Study menu, home/feature lists, pricing tables, plan usage screens and the admin plan editor.
- Drop its plan switch and its question allowance so no plan mentions it anymore.
- Any old link to it redirects to the study home instead of erroring.

## 3. Tutorial page

- The existing "How it works / دليل الاستخدام" guide becomes a first-class page at `/tutorial`, named **Tutorial** in the menu, taking the slot Rita 3.8 used.
- Restyle with the home cream/green system and give it its own soft accent colour so it reads as its own destination; keep the Arabic/English switch and the tool demos already there.
- The old `/tour` address keeps working and points at the new page.

## 4. Remove "Image edit mode"

- Delete the Image edit mode switch from the top-right account menu and remove the mode itself, so editable pictures are simply always admin-editable from the admin side (no toggle).

## 5. Plans: one connected ladder, editable from admin

- Every plan is defined by the same set of switches and numbers, and each higher plan includes everything the lower one has (validated so an upper plan can never be smaller than a lower one).
- Rita 3.8 rows removed from the admin plan editor; the editor shows the real, working tools only: flashcards, summaries, lecture questions, archive questions, All-in-One, to-do, calendar, classrooms.
- Every paid plan ($5 and up) gets **unlimited flashcards** each month; all other allowances keep today's numbers, just tidied so the ladder is consistent.
- The Free plan keeps its small caps.
- Limits are enforced in one place on the server, so a plan that doesn't include a tool blocks it and a plan that does include it counts usage against its number and shows a clear message at the cap.

## 6. Toolkit code

- Add the code **AquaQbank** granting the Toolkit plan free of charge, unlimited uses, no expiry, visible and editable in the admin toolkit screen.

## Technical notes

- Data removal and the sample re-labelling go through one migration plus data statements on `questions`, `question_options`, `question_attempts`, `subjects`, `subsubjects`.
- Plans: drop `feature_rita38` and `max_rita_questions` from `plans`, remove `rita_questions` from `usage_counters` handling, `usePlan`/`usePlanGate`/`quota.server.ts` and `admin.plans.tsx`; set `max_flashcards = NULL` for every plan with `price_cents >= 500`.
- Rita 3.8 code removed: `src/routes/study.rita-ai.tsx`, `src/lib/rita-ai-38.*`, worker route entry, nav entry in `src/components/site-nav.ts`, pricing/my-plan/checkout references. (The Add-Questions pipeline that shares those files stays — only the 3.8 product surface goes; shared helpers are kept and renamed where needed.)
- Tutorial: rename `src/routes/tour.tsx` to `src/routes/tutorial.tsx`, keep `/tour` as a redirect route, restyle with the home tokens.
- Image edit mode: remove `src/lib/image-edit-mode.ts`, its toggle in `ProHeader.tsx`, and simplify `EditableImage.tsx` to gate on admin only.
- Toolkit code inserted into `toolkit_codes` with `plan_slug = 'toolkit'`, `max_uses = null`, `is_active = true`.
