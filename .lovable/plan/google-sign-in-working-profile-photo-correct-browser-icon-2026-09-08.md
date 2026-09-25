# Google sign-in, working profile photo, correct browser icon

## 1. Bring back "Continue with Google"

- Add a Google button to both the sign-in and the sign-up views of the account window, styled to match the cream/green design (not a generic AI-looking button).
- Keep email and password exactly as they are now; Google becomes a second option, not a replacement.
- After a Google sign-in, new accounts land on the welcome/setup step so they pick a name and username, then continue to wherever they were heading.
- Turn the Google provider back on for the site.

### Using your own Google account credentials

You chose your own Google credentials, so the consent screen says RitaJet instead of a managed name. Before Google sign-in works live, you (or I, guided step by step) need to:

1. Create a Web application OAuth client in your Google Cloud console.
2. Add the sign-in callback address shown in the app's authentication settings as an authorised redirect address.
3. Paste the client ID and client secret into the Google section of the app's authentication settings.

I will build and wire the button now; the last step needs those two values from you. Until they are entered, Google sign-in will show an error, so I will keep email sign-in as the default visible option.

## 2. Fix changing your account photo

Confirmed cause: the app uploads profile photos to a storage area named `avatars`, and that area does not exist in this project (only `site-media` does), so every upload fails.

- Create the private `avatars` storage area with an image-only, size-limited rule.
- Allow each signed-in person to upload, replace and delete only their own photo, and allow the app to display it through short-lived private links.
- Show a clear message if a file is too large or the wrong type instead of failing silently.
- Test uploading, replacing and removing a photo end to end, and confirm the new photo shows in the header, profile page and shared decks.

## 3. Fix the icon in the browser tab

- Replace the leftover old-site icon with the Rita face mark used across the site, exported at the sizes browsers and phones need.
- Update the tab icon, the Apple touch icon and the install-to-home-screen icons so the saved app shows Rita too.
- The title text already reads "RitaJet — ..."; only the picture changes.

## Technical notes

- Google: re-add the provider button through the supported social-login path, restore the public callback route, and preserve the saved destination through the round-trip (never redirect straight into a protected page).
- Storage: one migration creating the `avatars` bucket plus owner-scoped policies keyed to the first path segment being the user id, matching `src/lib/avatars.ts`.
- Icons: real files in `public/` (not asset pointers), referenced from the root route head and `manifest.webmanifest`.

## Verification

- Sign-in window shows both email and Google; email flow still works.
- Photo upload, replace and remove all succeed and render everywhere.
- Tab and installed-app icons show the Rita mark.
- Type check and desktop/phone checks with no browser errors.
