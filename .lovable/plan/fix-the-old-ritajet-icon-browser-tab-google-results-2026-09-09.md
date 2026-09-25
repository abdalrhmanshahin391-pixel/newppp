# Fix the old RitaJet icon (browser tab + Google results)

## What I found (checked live, just now)

The live site at ritajet.com is still serving the **old build**:

- `https://ritajet.com/rita-search-icon.png` → **404** (the new icon file is not live at all)
- `https://ritajet.com/favicon.ico` and `/favicon.png` → still **live, still the old artwork**

So nothing about the new icon has ever reached the real site. The new icon exists only in the working copy. That is why:

- the tab on the homepage shows the old icon (the homepage HTML that Google and browsers get is from the old build), and
- Google still shows the old icon — its favicon crawler fetches those old files and they genuinely still hold the old picture.

Google's icon crawler is separate from the page crawler, so re-indexing pages alone never refreshes it, and it strongly prefers the classic root paths. Deleting `favicon.ico` was the wrong move: it removes the file Google reaches for most often.

## What to change

1. **Restore the classic filenames with the new artwork.** Put the new green Rita icon back at `public/favicon.ico`, `public/favicon.png` (96x96 and 48x48-friendly), keep `favicon-512.png` and `apple-touch-icon.png`, and keep `rita-search-icon.png` as an extra. Same names as before, new bytes — this is the combination Google's icon crawler handles best.
2. **Declare them cleanly in the page head** (`src/routes/__root.tsx`): one `rel="icon"` pointing at `/favicon.ico`, plus PNG entries and the apple touch icon, all **without `?v=` query strings** (Google ignores or mishandles versioned icon URLs), and make sure the same head is served on the homepage itself.
3. **Point the manifest and push icons** at the same stable files.
4. **Publish.** This is the step that actually fixes the tab icon, and it is required before Google can see anything new.
5. **After publishing**, confirm each icon URL returns 200 with the new image, then resubmit the sitemap through the connected Search Console property so the homepage is queued for a fresh crawl.

## Honest expectation on Google

Once the new files are live, the tab icon fixes itself immediately (a hard refresh may be needed on your own device). Google's search-results icon is a cache we cannot flush from here — no API can force it. Typical refresh is a few days to a couple of weeks. Things that genuinely help, and that this plan does:

- serving the new image at the same classic URLs Google already has on file,
- no version query strings,
- a fresh crawl signal for the homepage.

The one manual accelerator that people report working is opening **URL Inspection → Request Indexing** for `https://ritajet.com/` yourself inside Search Console; the API version of that endpoint is read-only, so I cannot press it for you.

## Technical notes

- Files touched: `public/favicon.ico`, `public/favicon.png`, `public/manifest.webmanifest`, `public/push-sw.js`, `src/routes/__root.tsx`.
- No change to sign-in, pricing, study modes, or any other behaviour.
- The separate Google sign-in issue (Google rejecting the backend's return address) is **not** part of this plan.
