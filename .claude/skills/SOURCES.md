# Where the design skills come from

Imported on request from the owner's "Claude Skills" guide, after reading each one. Only the
instruction files and their reference text were copied, with the original licence next to each
skill. **No scripts, hooks, downloaded binaries or launchers were imported**, so any step in a
skill that says "run `scripts/...`" is skipped; the rest of the skill still applies.

| Skill folder | Source | Licence | Notes |
|---|---|---|---|
| `impeccable` | github.com/pbakaus/impeccable (`plugin/skills/impeccable`) | Apache-2.0 (+ NOTICE) | Launcher, hooks and data not imported. Its "launcher unavailable" path applies: read `PRODUCT.md` and `DESIGN.md` directly. |
| `ui-ux-pro-max` | github.com/nextlevelbuilder/ui-ux-pro-max-skill | MIT | CSV data kept for lookup (read with grep); the Python search script was not imported. |
| `design-system`, `brand` | same repository (`.claude/skills/...`) | MIT | Token and brand method. Our tokens are fixed in `/DESIGN.md`; these skills help extend it, not replace it. |
| `imagegen-frontend-web`, `brandkit` | github.com/Leonxlnx/taste-skill | MIT | Art direction for images and brand kits. Claude does not generate production images itself. |
| `design-review` | github.com/jezweb/claude-skills | MIT | Visual review. |
| `accessibility-auditor` | github.com/OneWave-AI/claude-skills | MIT | WCAG review. |
| `web-quality-audit` | github.com/addyosmani/web-quality-skills | MIT | Performance, SEO, best-practices review. Helper script not imported. |
| `design-taste-frontend` and the others | already in the project | see their folders | Taste, polish, motion, mobile, break-ui. |

## Not imported, on purpose

- **Anthropic Frontend Design** (`anthropics/claude-code/plugins/frontend-design`): licence is
  "all rights reserved", so it cannot be redistributed in this repository.
- **Vercel Web Design Guidelines** (`vercel-labs/agent-skills`): no licence found, and it loads
  its rules from a remote URL each time. Its job is covered by `docs/design-workflow.md`.
- **Design Auditor** (`borghei/Claude-Skills`): Commons Clause licence (no selling), which does
  not fit a commercial product.

## Rules when skills disagree

1. `AGENTS.md` first: plan, approval phrase, then build.
2. `/DESIGN.md` and `/PRODUCT.md` decide the look and the product. A skill's taste never
   overrides the project's tokens, fonts or colours; it improves execution inside them.
3. Do not run several full skills at once. Use the table in `docs/design-workflow.md`.
