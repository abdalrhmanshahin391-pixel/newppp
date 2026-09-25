# Apple/Meta-grade buttons and type rules

Goal: make RitaJet's buttons and text behave like Procreate, Apple and Meta — same restraint, same weight, same sizes — and record those rules so every future page is built the same way.

## What changes on screen

1. Buttons stop stretching on phones
   - Pills keep their natural width and hug their label at every screen size, including phones. No full-width blue bars.
   - Two pills sit side by side and stay side by side on small screens, wrapping only if the words are long.

2. Buttons look and feel premium
   - Fixed pill height: 44px on phones, 48px on larger screens; horizontal padding 22-26px, fully rounded.
   - Label: 16px on phones, 17px on desktop, semibold, no letter-spacing tricks.
   - Primary: solid blue #0071E3 (Apple/Procreate blue), white label, subtle darken on press, gentle 150ms transition and a slight press-down.
   - Secondary: soft grey fill (white at 9% on black), white label, lightens on hover — never an outline.
   - Focus ring for keyboard users, no glow or gradient.

3. "Start learning" is fixed
   - Same pill as above, using the blue primary style so the home page reads as one system instead of a lone green button. Green stays available elsewhere as an accent, not as the hero action.

4. Text rules applied on the home page
   - One very large bold headline per section, tight tracking, short line.
   - Supporting sentence at 17-19px in medium grey (white at 60%), max ~600px wide.
   - Small labels above headlines: 13px, uppercase, wide spacing, dim.
   - Price or fine print: 15px, dim, never bold.
   - Bold is used only for headlines and button labels; body text is regular or medium.

## Saved as reusable knowledge

A project style memory is written so that from now on, whenever you ask for a new page or section, it is built with these exact button sizes, colours, weights and text scale without you repeating yourself.

## Technical notes

- Add blue/grey pill variants and the type scale to `src/styles.css` tokens; extend the shared button variants so components use one source of truth.
- Update `ProHome.tsx` (Start learning) and `ShareBand.tsx` (Browse decks / Share a deck) to the new variants; remove any width-100% behaviour on mobile.
- Verify on a 390px-wide viewport plus desktop with a browser check.
