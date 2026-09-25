# Flashcards, samples, account fixes and sharing questions

## 1. Flashcards start panel

Reorder the three start buttons so the order reads: Study mode, Shuffle and study, then Smart review at the bottom. Nothing else on the page changes.

## 2. Remove "Ask this lecture"

Remove the Ask tab, its chat panel and its wiring from the all-in-one lecture workspace (Tuberculosis and every other lecture, old and new). Remaining tabs: Study guide, Summary, Flashcards, Questions.

## 3. Lecture questions: clean subjects and real samples

- Move the Tuberculosis lecture into the shared "RitaJet examples" shelf, then delete the two leftover personal subjects ("Akajajak" and "My lectures") with their sub-subjects.
- Keep "RitaJet examples" as the read-only shelf everyone sees: the cardiac-cycle sample and the Tuberculosis sample.
- The Tuberculosis all-in-one workspace (guide, summary, flashcards, questions) becomes visible to every account, new or existing, as a read-only sample.

## 4. Account settings fixes

- Password change: keep asking for the current password and send it with the change, so the "Current password required" error stops. Clear messages for wrong current password, too-short or mismatched passwords, and success.
- Remove the "Email me a reset link" button and any verification notice from the settings page.
- Profile save: friendlier errors for taken username/phone, and the page reloads the saved values so it never shows stale text.

## 5. Email verification on sign-up

Verify end to end that a new email/password account receives a verification email, cannot sign in before verifying, and gets a clear message telling them to check their inbox. Fix whatever breaks in that flow. Google sign-in stays as is.

## 6. Sharing questions, not just flashcards

- The share page gets two clear sections: **Flashcards** and **Questions**, each with its own browse, search and sort.
- A question set can only be built from Lecture Lab questions (never the archive bank), and is published either publicly or into one classroom/group, same as decks.
- Opening a shared question set lets you run it in its own mode and save it into your own Lecture Lab subjects.
- Classrooms get two separate sections too: Decks and Question sets.

## 7. Built to hold a lot

- Both feeds page through results instead of loading everything, with a "Load more" control, so hundreds of thousands of shared questions stay fast.
- Shared question sets store their questions in a dedicated table with indexes on owner, audience and date.
- Long lists inside one set are paged as well, so a set with thousands of questions still opens quickly.
- Check the new question mode and the flashcard mode on desktop and phone before finishing.

## Technical notes

- Button order: `src/routes/study.index.tsx` LaunchPanel actions.
- Ask removal: `src/routes/study.all-in-one.$lectureId.tsx`, plus the now-unused `aioAsk` server function.
- Samples: data-only SQL to re-point `lq_lectures.subtopic_id` for the TB lecture into subtopic `66666666-…` (or a new example sub-subject), delete the two personal subjects, and mark the TB `aio_summaries` row readable through the existing example policy.
- Password: `supabase.auth.updateUser({ password, current_password })` in `src/routes/profile.tsx`; drop the pre-sign-in workaround.
- Sharing: new tables `shared_question_sets` and `shared_question_items` mirroring `shared_decks` / `shared_deck_cards` (owner_id, title, audience, published, counts) with GRANTs, RLS and indexes; `space_question_sets` join table for classrooms; new lib `src/lib/share-questions.ts`; share page split into tabs; new `share/questions/$setId` route and a publish flow reading Lecture Lab questions.
- Paging: range-based queries (`.range()`) on both feeds and on question items.
