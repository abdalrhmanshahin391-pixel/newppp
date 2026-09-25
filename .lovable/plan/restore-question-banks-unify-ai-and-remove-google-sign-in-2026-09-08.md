# Restore question banks, unify AI, and remove Google sign-in

## What was confirmed

- The live backend has the question-bank tables and access rules, but currently contains **0 courses, 0 sections, 0 sub-subjects, and 0 questions**. This is why old course links show “This bank has moved.”
- The uploaded website ZIP contains the database structure, but no export of the previous question-bank records.
- Rita AI Model 3.8 exists, but its current PDF pipeline is pinned to an older Gemini model and AI features use several separate key/model resolution paths.
- Google sign-in is isolated to the shared sign-in/register window; email/password sign-in, signup, reset, and onboarding are independent.

## 1. Restore the original question-bank content

- Accept the old SQL, CSV, JSON, or Excel export when it is uploaded.
- Validate and map its courses, subject sections, sub-subjects, questions, answer options, IDs, ordering, publication state, and access level to the current backend structure.
- Import in dependency order so every relationship remains valid:

```text
courses → subject sections → sub-subjects → questions → answer options
```

- Preserve stable IDs where the export contains them so old course links work again.
- If the export uses an older format, transform it without discarding records and report any rows that cannot be mapped safely.
- Keep question content protected by the existing enrollment/admin rules, but adjust subject visibility so visitors can see the complete published subject/sub-subject outline as locked items rather than seeing an empty bank.
- Replace the misleading moved-bank fallback with a useful unavailable state only for genuinely invalid or unpublished course links.

## 2. Connect Rita 3.8 and compatible AI study features to one Gemini key

- Store the Gemini key that was supplied in chat as a protected server secret; never place it in source files, browser code, logs, or the database key table.
- Standardize compatible AI study features on that one protected key, including Rita 3.8, question generation, PDF/card import, summaries, Lecture Lab, All in One, archive solving, and German text-generation tools.
- Remove conflicting per-tool/shared Gemini-key precedence where it could silently select a different key.
- Update Rita 3.8 from its old hard-coded Gemini 2.5 model to the supported Gemini 3.8 Flash model path, while preserving its PDF cutting, batch processing, explanations, and saving into the selected sub-subject.
- Consolidate duplicated Gemini request helpers so model selection, authorization, retries, quota errors, and user-facing errors behave consistently.
- Leave payments, email, storage, and other non-AI services unchanged.
- Keep the separate audio service only where Gemini cannot replace the existing speech generation/transcription behavior without losing functionality; it will not receive the pasted Gemini key.

## 3. Remove Google login completely

- Remove Google buttons from both sign-in and registration views.
- Make email/password forms immediately visible instead of requiring “Continue with email.”
- Remove the Google button component, OAuth-only callback usage, Google redirect state, and the now-unused cloud-auth package when no remaining feature imports it.
- Disable Google as an authentication provider while keeping email/password signup, sign-in, password reset, verification, onboarding, and remembered-login behavior working.
- Do not edit unrelated generated OAuth/MCP files or remove Google Search Console/font entries, since those are not Google login.

## 4. Verification

- Import the uploaded dataset into a clean test pass, compare source/imported row counts, and verify representative course → section → sub-subject → question → answer chains.
- Test public, signed-in non-enrolled, enrolled, and admin question-bank views; confirm published outlines appear and protected questions remain protected.
- Run a real Gemini request through each distinct AI path, including a Rita 3.8 job that saves generated questions into an imported sub-subject; surface exact provider errors rather than hiding them.
- Test sign in, registration, email verification handling, password reset, logout, and post-login navigation with no Google controls or broken imports.
- Check desktop and phone layouts, browser errors, and type safety.

## Needed before the data-import step

Upload the old question-bank export (SQL, CSV/JSON files, or Excel). The code, security, AI, and login work can proceed, but the exact old subjects and questions cannot be reconstructed until that file is available.
