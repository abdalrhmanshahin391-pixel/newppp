# Guides worker

Fonts (and, in the next step, the Modal renderer) for the PDF grammar guides.

- `fonts/` holds the four open-licence (OFL) families the guide template names: Figtree, Inter Tight,
  Outfit and Noto Sans Arabic, with their licences. A test fails if the template names a file that is
  not here.
- The template and the content schema live in `src/lib/guides/`. See the "Guides (PDF)" section of
  `DESIGN.md` for the look.
- To see the three sample guides as PDF on a machine with Playwright and Chromium:
  `node scripts/guides/build-samples.mjs [outDir]` (default: `guides-worker/samples`, not committed).
