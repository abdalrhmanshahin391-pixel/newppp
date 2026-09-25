# Fix the question bank, rebuild Lecture Lab, and add ready-made samples

## What I checked first

- The question bank is empty at the source: there are **0 courses, 0 subject sections, 0 sub-subjects and 0 questions** in the live database, so every bank page has nothing to show.
- Lecture Lab is actually saving sub-subjects correctly. There is **one** subject ("Akajajak") with **three** sub-subjects inside it. The board simply prints every pair as its own row ("Akajajak · Ahahah", "Akajajak · Ahahaha", "Akajajak · Ajaja"), which reads as three subjects. That is a display problem, not a saving problem.
- Question generation is wired to a working AI key (a live test answered fine) and one lecture with 15 questions did save. So the upload failure is not "no AI"; the likely blockers are the plan allowance (the Free plan allows 10 AI questions while the page defaults to 15) and the "Set one up for me" button, which calls a helper that **does not exist** in the database and therefore always errors.

## 1. Give everyone something to open

Add a permanent, read-only sample in both places:

- **Question bank:** one published free sample course → one section → one sub-subject → **15 questions** with four options each, one correct, and a short explanation. Visible to visitors and signed-in users without buying anything.
- **Lecture Lab:** one shared example subject → one sub-subject → one lecture with **15 questions** and a key-points sheet, marked as an example so everyone sees it and nobody can edit or delete it.

The sample content is written as real study material (clean, medical-style questions), not placeholder text.

## 2. Rebuild the Lecture Lab screen in the flashcards style

- Show a proper two-level tree: the subject is one row, its sub-subjects nest underneath it, and lectures sit inside each sub-subject. No more "Subject · Sub-subject" flattening.
- Each subject row gets "Add sub-subject"; each sub-subject row gets "Add a lecture" — so it is always obvious which level you are on.
- Match the calm flashcards look: same card shape, spacing, type sizes, green accent, and the RitaJet pill buttons instead of the purple ones currently used.
- Keep everything that already works: search, ticking lectures, the side start-a-round panel, question pool, timed exam, renaming and deleting.
- Sample rows show a small "Example" tag and no delete button.

## 3. Make uploading a lecture work end to end

- Create the missing database helper behind "Set one up for me" so it makes a starter subject and sub-subject instead of failing.
- Show the real reason when a build stops (plan allowance used up, PDF unreadable, AI busy) instead of a generic failure, and cap the question choices to what the current plan still allows so a Free user is not offered 15 when only 10 are left.
- Test the whole path myself: sign in, create subject → sub-subject, upload a PDF and paste text, build the quiz, confirm the questions save, then run study, session and timed modes.

## 4. Question bank page

- Load the sample course on the bank pages so the outline, sub-subjects and questions appear for visitors, signed-in students and admins.
- Keep the "unavailable" message only for links that genuinely do not exist.

## Technical notes

- New migration: `ensure_lq_default_bucket` function, plus seed rows (course, `subject_groups`, `subjects`, `questions`, `question_options`) and example `lq_subjects` / `lq_subtopics` / `lq_lectures` / `lq_questions` inserted literally in the migration with fixed IDs.
- Sample bank subject uses `access_level = 'free_public'`; existing read rules already allow example `lq_*` rows.
- UI work is in `src/routes/study.lectures.index.tsx`, `src/routes/study.lectures.new.tsx` and a nested variant of `PickerBoard`; server logic in `src/lib/lecture-lab.functions.ts` only where errors need surfacing.
- Verification: typecheck plus a signed-in browser pass over the bank, Lecture Lab tree, an upload, and all three run modes.

## Note

Your real old subjects and questions still cannot be recovered without the old export file. This sample is separate demo content and will not overwrite anything you upload later.
