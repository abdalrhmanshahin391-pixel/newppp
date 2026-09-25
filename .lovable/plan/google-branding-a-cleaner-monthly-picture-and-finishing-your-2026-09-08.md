# Google branding, a cleaner monthly picture, and finishing your details

## 1. Make sure "Lovable" never shows on the Google window

What the sign-in window shows is decided entirely by the Google account settings you create, not by the website code.

- Right now the site still uses the shared Google setup, so the Google screen can say a name that is not yours.
- I will check the current sign-in settings and report exactly what state they are in.
- The only way to show "RitaJet" is to add your own Google app details (an app ID and secret from your Google console) into the site's sign-in settings. I will give you the short, exact steps and, once you paste the two values in, I will test the sign-in and confirm the window says RitaJet.
- Until those two values exist, I will not claim it is fixed.

## 2. New monthly picture on the pricing page

- Replace the current monthly plan picture with a new illustration that has no person or character in it — objects only, in the same friendly style as the flashcards and to-do pictures on the start-learning page.
- Same green/cream palette, same size and framing, so nothing else on the pricing page shifts.
- The one-time packs picture stays as it is.

## 3. Google sign-ups must finish their details

The site already sends brand new accounts to the "finish your profile" step, but it only insists on a name and username, so someone can slip through without a phone number.

- Require the phone number too, so anyone who signs in with Google is asked for full name, username and phone before they can use the site.
- Pre-fill the name from their Google account so it is one quick confirmation, not retyping.
- Keep the same look and the same friendly error messages ("that username is taken", "that phone is already registered").
- People who signed up with email are unaffected unless their phone is genuinely missing.

## Technical notes

- `needsOnboarding` gains a phone check; the gate in the root route already covers every page.
- `/welcome` seeds `full_name` from the Google identity metadata when the profile is blank.
- New pricing artwork generated and referenced the same way as the existing monthly asset in `src/routes/pricing.tsx`.

## Verification

- Sign-in settings state reported honestly, with the exact Google console steps.
- Pricing page renders the new picture on phone and desktop with no layout shift.
- A fresh Google account is held at the finish-your-profile step until name, username and phone are filled, then lands where it was heading.
