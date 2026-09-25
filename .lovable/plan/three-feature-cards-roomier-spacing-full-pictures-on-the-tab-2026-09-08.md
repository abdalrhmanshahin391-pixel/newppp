# Three feature cards, roomier spacing, full pictures on the tablets

## 1. Three new cards above "Share your flashcards"

A new row of three black cards, in the same style as the reference: a tall rounded picture panel on top, then a short line of text underneath where the important words are green and the rest is soft grey.

- **My memory lab** — "Pair up the facts that won't stick and play **match, speed or recall**."
- **Exam schedule** — "Drop every exam onto a clean month calendar and always see **what is next**."
- **To-do list** — "Plan the day, tick things off and keep your **study streak alive**."

Each card links to its tool (memory lab, exam schedule, to-do list). Pictures: new artwork generated in the same friendly illustrated style as the rest of the site, on soft green-tinted backgrounds, one per card. Each picture is replaceable through the existing image-edit mode.

The row sits directly above the "Share your flashcards" band, after the four existing boxes.

**Scroll animation:** the three cards fade up gently one after another the first time they come into view (small stagger, no bounce), and appear instantly for anyone who prefers reduced motion.

## 2. More air between the box rows

Add roughly 40px more space between the Plans/Toolkit row and the Classrooms/Flashcards row below it, so they stop feeling glued together. Other spacing stays as it is.

## 3. Whole picture inside the visible tablet screen

On the Plans and Toolkit boxes the tablet is deliberately pushed off the edge of the card. Today the picture is stretched across the whole tablet, so the part that hangs outside takes a chunk of the photo with it.

Fix: the picture is fitted to the part of the screen that is actually visible inside the card, so the full photo is seen there, and only the empty tablet edge runs off the card. Same for both boxes, in each direction, on phone and desktop.

## Technical notes

- New `FeatureTriptych` component under `src/components/home/procreate/`, rendered in `ProductShowcase` (or in `ProHome` just before `ShareBand`).
- Three new images generated at ~1024x1280, externalized with `lovable-assets` into `src/assets/*.asset.json`; wrapped in `EditableImage` with keys `home.card.memory`, `home.card.exams`, `home.card.todo`.
- Reveal-on-scroll: small `useReveal` IntersectionObserver hook plus a `.rita-reveal` / `.rita-reveal-in` pair in `src/styles.css` (opacity + 14px translate, 500ms ease-out, staggered 90ms, disabled under `prefers-reduced-motion`).
- Row gap: change the `space-y-5` on the showcase section to a wider gap between the two grids only.
- Tablet crop: in `ProductCard`, shift the image inside the screen so the visible window holds the complete frame — the image element gets an explicit width matching the visible fraction of the tablet with the correct left/right anchor, instead of `object-cover` across the full oversized screen.
- Verify with desktop and mobile screenshots, check the three links, the reveal animation, no console errors, and typecheck.
