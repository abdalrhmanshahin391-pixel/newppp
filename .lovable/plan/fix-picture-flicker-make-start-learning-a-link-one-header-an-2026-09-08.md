# Fix picture flicker, make "Start learning" a link, one header and footer everywhere

## 1. Pictures stop flickering on refresh

Today every replaced picture is fetched after the page opens, and each one is served
through a temporary one-hour web address. So the page first paints the built-in
artwork (or a stale copy from the browser cache), then swaps — that is the flash you
see, and sometimes the replacement drops out completely when the temporary address
has expired.

Fix:
- Serve replaced pictures from a permanent public address instead of a temporary
  signed one (the pictures are site artwork, not private files).
- Load the list of replaced pictures on the server together with the rest of the
  site settings, so the correct picture is already in the very first paint —
  no swap, no flash, on the home page and every other page.
- Keep the admin "change picture" and "reset to original" flow exactly as it is;
  after an upload the new picture still appears immediately.

## 2. "Start learning" in the header

The header item stops opening the drop-down list. Clicking it goes straight to the
Start learning page with the three rooms — the same destination as the green
"Start learning" button on the home page. On phones the same item behaves the same
way. The other header menus are untouched.

## 3. Same header and footer on every page

The floating cream/green header from the home page becomes the one header for the
whole site. The shared header component every other page already uses is restyled to
match it (same wordmark, same word sizes, same green accents, same account, Credits
and admin controls, same mobile panel). On inner pages it sits on a solid cream bar
instead of floating over artwork, so the words stay readable.

The RitaJet footer already renders site-wide from the app shell; it will be confirmed
on the home page and inner pages so both show the same footer, with full-screen
working surfaces (quiz/exam players, admin) still excluded.

Everything else — page content, links, plans, checkout, image editing — stays as it is.

## Technical notes

- `site-media` bucket switched to public; `signSiteMedia` returns `getPublicUrl`.
- `getSiteBootstrap` returns a `siteImages` map; `__root` seeds the
  `["site-images"]` query cache before first paint (same pattern as `site-settings`),
  so `useSiteImage` resolves synchronously on SSR and hydration.
- `ProHeader`'s "Start learning" becomes `<Link to="/learn">`; the mega-menu markup
  for that item is removed (other groups keep theirs).
- `SiteHeader` is rebuilt on the `ProHeader` markup with a `solid` variant
  (cream background, dark words) and `ProHeader` keeps the transparent variant;
  both share one component so future changes stay in sync.

## Verification

- Hard refresh home, pricing and one inner page: replaced pictures appear in the
  first paint with no flash and no revert.
- Click "Start learning" in the header on desktop and phone: lands on /learn.
- Header and footer look identical across home, pricing, /learn, /study and an
  admin page; no browser console errors.
