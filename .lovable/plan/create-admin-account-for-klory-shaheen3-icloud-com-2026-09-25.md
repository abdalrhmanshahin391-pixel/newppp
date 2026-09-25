# Create admin account for Klory.shaheen3@icloud.com

## Goal
Create a brand-new account with email `Klory.shaheen3@icloud.com` and the password the user provided, grant it the admin role, and prove sign-in works — all on the new, empty database.

## Steps

1. **Create the user server-side**
   - Use the privileged server client (Auth Admin API) to create the user with the given email + password.
   - Set `email_confirm: true` at creation so the account is immediately sign-in ready (no email confirmation needed — the user asked for a ready-to-use account).
   - The existing `handle_new_user` trigger auto-creates the profile row.

2. **Grant the admin role**
   - Insert a row into `public.user_roles` with the new user's id and role `admin` (roles live in the separate `user_roles` table per security rules).

3. **Verify sign-in end to end**
   - Sign in with the email + password through the app (browser test on the preview) and confirm the session is established and the profile loads.
   - Confirm the admin role is present by querying `user_roles` / `has_role`.

4. **Report back**
   - Confirm the account exists, is an admin, and that login was verified.

## Technical details
- User creation: `supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true })` inside a server context (no client exposure of the service key).
- Role grant: `insert into public.user_roles (user_id, role) values (<new_user_id>, 'admin')`.
- Verification: Playwright sign-in flow on `http://localhost:8080`, then check the profile page renders and the role row exists.
- No data from the old database is involved; the database stays otherwise empty.

do u want to apply it like lovable
