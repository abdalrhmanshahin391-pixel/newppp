# RitaJet pricing and account-menu redesign

## Goal
Make the pricing experience feel like a direct extension of the polished **RitaJet Toolkit** home card: warm cream, near-white surfaces, rounded display type, bright green emphasis, compact pill buttons, generous space, and clear feature explanations. Remove the black study-mode band on the home page and simplify the account menu.

## Home-page spacing
- Return the three study-mode cards to the normal cream page instead of placing them in a black band.
- Add a generous editorial pause before the cards with a large RitaJet-style statement that explains how Memory Lab, Exam Schedule, and To-do List work together.
- Add comfortable space after the cards so the next section does not feel attached or condensed.
- Keep the existing three images, links, image-edit controls, and scroll-reveal animation, but restyle the text and cards to match the cream/green home design.

## Pricing page
- Keep the current page flow: introductory heading, Monthly plans/Credit packs choice, monthly/yearly control, live plan data, offer labels, current-plan state, checkout actions, and admin-only pack visibility control.
- Redesign the two initial choices as premium RitaJet product cards using the same proportions, corner treatment, type hierarchy, spacing, green accents, and compact button styling as the home Toolkit card.
- Generate two cohesive premium illustrations with green-led study imagery:
  - **Monthly plans:** a focused student workspace representing continuous study access.
  - **Credit packs:** a refined visual collection representing stored flashcards, questions, and reusable credits.
- Keep both choice images editable through the existing admin image-edit mode.
- Rebuild each actual plan as a spacious product-style card without an iPad mockup:
  - RitaJet + plan name at the top.
  - Large, simple plan promise and price.
  - Clearly grouped included features and allowances.
  - Compact RitaJet pill action at the bottom rather than a wide generic button.
  - Green used for the recommended plan, checks, savings, and important emphasis; dark ink for primary reading and soft gray for supporting details.
- Improve grid spacing and card heights so plans feel premium and readable rather than like dense pricing tables.
- Restyle loading, empty, current-plan, offer, and admin-only states in the same visual language.
- Preserve every existing price, quota, feature rule, billing calculation, account redirect, and purchase action.

## Account menu
- Turn the top-right account dropdown into one clean panel with simple rows separated by subtle dividers.
- Remove the individual gray capsule/background from every menu item.
- Keep one compact identity header, then plain icon-and-label rows for Admin mode, Image edit mode, Profile Settings, My plan, Plans & pricing, Notifications, Install app, Admin, and Logout.
- Keep switches functional but visually lighter; use green only for active states and reserve pink/red for Logout.
- Apply the same simplified treatment to the mobile account/navigation menu where the same patterns appear.

## Visual and interaction details
- Reuse the current home-page font family, cream/card colors, green tokens, and `.rita-btn` sizing rather than introducing a second design system.
- Use generous vertical rhythm and restrained staggered reveals; no dark feature band, gradients, decorative blobs, or oversized full-width buttons.
- Ensure cards and controls remain readable and correctly ordered on phone and tablet widths.

## Verification
- Check the home page before, during, and after the three study-mode cards on desktop and phone.
- Check the pricing choice screen, monthly/yearly plans, credit packs, loading/empty states where possible, and all pricing buttons.
- Check the account menu with admin mode on and off, image-edit toggle, navigation rows, and mobile menu.
- Confirm the new pricing images load, remain replaceable in image-edit mode, and do not flicker.
- Confirm there are no browser errors, clipped labels, overlapping controls, or layout shifts.
