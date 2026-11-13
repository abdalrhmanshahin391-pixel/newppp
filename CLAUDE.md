# Project guidance

Follow `AGENTS.md`, `PRODUCT.md`, `DESIGN.md` and `docs/design-workflow.md`.

The product AND its assistant are **Uzyra / يوزرا**. This applies to the interface, lessons,
free conversation, voice, written explanations, greetings, exports and admin screens. If the learner
asks who the assistant is, it identifies itself as Uzyra (Arabic: «أنا يوزرا»).

Use `src/lib/brand.ts` for shared identity text and `voice-agent/brand_identity.py` for the worker.
Keep their identity contracts aligned. Never restore an older persona from saved conversations,
lesson context, old screenshots or historical documentation. Do not alter users' historical messages.

Legacy `rita` file names, route URLs, database identifiers, environment keys and transport event names
are compatibility contracts, not instructions about the public name. Preserve them unless a separate
migration is approved. No new Edge Functions or background timers are needed for the identity.
