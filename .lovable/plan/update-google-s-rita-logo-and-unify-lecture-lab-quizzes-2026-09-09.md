# Update Google’s Rita logo and unify Lecture Lab quizzes

## What I confirmed

- The header uses the green-background Rita face from the current RitaJet brand artwork.
- The site references several favicon files, but the 64px icon is not one of Google’s recommended 48px multiples and the current `.ico` file is malformed. This can make Google keep or misread the old icon.
- The archive question runner is the screen marked with the red X: it has the mode/progress bar, question card, answer states, explanation, question map, finish control, and admin question controls.
- Lecture Lab has the same three modes and working attempt-saving logic, but its quiz screen is a separate, simpler design.

## Changes

### 1. Make the new Rita face the single search/browser identity

- Derive a clean favicon set directly from the same green Rita face used in the header, with a centered head crop and crisp square sizes that Google accepts (48px multiples, plus the existing app-icon sizes).
- Replace the broken `.ico`, update the PNG/app icons, and update the icon version in the page head and manifest so browsers and crawlers fetch the new files instead of reusing an old cached URL.
- Keep RitaJet’s structured logo reference pointed at the canonical `https://ritajet.com/` icon.
- After publishing, verify that the live homepage and every icon URL serve the new Rita image, resubmit the sitemap, and read Google’s indexed homepage state through Search Console.

Google can receive the new files and re-check request immediately, but Google alone decides when its public search result refreshes. The site-side change and Search Console submission will be immediate; the visible search icon may still take several days to update.

### 2. Give Lecture Lab the archive-question experience

- Rebuild the Lecture Lab runner to match the archive runner’s structure and styling:
  - top mode badge, progress bar, timer, and question count;
  - large question card with the same answer rows and correct/wrong/selected states;
  - flag control and clear Previous/Next actions;
  - explanation panel in the same position and visual style;
  - desktop question map with jump-to-question, finish, and exit actions;
  - compact mobile layout with the same hierarchy and readable controls.
- Preserve Lecture Lab’s own data and behavior: selected lectures, All/Weak spots/Flagged pools, Study/Session/Timed exam modes, timer, saved attempts, retry weak spots, lecture references, and key points.
- Match mode behavior to the archive runner:
  - **Study:** answers and explanations are visible in the study flow;
  - **Session:** choose, submit, then reveal the result and explanation;
  - **Timed exam:** keep answers hidden until submission, then show results/review.
- Keep archive-only admin actions out of Lecture Lab unless Lecture Lab already supports the same operation safely.

### 3. Verify the complete flow

- Test the shared sample lecture from the Lecture Lab start panel through all three modes.
- Check answer selection, correct/wrong feedback, explanations, navigation, flags, timer expiry, finish/results, weak-spot retry, and saved attempts.
- Check desktop and phone layouts for clipping, overlap, and readable question controls.
- Run the project checks, publish the favicon and quiz changes, then confirm the live favicon files and Search Console sitemap submission.

## Technical detail

- Primary quiz work: `src/routes/study.lectures.run.tsx`, with a small shared quiz presentation component extracted only if it prevents the two runners from drifting again.
- Reference behavior and styling: `src/routes/courses.$courseId.run.tsx` and `src/components/ExplanationPanel.tsx`.
- Branding work: regenerate `public/favicon.ico`, `public/favicon.png`, `public/favicon-512.png`, and `public/apple-touch-icon.png` from the Rita header artwork; update `src/routes/__root.tsx` and `public/manifest.webmanifest` consistently.
- No question or lecture data will be replaced; this is a presentation and interaction unification.
