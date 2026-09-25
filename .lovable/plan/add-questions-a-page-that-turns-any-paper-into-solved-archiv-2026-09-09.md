# Add questions — a page that turns any paper into solved archive questions

## What you get

An **Add questions** button in the top-right of every archive-questions bank (where the red box is, beside Enrolled). It opens a new page, styled like the home page — cream/green, the same headings, the same green pill buttons.

On that page:

1. Pick the subject and sub-subject the questions should land in.
2. Drop a PDF (or take/upload photos of a real paper).
3. The page shows a live progress list: reading pages, finding questions, writing explanations, saving.
4. When it finishes, the questions are inside the chosen sub-subject with a long explanation on each one, ready in Study / Session / Exam mode.

## How each question is produced

This is the flow you described, and most of it already exists in the project as the Rita 3.8 pipeline; this work wires it to the new page and adds the paper-photo path.

```text
PDF ──► text per page ──► group into 2-page pieces
                              │
                              ▼
        Gemini "borders" pass: for each question return the
        first 4 words + last 4 words (or the whole thing if
        it is shorter than 7 words)
                              │
                              ▼
        we CUT each question out of our own text locally
                              │
                              ▼
        each cut question goes to Gemini on its own and comes
        back as JSON: concept, why the right answer is right,
        why each wrong one is wrong, long detailed explanation,
        plus a summary table
                              │
                              ▼
        saved into the chosen sub-subject as a real question
        with its four choices and the explanation
```

Two changes to the existing pipeline:

- Pieces become **2 pages** instead of 4, so the borders pass stays accurate (you asked for the first two pages as the example unit).
- The explanation JSON stays exactly as it is today (concept / why right / why wrong / summary table) — that already matches what you asked for.

## Real-world paper (OCR) 

Two mode a pdf which contain picture or I can send pictures purely 

For a scan or a photo there is no text to read, so before anything else we turn the picture into text:

- Each page is rendered (or each photo is read) in the browser at high resolution, sharpened and upscaled to about 2200px on the long edge, then sent as an image.
- Gemini reads the page and returns the text exactly as printed — numbering, options, answer lines kept.
- From that point on it is the identical flow above: borders → cut → solve → save.

Both of your test files are covered: `Op.pdf` page 1 is a normal text PDF, `TB.pdf` page 1 has no text layer at all (confirmed), so it goes down the photo path. Both will be run end to end before this is called done.

## Design

The new page reuses the home-page look: `font-display` headings, the same text sizes, the green `.rita-btn` pills, cream cards with soft borders. No new colour system, nothing dark.

## Technical notes

- New route `src/routes/courses.$courseId.add-questions.tsx`; entry button added to the header band of `src/routes/courses.$courseId.index.tsx` (visible to signed-in users who can write into that bank).
- Reuses `ritaCreateJob` / `ritaListRuns` / `ritaKickWorker` in `src/lib/rita-ai-38.functions.ts` and the worker in `src/lib/rita-ai-38.worker.server.ts`; `PAGES_PER_CHUNK` 4 → 2.
- New server function `ritaCreateImageJob` (images → Gemini OCR → one text chunk per 2 pages → same queue). Page rendering uses the existing `renderPdfPages` / `pdf-page-render.ts` helper, with the target width raised and a light sharpen pass for scans.
- OCR prompt lives beside `BORDERS_SYSTEM` / `SOLVER_SYSTEM` in `src/lib/rita-ai-38.server.ts`.
- Quotas, plan gates (`feature_rita38`, `rita_questions`) and the shared-bank privacy rule (rows saved private when the shelf is not yours) stay exactly as they are.
- Verification: run page 1 of `Op.pdf` and page 1 of `TB.pdf` through the live page signed in, confirm questions appear in the sub-subject with explanations, and check the run in Study mode.