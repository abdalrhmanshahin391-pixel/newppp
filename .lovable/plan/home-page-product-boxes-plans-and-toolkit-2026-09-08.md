# Home page product boxes: Plans and Toolkit

## What will change

1. Add two matching product boxes beneath the existing home content, following the supplied Procreate Dreams reference closely:
   - **Plans** on the left.
   - **Toolkit** on the right.
   - Remove/avoid any additional product box so the row contains exactly these two.

2. Match the reference composition:
   - Deep black product cards with a fine restrained border and softly rounded corners.
   - Small RitaJet product label, short bold headline, compact gray **Learn more** pill, compact Apple-blue **Buy now** pill, and one short muted line beneath.
   - Keep wording brief and product-focused rather than listing features inside the boxes.
   - On phones, retain the same compact button dimensions and natural label width; do not stretch them across the card.

3. Build two high-quality landscape iPad presentations:
   - Each iPad rises from and is cropped by the bottom/outer edge of its box, matching the reference rather than appearing as a complete device.
   - The left and right devices face opposite directions for balance.
   - Only part of each device body is visible, but each visible screen shows its artwork as a complete composition fitted within the screen—not an accidental crop of the source image.
   - Use a crisp metal rim, thin bezel, screen reflection, and grounded shadow consistent with the existing home-page iPad.

4. Screen artwork:
   - Use the uploaded girl-with-flashcards bedroom illustration in the **Toolkit** iPad on the right.
   - Use a cohesive existing dark RitaJet study/plans illustration in the **Plans** iPad on the left; do not embed the abstract yellow-blue reference or the Procreate screenshots.

5. Links:
   - **Learn more** and **Buy now** in both boxes will open `/pricing`, as selected.
   - Preserve all current pricing data, plan selection, account state, and checkout behavior.

## Placement and responsiveness

- Add the pair as a dedicated home-page section after the current sharing section.
- Desktop: two equal cards side by side.
- Phone: one card per row, with stable height, readable text, compact pills, and deliberate iPad cropping without overflow or overlap.

## Verification

- Check desktop and phone views for device direction, crop, complete screen artwork, card proportions, and button sizes.
- Confirm all four buttons open Pricing.
- Confirm uploaded/generated imagery loads sharply and the page has no actionable browser errors.

## Technical details

- Create a focused reusable product-card/iPad component rather than duplicating markup.
- Add the uploaded girl image through the project asset system; reuse an existing matching RitaJet plans asset for the second screen.
- Use the saved RitaJet dark tokens and `.rita-btn` variants; do not change business logic or backend data.
