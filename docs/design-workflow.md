# Design workflow (how every design request is done)

Based on the owner's "Claude Skills" guide for building professional sites, adapted to this
project. The visual system lives in `/DESIGN.md`. This workflow sits on top of the planning
rule in `AGENTS.md`: plan first, end with "do u want to apply it like lovable", build only
after the reply.

## The three rounds

**Round 1 — Direction (the plan).** Before any code:
1. Read `DESIGN.md` and the screen involved; look at what already exists.
2. Understand: who the learner is, what they want to do on this screen, the feel, whether it
   needs real images or only a graphic identity.
3. Write a short **Design Brief**: purpose, audience, the one main action, hierarchy,
   content (real copy), states (empty / loading / error / long text), RTL, phone and desktop
   behaviour, what changes in `DESIGN.md` (if anything), risks. If the owner gave reference
   images or sites, turn them into written rules (not copies) and say which rules.
4. End with the approval phrase. Do not edit files before the reply.

**Round 2 — Build.** On the approved brief, using `DESIGN.md` tokens and existing classes
(`.rita-btn`, `.rita-select`, `--pp-*`). Real content, not placeholders. Clean structure,
clear hierarchy, measured spacing, good contrast, responsive, every state present.

**Round 3 — Hard review, then fix.** Look at the result as a critical designer, not as the
author, then fix every high and medium finding and re-check (a report alone is not enough):
- Visual: hierarchy, typography, colour restraint, alignment, rhythm, polish, any sign of the
  "do not" list in `DESIGN.md`.
- UX: the main action is obvious, no dead ends, honest feedback, nothing silently failing.
- Accessibility: contrast, focus, keyboard, labels, targets, RTL.
- Quality: lint, types, tests, `bun run build`; screenshots at 390 / 768 / 1280 in Arabic
  and English with empty, normal and worst-case data; reduced motion.
- Performance and SEO basics where relevant (image sizes, no layout shift, titles/meta).
Report plainly what was verified and what could not be (for example a real call or account).

## Which skill is used for what

All live in `.claude/skills/` (sources and licences: `.claude/skills/SOURCES.md`). Use the one
that fits the phase; do not run several full skills at once.

| Phase | Skill |
|---|---|
| Round 1: direction, avoiding the generic look | `design-taste-frontend`, `impeccable` (shape / new-work) |
| Round 1: patterns, styles, UX rules to look up | `ui-ux-pro-max` (data in `data/`, read with grep) |
| Round 1–2: tokens and brand when extending `DESIGN.md` | `design-system`, `brand`, `brandkit` |
| Round 2: build quality and polish | `impeccable` (craft / polish), `emil-design-eng`, `apple-design` |
| Round 2: motion, only when it earns its place | `animate`, `animation-vocabulary`, `review-animations` |
| Round 2: phone feel | `mobile-native` |
| Round 2: art direction for images | `imagegen-frontend-web` |
| Round 3: visual review | `design-review`, `impeccable` (critique) |
| Round 3: accessibility | `accessibility-auditor` |
| Round 3: performance and SEO | `web-quality-audit` |
| Round 3: worst-case data | `break-ui` |
| Libraries and quick prototypes | `pick-ui-library`, `prototype` |

Precedence when they disagree: `AGENTS.md` (plan first) → `DESIGN.md` / `PRODUCT.md` → skills.
Steps in a skill that need its scripts, launcher or hooks are skipped (none were imported).
Three skills from the guide were not imported for licence reasons; their jobs are covered by
the Round 3 checklist above (see `SOURCES.md`).

## Images

Claude does not generate production images. Use real product screenshots, the existing
assets, simple SVG, or images the owner provides (or makes with Canva, Adobe or Orshot).
Describe the art direction in the brief; never fill a page with stock placeholders.

## Reference material

Best results come from two or more reference images or sites in the first request. They
become written rules in the brief (what to take: spacing, density, tone; what not to copy).
