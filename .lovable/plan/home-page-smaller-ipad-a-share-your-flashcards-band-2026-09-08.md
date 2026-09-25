# Home page: smaller iPad + a "share your flashcards" band

## 1. Make the iPad smaller

Right now the tablet stretches almost edge to edge. It gets narrower so there is
clear black space on the left and the right (where the red arrows point).

- Reduce the tablet's maximum width (roughly 1120px down to about 880px) and add
  more side breathing room on large screens.
- Keep it in the horizontal (landscape) position, exactly like the reference site.
- Sharpen the device look: crisper metal edge, thinner bezel, a soft reflection
  and a deeper drop shadow underneath so it reads as a real, high quality object
  rather than a flat rectangle.
- The girl illustration stays as it is, still filling the screen.

## 2. Three new illustrated faces

Generate three new characters in exactly the same illustration style as the girl
on the tablet screen (same soft, warm, hand-painted look) — three different
random students, head-and-shoulders, so they crop cleanly into circles.

They are used as the three round faces in the new band below.

## 3. New band under the tablet: sharing flashcards

A wide dark rounded panel across the page, matching the layout of the example
you sent, but written for RitaJet:

- Big bold headline, left aligned, large and tight — the same weight and scale
  as the example.
- The three circular illustrated faces, slightly overlapping.
- Two lines of supporting text under the faces, smaller and semi-bold.
- On the right, two pill buttons, sized like the example (compact, not tall):
  a soft grey one ("See shared decks") and a bright blue one ("Share your deck").
  Blue is the vivid system blue used in the reference, hover slightly darker.
- On phones the buttons stack under the text and stay full width.

The buttons link to the existing sharing pages, so they work straight away.

## 4. Typography

Headline, body and button labels follow the same scale as the reference: very
large tight headline, mid-size semi-bold body, and small semi-bold button text —
all in the existing site font, on the existing black background.

## Technical notes

- `src/components/home/procreate/IpadStage.tsx`: width, bezel, shadow, sheen.
- New `src/components/home/procreate/ShareBand.tsx`, rendered from `ProHome.tsx`
  below the hero copy.
- Three generated portraits saved as CDN asset pointers in `src/assets`.
- Blue token added to `src/styles.css` (approx `#0a84ff`) rather than hardcoded.
- No backend or pricing changes in this step.
