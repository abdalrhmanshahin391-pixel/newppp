# Uzyra identity

The product and assistant share the name **Uzyra / يوزرا**. This supersedes earlier project
instructions that kept a separate tutor name.

- Website copy, metadata, the app manifest, lessons, free conversation, statuses, error messages,
  admin labels, export headings and download names use the current name.
- `src/lib/brand.ts` owns the web identity, written-answer instructions and initial greeting.
  `voice-agent/brand_identity.py` mirrors that contract; a regression test compares both.
- Voice prompts use the same identity in free, curriculum and interactive-study calls. The current
  identity takes precedence over historical self-introductions or names quoted in lesson material.
- Saved administrative settings, announcements, hub labels and voice lesson briefs are rebranded at
  the copy boundary. Database rows, URLs, identifiers and historical conversation messages are not
  rewritten. The compatibility greeting/stop vocabulary still understands the historical name.
- Model-note cleaners recognize the current name as well as historical notes. The reviewer contract
  and its worker dialect hash are aligned; the review rubric version is now 3.
- `CLAUDE.md`, `PRODUCT.md` and `DESIGN.md` state the current identity for future development.

## Compatibility

File names, routes, tables, storage keys, transport messages, Modal service names, domains and asset
paths retain their existing technical identifiers. No database migration, additional Edge Function,
provider key or background timer is required. User-authored transcripts are preserved verbatim.

## Verification and rollout

Identity and export regressions, lesson/study checks, worker tests, type checking and Chromium/WebKit
rendering are required. The learning-interface harness captures Arabic and English at 390, 768,
1180 and 1280 pixels. It uses local components without making a real tutor call.

The Windows production build is blocked before compilation by the existing Lovable routes-path
validation issue. The Linux production builds in GitHub Actions are the build gate.

After an approved merge, the Modal workflow deploys the worker when repository deployment secrets
are available. Its successful completion must be checked. Publishing the website alone does not
update the spoken assistant; the website must also be updated through Lovable. A real call after
rollout is the final confirmation of the deployed identity, not a claim made by a local test.
