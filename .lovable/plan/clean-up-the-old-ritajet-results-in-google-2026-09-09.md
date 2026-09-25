# Clean up the old RitaJet results in Google

## What I checked

- The Google account now linked is `abdalrhmanshahin391@gmail.com`, and it owns exactly one confirmed property: `https://ritajet.com/`. Nothing else is connected, so nothing old is feeding those results.
- The old **About RitaJet** page no longer exists on the site — opening it shows an error page.
- The **Courses** page still exists and loads fine; it is simply still listed in Google.
- The site already serves the **new Rita logo** for every icon size. Google is still showing the old one from an earlier visit, not from the site.
- Results 1 and 4 (home page and Start Learning) are correct and stay as they are.

## What I'll do

1. **Take Courses out of Google**
   Mark the Courses page as "do not list in search" and remove it from the site's page list that Google reads. Google drops it on its next visit; the page keeps working normally for anyone who has the link.

2. **Retire the old About link properly**
   Make that address answer with a clear "this page is gone for good" response instead of a plain error. This is the strongest signal Google accepts and makes it disappear faster.

3. **Push the new logo forward**
   Confirm the icon files are the new Rita face at every size, and keep them in one place so the next Google visit picks up the new icon. Google refreshes site icons on its own schedule — usually a few days to a few weeks after it re-visits.

4. **Tell Google to re-check**
   Re-submit the page list after the changes go live so Google re-visits the site sooner.

5. **Publish**
   None of this affects Google until the site is published, so I'll ask you to publish at the end.

## Note about speed

Google decides when to re-visit. The changes are the correct signals, but the old entries can linger for a few days to a couple of weeks. If you want them gone within about a day, you can also use the "Removals" tool inside Search Console yourself — that button only exists in Google's own interface, so I can't press it for you. I'll show you exactly where it is.

## Technical detail

- `src/routes/courses.tsx`: add `{ name: "robots", content: "noindex, follow" }` to its `head()` meta.
- `src/routes/sitemap[.]xml.ts`: confirm `/courses` and `/about` are not in `STATIC_ENTRIES` (currently they are not) and leave the rest untouched.
- Add `src/routes/about.tsx` as a server handler returning HTTP `410 Gone` with a short plain-text body, plus `staticData`/head marking it noindex, so the URL is explicitly retired rather than a soft 404.
- Icons: verify `public/favicon.ico`, `favicon.png`, `favicon-512.png`, `apple-touch-icon.png` all derive from the current Rita mark and stay referenced from `__root.tsx`.
- After publishing, re-submit `https://ritajet.com/sitemap.xml` to the verified `https://ritajet.com/` property through the Search Console connection.
