# Image edit mode, better product boxes, new footer

## 1. Change pictures from the site itself (admins only)

- Add a second switch in your account menu (top right), right under **Admin mode**, called **Image edit mode**.
- Only real admins see it. It remembers its state on your device, exactly like Admin mode.
- When it is **on**, a small "Change image" button appears on top of each editable picture. Clicking it opens a small window where you pick a new picture from your device; it uploads and the picture updates everywhere for everyone straight away. A "Reset to original" option puts the built-in picture back.
- When it is **off**, nothing extra is visible and the site looks normal to everyone.

Covered in this round (as chosen): the iPad screen on the home page, both product boxes, the three faces in the sharing band, and every picture on the pricing page (monthly plans, credit packs, and the three pack pictures).

## 2. The two product boxes

- Move them **above** the "Share your flashcards" band so they appear earlier.
- Make each box wider and shorter (less tall) so the iPad screen shows more of its picture.
- Push the left box's iPad further to the right and the right box's iPad further to the left, so more of each screen is inside the box.
- Add a price line to the **Toolkit** box only: a muted "$3" line under the buttons, matching the reference styling. The Plans box keeps its short line.

## 3. Footer

Replace the current cream footer with a dark, wide footer in the Procreate style:
brand name and tagline at the left, then link columns (Product, Company, Learn & Support, Account), a thin divider, and a bottom row with language, copyright and social/legal links. Same fonts, sizes and grey tones already used on the home page.

## Technical notes

- New table `public.site_images` (`key` text primary key, `path` text, timestamps) with GRANTs, RLS: read for `anon`/`authenticated`, write only for `has_role(auth.uid(),'admin')`. Uploads go to the existing `site-media` bucket via `uploadSiteMedia` / `signSiteMedia`.
- New `src/lib/image-edit-mode.ts` shared store mirroring `src/lib/admin-mode.ts`, plus `useSiteImage(key, fallbackUrl)` hook (React Query, single fetch of all rows) and an `<EditableImage>` wrapper component holding the overlay button and upload dialog.
- Switch rendered in both `ProHeader.tsx` and `SiteHeader.tsx` account menus, gated on `isRealAdmin`.
- Swap the fixed `<img>` tags in `IpadStage.tsx`, `ProductShowcase.tsx`, `ShareBand.tsx` and `routes/pricing.tsx` for `<EditableImage>` with stable keys; existing asset imports stay as fallbacks so nothing breaks if no override exists.
- Reorder `ProHome.tsx` (`ProductShowcase` before `ShareBand`); adjust card aspect/offset classes in `ProductShowcase.tsx`.
- Rewrite `SiteFooter.tsx` in dark tokens; keep bilingual labels and existing routes.
