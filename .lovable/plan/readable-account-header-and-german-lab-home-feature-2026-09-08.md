# Readable account header and German Lab home feature

## What will change

1. Fix the signed-in name and account controls across shared headers.
   - Separate the transparent home-header colors from the solid cream-header colors.
   - Keep white text only where the header floats over the home artwork.
   - Use warm ink and muted ink for the username, role, credits, menu rows, and mobile menu on cream pages so every state stays readable.
   - Preserve the current clean list style, admin switches, credits details, links, and logout behavior.

2. Add a large German Lab chapter immediately after the three study cards and before **Share your flashcards**.
   - Keep the home page’s current cream, warm-ink, and green palette.
   - Use generous vertical space above and below so the section feels like a major feature rather than another condensed card.
   - Lead with a large Procreate-style editorial statement about learning German articles, pronunciation, and sentence building, using dark text for the main thought and green for selected emphasis.
   - Add a smaller **German Lab** label and concise supporting explanation with a compact action linking to `/german`.

3. Place a high-quality centered landscape iPad beneath the opening statement.
   - Use the supplied German Lab screenshot as the complete visible screen artwork.
   - Build the same refined, shadow-light tablet treatment used at the top of the home page, but show the whole device cleanly within this section.
   - Keep the screenshot legible and correctly framed on desktop, tablet, and phone without cropping away its important content.
   - Make the image replaceable through the existing admin image-edit mode with its own stable image slot.

4. Add a second spacious text moment after the iPad.
   - Explain how `der / die / das`, pronunciation scoring, and build practice work together.
   - Animate the label, headline, supporting copy, and iPad with restrained staggered fade-and-rise motion as they enter the viewport.
   - Show everything immediately for visitors who prefer reduced motion.

## Verification

- Check the signed-in username, role, credits control, account list, and mobile list on both the transparent home header and cream inner-page header.
- Check the new section’s order, spacing, iPad framing, text hierarchy, `/german` action, and image-edit control at desktop and phone sizes.
- Confirm the supplied German screenshot stays sharp and fully visible.
- Check that the home page has no overlap, horizontal overflow, or browser errors and that reduced-motion behavior is respected.

## Technical details

- Correct the shared header’s variant-aware classes rather than patching individual pages.
- Add a focused German Lab home component between `FeatureTriptych` and `ShareBand`, reusing the existing reveal behavior and semantic RitaJet tokens.
- Add the supplied screenshot through the project asset system; do not alter the existing German Lab page or its learning tools.
- Investigate the reported ResizeObserver warning during browser verification and remove any page-owned resize loop if the stack identifies one.
