# Bring back the old two boxes, and add a classic-colours switch

## 1. The two product boxes go back to how they were

Restore the earlier version of the Plans and Toolkit boxes exactly:

- Taller boxes (590 / 650 min height), larger heading and label sizes, roomier spacing.
- Tablets in their earlier position and size: wider than the box, sitting inward, gentler 4-degree tilt, cropped only slightly at the bottom.
- The short line under the buttons goes back to the plain description on both boxes — the `$3` line on Toolkit is removed.
- The pair moves back below the "Share your flashcards" section.

The only thing kept from today: the picture-change feature, so each tablet screen is still swappable when Image edit mode is on.

## 2. A "Classic colours" switch in the admin menu

A new switch next to Admin mode and Image edit mode. It is a real site setting, so flipping it changes the live site for every visitor immediately (no rebuild).

When ON, the home page and the pricing page return to the old look:

- Cream page background and dark ink text, the same as the other pages of the site.
- Green buttons instead of blue, matching the green used everywhere else.
- Cards, borders and muted text switch to the light equivalents.

Everything added recently stays exactly the same in both looks: the fonts, the text sizes and weights, the button shapes and sizes, the tablets, the boxes, the sharing band and the footer.

## Technical notes

- Restore `src/components/home/procreate/ProductShowcase.tsx` from the pre-change version in git (`d27e28a`), re-adding only the `EditableImage` wrapper with keys `home.product.plans` / `home.product.toolkit`. Revert the order in `ProHome.tsx` so `ShareBand` comes before `ProductShowcase`.
- Migration: add `classic_colors boolean NOT NULL DEFAULT false` to `public.site_settings`; extend the select list and defaults in `src/hooks/useSiteSettings.ts` and the admin save path so admins can write it.
- Add a shared surface token set in `src/styles.css` (`--pro-bg`, `--pro-ink`, `--pro-muted`, `--pro-card`, `--pro-line`) defaulting to the current dark values, plus a `.rita-classic` scope that overrides them with the cream/ink values and repoints `.rita-btn-primary` to the existing green (`--primary` / `--primary-deep`).
- Swap the hardcoded `bg-black`, `text-white`, `text-white/xx`, `bg-[#121212]` and `border-white/10` usages in `ProHome`, `ProHeader`, `IpadStage`, `ShareBand`, `ProductShowcase`, `SiteFooter` and `src/routes/pricing.tsx` for those tokens — no size, weight, spacing or layout changes.
- The route wrappers for `/` and `/pricing` add the `rita-classic` class when the setting is on.
- Admin toggle lives in `ProHeader.tsx` and `SiteHeader.tsx` account menus, admin-only, writing through the existing site-settings save function and invalidating its query.
- Verify with typecheck plus Playwright on `/` and `/pricing` in both states: no console errors, buttons unchanged in size, boxes matching the restored version.
