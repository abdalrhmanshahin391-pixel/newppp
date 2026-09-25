# Black feature band, a proper sign-in page, and a fixed header

## 1. The three cards sit in a real black band

Right now the three cards (memory lab, exam schedule, to-do list) sit on the cream page, because a site-wide rule repaints anything black back to cream.

- Wrap the three cards in their own full-width black band with its own styling that the cream rule cannot override.
- The cream page fades into black just before the band and fades back to cream just after it, so the change of colour looks deliberate rather than a hard cut.
- Inside the band: white headings, soft grey body text, green highlight words, and the same scroll-in animation.
- Pictures keep their rounded corners and stay replaceable in admin image-edit mode.

## 2. The header is invisible on inner pages

On the sign-in page the logo, "Start learning", "Rooms", "How it works", "Pricing" and the account controls are painted white on a cream strip, so they disappear.

- Make every header item follow the page it sits on: white only when the header floats over the home artwork, dark ink on the cream strip everywhere else.
- Covers the wordmark, the links, Pricing, the account/credits controls and the mobile menu button.
- Check every page that uses the cream header (sign-in prompt, pricing, tour, learn, study pages) so nothing stays white-on-cream.

## 3. Rebuild the "sign in first" screen

The current screen is one small block of text floating in an empty page.

- Give it a proper centred layout: a soft cream card with the RitaJet mark, a clear headline, one short line of reassurance, then the green "Sign in" pill and the outlined "Create an account" pill.
- Add three small reassurance points (your cards stay private, free to start, works on every device) and a short line of the three study modes the visitor is about to unlock.
- Fill the empty page with a calm illustration/gradient panel beside the card on wide screens; single column on phones.
- Same treatment for the matching signed-out screens elsewhere (lecture list, other study pages) since they share one component.

## 4. Rebuild the sign-in / sign-up window

The window currently shows a broken image box at the top: its picture file points at an old project and returns "not found".

- Generate a fresh RitaJet mark for the window and use that (no more broken box).
- Tidy the window: tighter heading, clearer terms checkbox row, better spacing between the Google and email buttons, cleaner divider and footer link, gentle open animation, and a proper loading state on the buttons.
- Same polish for the create-account and reset-password views inside the window.
- Keep all current behaviour: Google sign-in, email sign-in/sign-up, remember me, password reset, and the return-to-page-you-came-from step.

## Technical notes

- New black band lives inside `FeatureTriptych.tsx` using a scoped class (e.g. `.rita-band-dark`) added in `src/styles.css`, defined so `.rita-cream` overrides don't repaint it.
- `ProHeader.tsx`: replace the hardcoded `text-white*` / `!text-white` classes on the wordmark, nav links, Pricing and account cluster with values that switch on the existing `solid` flag.
- `SignedOutPanel.tsx` gets the new layout; `RequireAuth.tsx` centres it in the page.
- `AuthDialog.tsx`: replace the dead `rita-cutout.png.asset.json` import with a newly generated mark uploaded through Lovable Assets; keep Supabase auth calls untouched.
- Verify with a typecheck plus desktop and mobile passes over `/`, `/learn` while signed out, and the auth window, checking for console errors.
