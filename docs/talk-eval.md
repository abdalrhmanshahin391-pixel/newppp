# Free-talk evaluation (Jordanian learners)

Measures what Uzyra **says** in a free conversation. This is text only: the worker's real prompt and
speech cleaner are used with the Groq model, and no voice service (Cartesia, Soniox) is called.

## Run it

Actions → **Rita content probe** → Run workflow:

- **task:** `talk-eval`
- **branch:** any; run it on a branch to measure a prompt change before merging.
- **model:** a Groq model id. Empty means the worker's model.
- **effort:** `low`, `medium` or `high`. Empty means the worker's own levels.
- **split:** `dev`, `holdout` or `all`.

The log prints every reply. The artifact `rita-talk-eval` holds the same rows as JSON, including the
time to the first written word. Locally:
`modal run modal_app.py::talk_eval --split dev` (from `voice-agent/`).

## The corpus

`voice-agent/rita_talk_eval_corpus.py` holds 32 conversations, 122 turns. They are written by hand
the way Jordanian students talk to a tutor:

- dialect with English or German mixed in;
- words a speech recogniser writes in Arabic letters (ميك، بيته، جوتن مورجن);
- real goals: IELTS, Goethe A1, working as a doctor in Germany, a job interview;
- role plays, "ما فهمت", giving up, off-topic questions.

No public dialect corpus is copied: MADAR and similar corpora hold general sentences, and their
licences are for research only.

- **DEV** (20 conversations): prompts are changed against it.
- **HOLDOUT** (12 conversations): only read for the final score. A change that only fits DEV lines
  does not count as an improvement. The prompt's own examples never reuse corpus words.

## How a reply is judged

1. **Automatic checks** (`rita_talk_probe.check_turn`):
   - spoken length and number of questions;
   - a sheet when one is needed;
   - a correction when there is a mistake, and none when the sentence is right;
   - the expected word or fact (`must`);
   - Arabic for an Arabic speaker (except role plays and a requested language switch);
   - no stock "hobbies / free time" question off the topic;
   - no phonetic symbols in speech.
2. **Reading.** Every turn has a `want` note saying what a good reply does. The checks miss wrong
   grammar facts, an unnatural dialect, or a question that makes no sense, so the replies are read.

## Results (15 Nov 2026)

All rows are scored with the same, final checks.

| Round | Model, thinking | DEV pass | First word (median) | What changed |
| --- | --- | --- | --- | --- |
| 0 | gpt-oss-120b, low (live) | 56% | 287 ms | baseline |
| 0 | gpt-oss-120b, medium | 64% | 1117 ms | more thinking only |
| 0 | qwen3.8-27b | 77% | 472 ms | other model |
| 0 | allam-2-7b | 12% | 278 ms | other model (dropped) |
| 1 | gpt-oss-120b, low | 71% | 247 ms | answer first, follow-up on the topic, role play, words heard in Arabic letters |
| 2 | gpt-oss-120b, low | 74% | 259 ms | corrections first, phrases the learner would say |
| 3 | gpt-oss-120b, low | 63% | 296 ms | one case per turn (Qwen on the same: 78%) |
| 4 | gpt-oss-120b, low | 77% | 262 ms | no hobbies question unless raised; checks fold narrow spaces |
| 5 | gpt-oss-120b, low | 65% | 227 ms | no question after goodbye; a grammar why gets the rule and a sheet |
| 6 | gpt-oss-120b, low (2 runs) | 77% / 79% | 217–220 ms | check the learner's sentence word by word before calling it right |

HOLDOUT, read only at the end: 68% before; 73% (round 4), 68% (round 5), 75% / 68% (round 6, two
runs). The same version can move about ±8 points between runs at temperature 0.45, so compare two
runs, not one.

Problem counts over all 122 turns (before → round 6, two runs):

- off-topic hobbies question: 32 → 2 / 5;
- missed correction: 1 → 1 / 2;
- missing expected content: 7 → 6 / 6;
- phonetic symbols: 2 → 3 / 0. These are now also removed from speech by the speech filter
  (`rita_dialect.SpeechTextFilter`).
- over the length limit: 14 → 18 / 16, mostly corrections that now carry a short reason.

Reading the HOLDOUT replies side by side (round 4 against before): better in 21 turns, worse in 6
and the same in 17. Three of the six were a question after thanks or goodbye, which round 5 fixed.

Findings:

- **Before:** almost every reply ended with the same off-topic question ("شو بتحب تعمل وقت فراغك؟")
  and a quoted phrase that did not answer it. Words heard in Arabic letters were taken as Arabic
  (ميك → microphone). IPA symbols appeared in speech, and there was no role play.
- **Qwen 3.8 27B** sounds more natural in Jordanian Arabic and explains corrections well. Its
  German facts are wrong too often to teach with: "Mädchen is feminine", "Was ist deine Hobbys",
  "das Bett is feminine". It stays off.
- **More thinking (medium)** gives slightly more accurate facts at four times the wait for the
  first word.
- Groq offers only gpt-oss-120b/20b, qwen3.6/3.8-27b and allam-2-7b as chat models on this account
  (`available_models` in the report).

Known gaps:

- Some mistakes are still missed (one was called right). Some facts are approximate (Zum Mitnehmen
  given as "delivery").
- Words like بيته (bitte) and آيش هورنشن (Eichhörnchen) are still misread.
- A gendered imperative sometimes appears.
- Pronunciation, voice quality and real speech recognition are not measured here.
