# Sample curriculum for Rita lessons

Two small A1 English books for testing the curriculum flow without spending AI credits.

| File | What it is |
| --- | --- |
| `a1-english-grammar.pdf` | Cover + 5 grammar rules (to be, pronouns, a/an, possessives, present simple) |
| `a1-english-words.pdf` | Cover + 5 word units (hello, me & you, thank you, yes/no, I'm busy) |
| `*.summary.json` | The reading summary for pages 1–6 of each book |
| `*.lessons.json` | Five ready lessons per book (objectives, criteria, plan, words, picture) |

## Try it

1. Apply `supabase/migrations/20261014200000_rita_curriculum_lessons.sql`.
2. Open `/admin/curricula`, add the grammar book (type: قواعد) with its PDF, then the words book (type: كلمات).
3. For each book: **استيراد ملخص JSON** → paste `*.summary.json` → save. The book now shows pages 1–6 as read.
   (With `OPENAI_API_KEY` set you can press **اقرأ الصفحات 1–6** instead.)
4. **الدروس → استيراد JSON** → paste the whole `*.lessons.json` → import. All five lessons arrive as drafts.
5. Publish the lessons in the order you want them on the path, then publish both books.
6. Open `/rita-lessons` as a learner and press **متابعة**.

Pictures for the samples live in `public/curriculum/` (drawn by `scripts/curriculum-samples/make_lesson_art.py`).
New lessons get an AI picture in the same style from the **إنشاء صورة** button.

## Review notes

The sample content was reviewed for accuracy: the possessives teacher note was
corrected (Arabic attaches the possessive to the noun, which is why learners say
"book my"), the questions with to be and do/does now have objectives, every
taught word has an Arabic meaning, no two phrases share one Arabic meaning, the
plans are specific to each lesson, and meanings show masculine and feminine
forms. A language teacher should still review the content before real use.
The books are regenerated from `scripts/curriculum-samples/sample_books.py`
(PDFs) and `make_sample_lessons.py` (summaries and lessons).
