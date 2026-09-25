# Fix the browser tab picture and put your own name on the Google window

## What I checked

- The picture in the browser tab comes from the icon files in the site's public folder. That file is still the **old cartoon Rita** (girl with pink top and glasses) — the same one from the old site.
- The logo used everywhere on the site (header, footer, sign-in window) is the **new Rita face** taken from the home page girl on the green background.
- So the tab is genuinely out of date, not just a cached picture.
- The two callback addresses you saw in the backend are Lovable's sign-in relay. They are correct and don't need changing. The name and logo people see on the Google window come from the **Google OAuth client name and logo** — not from the redirect address. So even though the callback contains "lovable", once you create your own client called "RitaJet" and upload your logo there, users will see RitaJet.

## 1. New browser tab picture

- Take the new Rita face (the one used in the site header) and build square icons from it: a small tab icon, a larger one, and the phone home-screen icon.
- Replace the old icon files and the home-screen list so every place uses the new face.
- Add a fresh version marker so browsers stop showing the old cached picture.
- Also check the sign-in window, header and footer all show the same new face, so nothing anywhere still uses the old one.

## 2. Your own Google sign-in (so the window says RitaJet)

I'll prepare everything on the site side and hand you a short checklist:

- You create a sign-in app in your Google account, name it **RitaJet**, and add your logo there — that name and logo are exactly what people will see.
- You paste in the two callback addresses that are already shown in the backend settings (they stay the same).
- Google gives you two values (an ID and a secret). You paste them into the backend sign-in settings.
- After that, the same "Continue with Google" button starts showing **RitaJet** instead of Lovable. No code change is needed on the button itself.

I'll write the steps out with the exact addresses to copy when you're ready to do it, and I'll test the sign-in afterwards.

## 3. Checking

- Open the site on computer and phone, confirm the tab picture, home-screen picture, header, footer and sign-in window all show the new face.
- Confirm sign in, sign up and profile photos still work.
- Confirm nothing on the page breaks.

## Note

The live public address only updates when you press Publish, so after this is done publish once to see the new tab picture there too.
