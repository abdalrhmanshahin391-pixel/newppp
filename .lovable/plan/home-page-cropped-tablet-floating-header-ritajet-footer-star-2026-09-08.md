# Home page: cropped tablet, floating header, RitaJet footer, Start-learning menu

## 1. The tablet at the top

- Bring back the old crop: roughly the top third of the tablet sits above the page and is not visible.
- The part you do see shows the **whole picture**, not a cut piece of it. The artwork is placed and scaled inside the visible two-thirds so nothing important disappears behind the crop.
- Stays landscape, high-quality frame, no black drop shadow. The picture-changing feature stays exactly as it is.

## 2. The top bar

- No more separate cream box with a line under it. The bar floats on top of the page and over the tablet.
- Fully transparent (a very soft blur only, so words stay readable), no border, no background block.
- Words are white; the important ones (Special offers, admin badge, active item) are green. Menus that open keep the cream/white card look so they are readable.
- On small screens the same floating treatment, with a light shade behind the menu sheet.

## 3. The footer

- Rebuilt for RitaJet: name, short green tagline, and link columns that match the real pages (Study tools, Community, Pricing, Support).
- Removes leftover wording and titles from the old AquaQBank site on the pages people actually see, and uses the RitaJet support address.
- Cream and green styling, no black.

## 4. "Start learning"

- "Start learning" in the top bar becomes its own item that opens a wide menu, like the picture you sent: grouped by My Study Space (Without AI / With AI), Study Room and German, each row with its small coloured icon, name and one-line note (Flashcards - Active recall, Memory Lab - Matching games, and so on).
- The rows come from the existing tool list, so tools switched off by an admin stay hidden.
- Clicking a row goes straight to that tool; the /learn page with the three rooms stays as it is.

## Technical notes

- `IpadStage.tsx`: wrap the device in a clipping shell with a negative top offset (~-33% of device height); the screen keeps `aspect-[16/10]`, artwork positioned so the full frame lands inside the visible region (object-position / inner transform rather than a crop of the image).
- `ProHeader.tsx`: revert from `sticky ... bg-[color:var(--pro-page)]` to `absolute inset-x-0 top-0 z-50` transparent, white text with green accents; `ProHome.tsx` removes the header spacer so the tablet sits under it. Dropdown panels switch to light cards.
- New `ProLearnMenu` section inside `ProHeader` built from `SECTIONS` + tool defs in `src/lib/site-tools.ts`, filtered by `useFeatureFlags`.
- `SiteFooter.tsx` restyled to cream/green tokens; sweep `rg -i aquaqbank` for user-visible strings (page titles under `src/routes/admin.*`, notification preview) and replace with RitaJet.
- Verify with `bunx tsgo --noEmit` plus a Playwright pass on `/` at desktop and mobile widths.
