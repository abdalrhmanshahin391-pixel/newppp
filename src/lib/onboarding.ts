export type OnboardingProfile = {
  full_name?: string | null;
  username?: string | null;
  phone?: string | null;
} | null;

/**
 * A brand-new social sign-in lands with a placeholder profile: the username
 * defaults to the account id and the name/phone can be blank. Those accounts
 * get sent to /welcome before they can use the site.
 *
 * For standard email/password registrations, students write all their credentials
 * (full name, username, phone, email, password) up front in the sign-up dialog.
 * They are not blocked by /welcome once verified.
 */
export function needsOnboarding(
  userId: string,
  profile: OnboardingProfile,
  provider?: string,
): boolean {
  if (!profile) return true;
  const username = (profile.username ?? "").trim();
  const fullName = (profile.full_name ?? "").trim();
  const phone = (profile.phone ?? "").trim();

  // If username is empty or is still the raw user ID uuid
  if (!username || username === userId) return true;

  // Must have a real full name
  if (fullName.length < 2) return true;

  // Email signups provide all credentials up front in the sign-up dialog.
  // They must never be routed to the /welcome window after verifying email.
  if (provider === "email") {
    return false;
  }

  // Social sign-ins (Google OAuth, etc.) do not supply phone numbers during OAuth.
  // Require at least a 6-digit phone number so they complete their profile at /welcome.
  if (phone.length < 6) return true;

  return false;
}