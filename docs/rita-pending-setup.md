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
   - Why: `voice-agent/bot.py` has the new lesson section (`lesson_section`), and the
     worker now reads short turns (stop words, hesitation, answers to choices) and has a
     human-tone prompt, and it understands the list commands below. New modules:
     `rita_dialogue_acts.py`, `rita_turn_router.py`, `rita_ui_commands.py`, `rita_dialect.py`
     (Jordanian phrasebank, scripted first greeting, speech cleaner; see `docs/rita-dialect-bank.md`).
   - After: try a normal free conversation on `/rita-live` and confirm sound. Then test
     by voice: say "خلص" while Rita explains (she should stop and say a short "تمام."),
     answer "إيه" to a question with two options (she should ask "أي واحد…؟"), say
     "أمم…" (she should wait), and tap the new **Stop** button while she speaks.
   - Switches (Modal secret `ritajet-voice`, optional): `RITA_ROUTER_MODE=on|shadow|off`
     (default `on`; `shadow` only logs what it would do), `RITA_INTERRUPT_GATE=new|legacy`,
     `RITA_STOP_ACK=say|silent`. Restart the worker after changing them.

2. **Database migrations (Supabase / Lovable Cloud)**
   - `20261014200000_rita_curriculum_lessons.sql` (applied on main by Lovable)
   - `20261015120000_rita_curriculum_gaps.sql` (applied on main by Lovable)
   - `20261015180000_rita_lesson_image_lock.sql` **new**: adds
     `rita_lessons.image_generating_at`. Until it is applied, automatic lesson
     pictures stay off (nothing breaks).
   - `20261017120000_rita_lesson_slides.sql` **new**: creates `rita_lesson_slides`
     (one slide deck per lesson, admin only). Until it is applied, the lesson builder
     shows a note in the Slides tab and everything else works.
   - `20261017180000_rita_lesson_resources.sql` **new**: creates
     `rita_lesson_resources` (PDF / link / video per lesson) and the **private**
     bucket `rita-lesson-resources` (PDF only, 15 MB, admin write). Learners get
     one-hour signed links from the server. Until it is applied, the Resources tab
     shows a note and lessons work as before.
   - `20261017200000_rita_slides_student_access.sql` **new**: adds
     `rita_lesson_slides.shared` (default off) and a read policy for learners on shared
     decks of published lessons. Until it is applied, learners see no slides and the
     admin switch "أظهر السلايدات للطلاب" stays disabled.
   - Check the buckets exist: `rita-curricula` (private), `rita-lesson-images` and
     `rita-lesson-resources` (private).

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
     الدروس → «استيراد درس من JSON» (`*.lessons.json`).
   - Publish the lessons in the order wanted, then both books, then open
     `/rita-lessons` and press متابعة.
   - With the key from step 3, opening a lesson makes its real picture.
   - The sample books and lessons were corrected after review (a wrong teacher note,
     new objectives, Arabic meanings). If you imported an older copy, re-import both
     summary and lessons JSON so the new text is used.

5. **Check the Lovable AI key for the tap-a-word window**
   - The word window (translation and three pronunciation speeds) uses the same
     `LOVABLE_API_KEY` as the German Lab voice. If German Lab audio works, nothing
     to do; if it does not, set that secret. No migration needed.

6. **Words I asked about (list in the call page) — checks**
   - The website needs the Groq key to read what you asked about: in the admin AI keys
     (provider groq, purpose rita) or the `GROQ_API_KEY` secret. If the list stays at 0
     after asking "شو معنى Haus", this is the first thing to check (the page now shows
     "Could not note that word" instead of failing silently).
   - Test by voice after the Modal redeploy: ask the meaning of a word; open **My words**;
     say "افتحي القائمة" (Rita says "تفضل." and the list opens); say "حوليهم فلاش كارد"
     (the screen asks for the subject) or "حوليهم فلاش كارد في موضوع X" (saved if exactly one
     subject matches); delete or fix a word with the icons; create a subject or sub-subject
     from the list window.

7. **After merging PR #26 and redeploying Modal: test one real call**
   - Say "خلص" while Rita explains; answer "إيه" to a two-option question; say "أمم…";
     tap Stop; say only "مرحبا ريتا" (she should greet you with a scripted, natural greeting); ask
     "كيف أحكي بدي أروح على الحمام بالإنجليزي" (she should answer in Arabic with the English phrase once);
     tap a German or English word in a reply and play fast, slow and precise.
   - Tell me what happened (and, if something sounded wrong, the time of the call), so
     the word lists can be tuned.

## Done

- PR #25 (hub page, simpler conversation, pink orb) merged into `main`.
- PR #26 (tidier chat, tap-a-word window, automatic lesson pictures) is open as a
  draft.
