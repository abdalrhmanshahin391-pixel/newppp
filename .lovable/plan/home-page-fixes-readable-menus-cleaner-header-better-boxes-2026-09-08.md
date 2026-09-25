# Home page fixes: readable menus, cleaner header, better boxes

## 1. Unreadable menus (real bug)

Both menus are being painted with white text on a cream panel, so the words disappear.

- The "Start learning" mega-menu sits inside the floating header, which forces every word to white. Fix by scoping the white-text rule to the header bar itself, so any panel that drops below it keeps normal dark-on-cream text.
- The account menu (top right) is meant to be a dark panel, but the cream page rules repaint its background cream while the words stay white. Fix so the account panel keeps one consistent look: a light cream card with dark text, green highlights, and the same rounded style as the rest of the site.

## 2. Header: Credits and the user control

- Remove the pill background and border from the **Credits** control so it reads like the other plain header words (white text, green gauge mark, subtle hover).
- Remove the background/border from the **user** control too: just the round avatar, a small role mark, and a chevron.
- Give both a refined treatment that fits the floating header: quiet by default, a soft light halo on hover/open, and clear focus rings. Spacing between header items rebalanced so the right side reads as one calm group.

## 3. First iPad (top of the home page)

Make the visible part of the tablet taller. The screen goes from its current wide 16:10 shape to a slightly taller shape, keeping the same crop at the very top and the same width, so the picture area grows downward as marked in red.

## 4. The two new boxes (Community + Flashcards)

- **Big flashcards box:** rebuild the caption block so the label, headline and button sit together at the bottom-left with matching baselines; the button no longer floats high. Stronger bottom shading behind the words for readability, tighter headline width, comfortable padding, and a clean stacked order on phones.
- **Community box:** replace the generated picture with a new, better classroom/group scene, and rewrite the wording so it speaks about classrooms and groups more concretely. Reflow the card so the text block and buttons breathe, the buttons never collide with the phone, and the phone crop sits neatly at the bottom.

## 5. The two older boxes (Plans + Toolkit)

- Reduce overall card height by 10% from the current size.
- Make the tablet inside genuinely taller instead of just pushed down: switch its screen to a taller shape and pull it back up so the gap between the buttons and the device closes.

## Verification

- Open both menus on the home page and confirm every line is readable.
- Check the header controls at desktop and phone widths.
- Check the top tablet crop, the four boxes, their buttons, links and admin image-change controls.
- Confirm no browser errors.

## Technical details

- Narrow `.rita-onart` overrides to the header bar element only; convert the account dropdown to the cream card palette instead of relying on `.rita-ondark`, whose background loses to `.rita-cream .bg-[#0c0c0e]` on specificity.
- Header changes limited to `ProHeader.tsx`, `CreditsMeter.tsx` (a background-less variant) and scoped CSS in `styles.css`.
- Tablet aspect changes in `IpadStage.tsx` and `ProductShowcase.tsx`; card heights and caption layout in `ProductShowcase.tsx`.
- New community image added through the asset system with the existing image key so admin image editing keeps working.
