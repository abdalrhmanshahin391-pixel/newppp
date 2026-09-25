# Finalize RitaJet’s Google logo and Google sign-in

## What I confirmed

- The live homepage already serves the new Rita artwork correctly. Its live file is byte-for-byte identical to the project file, is 96×96, returns successfully, is allowed for Google, and the homepage is indexed with the submitted sitemap.
- Google Search and the Search Console property menu are showing Google’s older favicon cache. Google documents that favicon refreshes happen on a separate schedule; URL Inspection cannot force an immediate favicon refresh.
- RitaJet’s Google provider is enabled, but the visible Google button does not use it. It currently calls Lovable’s legacy OAuth broker, which is exactly why the Lovable “Authenticating…” page still appears despite the Google setup already being completed.

## Changes

### 1. Remove Lovable from the Google sign-in journey

- Replace the Google button’s legacy Lovable broker call with the enabled direct Google provider.
- Return users to RitaJet’s own domain after Google completes authentication.
- Add a small RitaJet callback screen that safely completes the session, handles errors, and then sends the user to the correct next page.
- Preserve the current account behavior: existing users keep their accounts; new Google users still complete name, username, and phone information on the RitaJet welcome page.
- Remove the unused legacy broker package, wrapper, and obsolete Lovable OAuth consent stub once no sign-in code depends on them.
- Keep the editor’s secure session storage bridge because it supports preview testing and does not create the public Lovable authentication page.

### 2. Give Google one clean, newly named Rita icon

- Create a newly named, stable 96×96 favicon from the exact green Rita face used by the website header.
- Make that PNG the single primary search favicon in the homepage head so Google does not have to choose among competing icon declarations.
- Keep the correct Apple/app icons for installed devices, update the manifest consistently, and keep RitaJet’s structured logo aligned with the same artwork.
- Do not repeatedly rename the icon after this change; Google explicitly recommends a stable favicon URL.

### 3. Publish and send every legitimate refresh signal once

- Publish the authentication and favicon changes.
- Confirm the live RitaJet homepage references the new filename and that the new image is crawlable, square, and served correctly.
- Resubmit the existing sitemap and read Google’s indexed homepage state through the already-linked Search Console property.
- Test Google sign-in from the published custom domain and confirm the journey goes to Google directly, returns to RitaJet, creates/restores a session, and never displays the Lovable authentication page.

## Verification

- Test existing-account and new-account Google sign-in, cancellation, provider errors, RitaJet callback handling, onboarding, sign-out, and return sign-in.
- Check desktop, phone, and iPad layouts for the sign-in window and callback state.
- Confirm no active source or dependency still calls the Lovable OAuth broker.
- Confirm the favicon and manifest URLs return the intended green Rita image on `ritajet.com`.

## Important limitation

The site-side correction and Search Console signals can be completed immediately. Google alone controls when its separate favicon cache refreshes in public Search and in the Search Console property selector; official Google guidance provides no instant-refresh API or guaranteed timing. Changing to one new stable filename is the strongest safe final nudge, but claiming an immediate public update would be misleading.

## Technical detail

- Authentication: update `src/components/auth/GoogleButton.tsx`, add a TanStack `/auth/callback` route, remove the unused `@lovable.dev/cloud-auth-js` dependency and legacy wrapper/stub after checking all imports.
- Branding: add a newly named real favicon file under `public/`, update `src/routes/__root.tsx` and `public/manifest.webmanifest`, and preserve the existing installed-app icon set.
- Search Console: use the verified `https://ritajet.com/` property and existing `https://ritajet.com/sitemap.xml`; URL Inspection will be reported only as reading Google’s indexed copy, not as a live test or guaranteed recrawl request.
