# Rita sign-in flow, brand face, and simpler pricing

## Goal
Make RitaJet feel consistent and direct: signed-out visitors see the sign-in window immediately, Rita’s face becomes the recognizable site mark, decorative “AI-made” symbols disappear from account navigation, and pricing opens directly on the actual offer boxes.

## Changes

### 1. Start learning without the signed-out interruption page
- Change every visible **Start learning** entry on the home page, desktop header, and phone menu to check whether the visitor is signed in.
- Signed out: stay on the current page and open the existing sign-in window, carrying `/learn` as the destination after successful sign-in.
- Signed in: open `/learn` normally and show the three study rooms.
- Remove the `SignedOutPanel` wrapper from `/learn`, so the unwanted two-panel sign-in page is no longer part of this route.
- Keep the reusable protection used by other private tools unchanged unless they are entered through this Start learning flow.

### 2. One Rita face mark across the site
- Create a clean circular head portrait from the same green-background girl artwork used in the home-page iPad, preserving her face and illustration style.
- Replace the green paper-plane/mascot symbol in the sign-in and sign-up window with this portrait.
- Replace the current home/header wordmark with the portrait plus a restrained RitaJet wordmark that remains readable over both artwork and cream pages.
- Add the same portrait and wordmark to the footer.
- Replace the old Rita face and multicolour RitaJet branding in the Memory Lab / flashcard workspace header with the new mark.
- Keep user profile avatars separate; this change affects the RitaJet brand mark, not a signed-in user’s personal picture.

### 3. Clean account-menu navigation
- Remove the sparkle/star icon beside **Plans & pricing**.
- Use a simple, purposeful pricing mark instead (a small card/receipt-style icon) consistent with the other menu rows.
- Check desktop and phone account menus so no decorative sparkle remains on that pricing entry.

### 4. Pricing starts with the boxes
- Remove the entire introductory block shown in the supplied screenshots: the Plans eyebrow/sparkle, “Choose how you want to study,” and its explanatory paragraph.
- Remove the resulting empty top space so the monthly-plan and credit-pack boxes begin neatly beneath the shared header.
- When a plan type is open, retain only the controls needed to switch/back and choose monthly or yearly billing.
- Preserve all live prices, feature lists, credit-pack visibility, admin controls, current-plan states, offers, and checkout behavior.

## Technical details
- Introduce a shared session-aware Start learning control rather than duplicating sign-in checks.
- Reuse the existing auth-dialog `next` handling so successful login continues to `/learn`.
- Use a single shared brand component for header, footer, auth window, and study workspace to prevent the old and new identities from drifting apart.
- Store the new cropped Rita portrait through the project’s asset system; do not embed the supplied screenshots, which are references only.
- Keep `/learn` metadata and the signed-in three-room page intact.

## Verification
- Signed-out desktop and phone: every visible Start learning control opens the sign-in window without navigating to the old panel.
- Successful sign-in from that window continues to `/learn`; already signed-in visitors go straight there.
- Sign-in, sign-up, site header, footer, Memory Lab, and flashcards all show the same new Rita portrait/wordmark.
- Account menu uses the replacement pricing icon and remains readable on desktop and phone.
- Pricing opens directly on its boxes with the photographed heading/text removed, while plan selection and checkout links still work.
- Check desktop and phone layouts for overflow, broken images, console errors, and unintended old-brand remnants in the requested surfaces.
