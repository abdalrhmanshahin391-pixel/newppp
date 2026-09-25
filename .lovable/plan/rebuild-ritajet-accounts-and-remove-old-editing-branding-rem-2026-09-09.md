# Rebuild RitaJet accounts and remove old editing/branding remnants

## Goal
Create a dependable RitaJet sign-in and registration experience while preserving every existing account and its study data.

## What will change

### 1. Remove image changing completely
- Replace every editable marketing picture with a normal displayed picture.
- Remove the “Change image” overlay, upload/reset controls, image-edit state, and the account-menu Admin mode switch.
- Keep the currently selected pictures visible so removing the controls does not unexpectedly change the site artwork.
- Remove the unused image-upload code and access paths after confirming nothing else uses them.

### 2. Rebuild sign-in and registration cleanly
- Replace the current mixed account forms with one consistent RitaJet design for sign in, registration, forgotten password, verification confirmation, profile completion, and password reset.
- Keep existing accounts and study data untouched.
- Validate names, usernames, email addresses, phone numbers, and passwords clearly before submission.
- Put the terms agreement directly above the Create account button, make the legal links explicit, and require agreement only when creating an account—not every time someone signs in.
- Improve error messages so people see useful RitaJet wording rather than raw permission or backend errors.

### 3. Fix account creation and verification
- Restore safe public access to the username/phone availability check; the live database currently blocks signed-out registration requests, which confirms the permission-denied error shown in the screenshot.
- Keep email confirmation required: a new account remains signed out until the verification link is opened.
- Add a polished “check your email” state with the recipient address, spam-folder guidance, resend verification, change-email/back controls, and a clear return to sign in.
- Keep password reset public and verify the recovery link before allowing a new password.
- Preserve the existing profile and role structure, including admin access and existing users.

### 4. Add Google sign-in again from scratch
- Enable a new managed RitaJet Google sign-in instead of restoring any former AquaQBank OAuth code or credentials.
- Add a fresh Google button to sign-in and registration using the supported managed flow and a public same-site return location.
- After Google returns, wait for the confirmed session, then send incomplete profiles through the existing profile-completion step.
- Verify Google, email/password, sign-out, and redirect-back behavior without deleting existing accounts.

### 5. Remove obsolete AquaQBank and Google-login remnants
- Remove old AquaQBank branding from email copy, push messages, site defaults, help text, documentation, and RitaJet-owned integration labels.
- Preserve the intentionally requested `AquaQbank` Toolkit redemption code unless it is technically duplicated; it is a working access code, not unused branding.
- Keep Google references that are required for Gemini AI, Search Console, fonts, and tool authentication because they are unrelated to user Google sign-in.
- Remove stale OAuth comments, dead callbacks, old sign-in assumptions, and unused assets only after confirming they have no current references.

### 6. Verification and security checks
- Confirm email confirmation remains enabled, leaked-password protection is enabled, and signed-in password changes require the current password.
- Test registration as a signed-out visitor, verification messaging, verified sign-in, wrong-password handling, password reset, Google sign-in initiation/return, existing-account sign-in, and admin/non-admin menus.
- Check desktop and phone layouts and confirm no “Change image” or Admin mode controls remain.
- Run focused account-flow tests and a security check for the changed account permissions.

## Email setup note
RitaJet currently has no verified sender domain configured for custom-branded account emails. Built-in verification emails can still work, but fully branded RitaJet verification emails require connecting a RitaJet sender domain. During implementation, I will present the secure email-domain setup step; no third-party key is needed.

## What you will need to do next
1. Approve this plan.
2. Complete the email-domain setup card when it appears so verification emails can use RitaJet branding.
3. Test one new email account and one Google account in the preview after the rebuild.
4. Publish only after both sign-in methods pass the checks.
