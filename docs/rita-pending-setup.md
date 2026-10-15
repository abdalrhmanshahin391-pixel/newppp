# Rita: steps the owner still has to do

A running list. Nothing here needs code changes; each step is done in Modal,
the database (Lovable Cloud / Supabase) or the secrets settings. Never paste
keys into chat or commit them: put them in the secrets settings only.

When the owner asks for "the list", compile everything below into one
ready-to-send text (for ChatGPT or Lovable) and add anything new that was
added since.

## Open

1. **Redeploy the Modal voice worker**
   - From the repository root on `main`: `modal deploy voice-agent/modal_app.py`
   - App `ritajet-voice`, secret `ritajet-voice` must keep: `SONIOX_API_KEY`,
     `GROQ_API_KEY`, `CARTESIA_API_KEY`, `DAILY_API_KEY`, `RITA_MODAL_TOKEN`
     (same value as `MODAL_START_TOKEN` on the website).
   - Why: `voice-agent/bot.py` has the new lesson section (`lesson_section`).
   - After: try a normal free conversation on `/rita-live` and confirm sound.

2. **Database migrations (Supabase / Lovable Cloud)**
   - `20261014200000_rita_curriculum_lessons.sql` (applied on main by Lovable)
   - `20261015120000_rita_curriculum_gaps.sql` (applied on main by Lovable)
   - `20261015180000_rita_lesson_image_lock.sql` **new**: adds
     `rita_lessons.image_generating_at`. Until it is applied, automatic lesson
     pictures stay off (nothing breaks).
   - Check the buckets exist: `rita-curricula` (private) and
     `rita-lesson-images`.

3. **OpenAI secret**
   - Add `OPENAI_API_KEY` in the project secrets (Lovable Cloud → Secrets).
   - Used for reading PDFs (`gpt-4.1-mini`) and lesson pictures (`gpt-image-1`).
   - Optional: `RITA_IMAGE_QUALITY=medium` to make pictures cheaper
     (default is `high`), `RITA_IMAGE_MODEL`, `RITA_CURRICULUM_MODEL`.

4. **Import the sample lessons** (`/admin/curricula`)
   - Add the grammar book (type: قواعد) with
     `docs/curriculum-samples/a1-english-grammar.pdf`, then the words book
     (type: كلمات) with `a1-english-words.pdf`.
   - For each book: import summary JSON (`*.summary.json`), then
     الدروس → استيراد JSON (`*.lessons.json`).
   - Publish the lessons in the order wanted, then both books, then open
     `/rita-lessons` and press متابعة.
   - With the key from step 3, opening a lesson makes its real picture.

## Done

- PR #25 (hub page, simpler conversation, pink orb) merged into `main`.
- PR #26 (chat left / orb right, automatic lesson pictures, red X) is open as a
  draft.
