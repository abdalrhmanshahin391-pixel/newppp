# Fix Google branding and restore the question bank

## Confirmed findings

- The public sample bank **does exist** in the live database: one course, one section, one sub-subject and 15 questions with 60 answer choices.
- Its visibility setup is present, and the course is published and free for public viewing.
- The “Question bank” card is opening the wrong record. It uses the section ID (`2222…`) as the course ID; the real course ID is `1111…`. That exact mismatch produces the “Question bank unavailable” page in the screenshot.
- The current live database contains only that sample. The former full collection of courses, subjects, sub-subjects and questions is not present, so it cannot be reconstructed exactly from the current database alone.
- Google sign-in currently uses RitaJet’s supported managed Google sign-in helper. The wording and logo on Google’s consent screen come from the Google OAuth client that is actually active in Auth Settings. Changing React copy or icons cannot change that external consent-screen identity.

## 1. Make the existing sample question bank work

- Correct both destinations on the Question bank card so they use the real sample **course** ID.
- Keep the existing hierarchy intact: Cardiac physiology → Cardiovascular system → Cardiac cycle & ECG → 15 questions.
- Check the course, section and sub-subject reads as both a signed-out visitor and a signed-in user.
- Open the card from Start learning, select the sample sub-subject, start a study session, and confirm questions, choices and explanations load.
- Replace the misleading unavailable screen only when the requested course truly does not exist.

## 2. Restore the original full question bank

- Import the original export after it is uploaded, preserving its real course → section → sub-subject → question → answer hierarchy and IDs where possible.
- Validate duplicate IDs, missing parents, correct answers and explanations before inserting anything.
- Keep published outlines visible to visitors while protecting paid/private question content according to the existing access rules.
- Recount each course and sub-subject after import and test representative banks from the public, signed-in and admin views.

**Required file:** the old SQL, CSV, Excel or JSON export. The current website ZIP and live database do not contain those original rows, so this part remains blocked until that export is supplied. I will not invent replacements and call them the old bank.

## 3. Diagnose and correct Google consent branding

- Open Google sign-in from the live RitaJet site and record which OAuth client/consent identity Google is actually serving.
- Confirm the button continues through the supported Google authentication flow and returns users to RitaJet correctly; do not replace it with an unsafe custom token flow.
- Verify that the custom Google client is the active provider configuration, not merely created in Google Cloud while the app still uses managed credentials.
- Check the Google consent screen is published and branded with **RitaJet**, its Rita face logo, support email and the correct authorized domains.
- Verify the exact callback addresses shown by Auth Settings are registered on that same Google client, then test sign-in, first-time profile completion and returning-user sign-in.
- Improve the app’s Google error message so a provider/configuration failure is visible instead of always showing the same generic fallback.

**Boundary:** I can fix and test the website flow. If the live provider is still serving Lovable’s OAuth client, the custom client ID and secret must be activated in the project’s Auth Settings; Google’s external consent-screen name cannot be overridden by website code.

## Verification

- Desktop and iPad-size browser checks from Start learning to the sample bank and through a complete 15-question-capable session.
- Signed-out and signed-in visibility checks for the sample hierarchy.
- Live Google sign-in check through consent, callback, profile completion and return login.
- Type checking and browser console/network checks with no new errors.
