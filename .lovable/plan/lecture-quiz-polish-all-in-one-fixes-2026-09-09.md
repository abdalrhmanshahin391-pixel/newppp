# Lecture quiz polish + All-in-one fixes

## 1. Lecture quiz: nicer questions and choices

Keep the current layout, only lift the finish:

- Question text larger and set in the home-page display font.
- Answer rows: taller, roomier padding, larger option text, softer rounded corners, clearer letter badges, gentler hover lift.
- Previous / Next / Submit become the site's standard pill buttons (fixed height, hugging the label, never stretched on phones).
- Explanation panel and question map get the same type scale, so nothing looks smaller than the question.

No change to modes, timer, saving, flags, or the archive-mode structure.

## 2. All-in-one: use the real Summary mode

Today All-in-one writes its own short summary. Instead:

- During the build, All-in-one sends the same lecture (PDF file when a PDF was uploaded, otherwise the pasted text) to the Summary mode generator with **Comprehensive** length and **Conceptual** tone.
- The finished summary is linked to the lecture, so the workspace's **Summary** tab shows the real Rita summary sheet — same design as Summary mode — instead of the plain text block.
- The tab gets an **Open full summary** link and a **Download PDF** action (the same save-as-PDF used by Summary mode, so the sheet prints exactly as designed).
- If the summary step fails, the build carries on and the tab explains it can be retried; the rest of the lecture is unaffected.

## 3. Save flashcards into your own subjects

In the workspace's **Flashcards** tab:

- Add a **Play these cards** action so the deck runs in the normal flashcard player instead of only sitting in a grid.
- Add **Save to flashcards**: pick an existing subject and sub-subject, or type a new one, and the cards are copied into your flashcards board, where they open in Flashcards mode like any other deck.
- Confirmation names where they landed, and duplicate saves create a new sub-subject instead of overwriting.

## 4. Save questions into Lecture Lab

In the **Questions** tab:

- Add **Save to Lecture Lab**: choose an existing lecture subject and sub-subject, or create new ones, and the lecture's questions move there so they show under that subject instead of the hidden "All in one" bucket.
- After saving, the lecture appears in Lecture Lab's list and can be run from there in Study, Session, or Timed exam.

## Technical notes

- Quiz styling: `src/routes/study.lectures.run.tsx` only, using the existing `.rita-btn` pills and shared type scale.
- Summary: call `generateSummary` from `src/lib/summaries.functions.ts` with `length: "comprehensive"`, `tone: "concept"`, and PDF base64 when available; store the returned id in the existing `aio_summaries.summary_id` column (no schema change needed). Render with `src/components/summary/SummaryView.tsx`; reuse the print path from `src/routes/summaries.$summaryId.tsx`.
- Flashcards: write into the browser flashcard board through `src/lib/local-board.ts` / `src/lib/use-flashcards.ts`; play through the existing flashcard player.
- Questions: new authenticated server function to list/create `lq_subjects` / `lq_subtopics` and re-point the lecture's `subtopic_id`.
- Verify end to end on the sample lecture: build, summary sheet + PDF, card save + play, question save + run in all three modes, on desktop and phone.
