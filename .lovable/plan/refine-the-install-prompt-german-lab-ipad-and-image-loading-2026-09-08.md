# Refine the install prompt, German Lab iPad, and image loading

## What will change

### 1. Rebuild “Add RitaJet to your Home Screen”
- Restyle the mobile banner in RitaJet’s cream-and-green visual language instead of the current generic white/black card.
- Use the Rita face mark, cleaner typography, a compact green action button, and a lighter close control.
- Keep it readable without covering too much of the page, with safe spacing on phones and iPads.
- Redesign the iPhone/iPad instruction sheet to match the same premium look while preserving the correct Safari “Share → Add to Home Screen” steps.
- Keep dismissal and real browser installation behavior unchanged.

### 2. Upgrade the German Lab iPad
- Reduce the tablet’s maximum width so it has more breathing room in the editorial section.
- Replace the simple frame treatment with a more realistic premium aluminum shell: refined edge highlights, accurate bezel depth, a visible front camera/sensor detail, and subtle screen glass.
- Keep the German Lab screenshot fully visible and correctly fitted inside the screen.
- Preserve the existing reveal animation, editable-image control, text, and German Lab link.

### 3. Make home-page pictures appear faster
- Add explicit browser priority and asynchronous decoding support to the reusable editable-image element.
- Preload only the first-screen Rita iPad artwork as the page’s main image and keep it eager/high priority.
- Load nearby showcase artwork at an appropriate priority while retaining lazy loading for genuinely lower sections.
- Produce lighter modern-format versions of the largest built-in home images, especially the roughly 600 KB flashcards artwork and other oversized JPEGs, then update their asset pointers without changing their appearance.
- Preserve administrator-uploaded image overrides and the no-flicker server bootstrap behavior.
- Keep fixed image dimensions/aspect ratios so the page does not jump while pictures arrive.

## Verification
- Check the home page on phone, iPad landscape, and desktop sizes.
- Confirm the install banner and iOS instruction sheet are readable, attractive, dismissible, and do not block navigation.
- Confirm the German Lab iPad is smaller, centered, premium-looking, and includes camera/sensor detail.
- Confirm the first-screen image begins loading immediately, lower images load smoothly, and no image area shifts or flashes back to an old image.
- Check browser errors and run the project type check.

## Not included
- No changes to German Lab functionality, admin image-editing behavior, authentication, AI, pricing, or the still-pending old question-bank data import.
