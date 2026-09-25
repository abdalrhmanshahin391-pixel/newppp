# Cream + green becomes the one design

Green and cream stop being an optional switch and become the site's only look. Everything black-and-blue from the recent pass is removed, the tablet loses its heavy shadow, the order of the home page sections changes, and picture changing starts working.

## Colour direction

- Cream page background, warm off-white cards, dark warm ink for text — everywhere, not just home and pricing.
- Green is the action and emphasis colour: main buttons, the accent word in a heading, active states, small labels above headings, links on hover.
- Secondary buttons stay a soft warm grey pill with ink text.
- Where green would be too loud (long paragraphs, notes under buttons, footer body text) text stays ink at reduced strength. Rule of thumb: one green element per block, never green paragraphs.
- The blue action colour and the black surfaces are deleted, so nothing can drift back.
- The "Classic colours" switch in the admin menu is removed — there is only one palette now.

## Home page

1. Tablet at the top: same cropped device, but **horizontal (landscape)** proportions, and no black drop shadow — only a soft, barely visible warm shade so it sits on cream cleanly. Metal edge stays crisp and high quality.
2. Headline block: small green label, big ink headline, ink-muted sub line, green primary button.
3. **Plans and Toolkit boxes come next**, on cream cards with the angled tablets.
4. **"Share your flashcards" band moves below those two boxes.**
5. Footer.

## Header

Rebuilt for cream: light background with a hairline bottom edge, ink wordmark, ink-muted menu items that go ink/green on hover, and the "Special offers" pill in green. Same centred width and side breathing room as now.

## Account menu (top right)

Same panel restyled for cream: white panel, warm border, ink text, green highlight on the active row, and the "Image edit mode" switch turns green when on.

## Footer

Cream footer instead of black: wordmark and tagline in ink, the second tagline line in green, column headings in ink, links ink-muted going green on hover, warm hairline divider, quiet bottom row.

## Picture changing error ("Bucket not found")

The storage space the uploader writes to was never created in this fresh backend — only its access rules exist. It gets created as a private bucket named `site-media` with a 10MB per-file cap, keeping the existing rules (anyone can view, only admins can upload or replace). After that, "Change this picture" uploads and the reset-to-original button both work.

## Technical notes

- `src/styles.css`: replace the dark `--pro-*` tokens with the cream palette as the base, point `.rita-btn-primary` at green, delete the blue token and the whole `.rita-classic` override block.
- Remove `src/lib/classic-colors.ts`, its column read/write in `useSiteSettings.ts` / `site-settings.functions.ts`, and the switches in `ProHeader.tsx` / `SiteHeader.tsx`; drop the `rita-classic` wrapper from `src/routes/index.tsx` and `src/routes/pricing.tsx`. The `site_settings.classic_colors` column is left in place, unused.
- `IpadStage.tsx`: landscape aspect (16/10), remove the deep `box-shadow`, soften to a warm low-opacity shade.
- `ProHome.tsx`: reorder to `ProductShowcase` then `ShareBand`.
- Recolour `ProHeader.tsx`, the account menu component, `SiteFooter.tsx`, `ShareBand.tsx`, `ProductShowcase.tsx`, and the pricing page to the cream/ink/green tokens; no hardcoded black/white utilities left in those files.
- Create the storage bucket with the storage tool (not SQL); policies already exist from migration `20260807150524`.
- Verify with a typecheck plus a browser pass over home, pricing, and an admin image upload.
