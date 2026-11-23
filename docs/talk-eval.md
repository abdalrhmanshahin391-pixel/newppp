# Free-talk evaluation (Jordanian learners)

Measures what Uzyra **says** in a free conversation. This is text only: the worker's real prompt and
speech cleaner are used with the Groq model, and no voice service (Cartesia, Soniox) is called.

A free conversation has its own short prompt and settings, in `voice-agent/rita_free_talk_prompt.py`
(spoken answers of about 15 words, the fact first, Jordanian Arabic with terms in English, medium
thinking). The eval sends exactly what the worker sends. The OB/GYN review reference
(`obgyn-review`, 57 study questions with target answers) is the check for study questions; run it
with history `reference` (3 runs) and `own`, and the everyday, support and German references plus
the corpus (`split: all`) as regressions. Groq's "Parsing failed" error is retried once at another
temperature, before any word is spoken, in the worker and in the eval.

## Run it

Actions → **Rita content probe** → Run workflow:

- **task:** `talk-eval`
- **branch:** any; run it on a branch to measure a prompt change before merging.
- **model:** a Groq model id. Empty means the worker's model.
- **effort:** `low`, `medium` or `high`. Empty means the worker's own levels.
- **split:** `dev`, `holdout`, `all`, or `feelings` (only the feelings and understanding talks).

The log prints every reply. The artifact `rita-talk-eval` holds the same rows as JSON, including the
time to the first written word. Locally:
`modal run modal_app.py::talk_eval --split dev` (from `voice-agent/`).

## Modes (inputs of task `talk-eval`)

| Input | What it does |
| --- | --- |
| `split` | `dev`, `holdout` or `all` lines of the built-in corpus; `feelings` runs only the talks about feelings and being understood, from both parts |
| `runs` | plays the same lines 1-3 times; the report gives each run and the range. One run can move ±8 points, so compare means. |
| `reference` | plays another app's chat from `voice-agent/evals/references/<name>.json` instead of the corpus (see the README there) |
| `judge` | a Groq model (e.g. `openai/gpt-oss-120b`) scores every reply 1-5. With a reference it also says which reply is better. It costs about as many requests again. |
| `model`, `effort` | the model and thinking level being tested |

### The report

The report is on the run's summary page (Actions → the run). The same report, plus every reply as
JSON, is in the `rita-talk-eval` artifact. It has these sections:

- **Score:** passed per part, each run, the first written word, mean length.
- **Where it goes wrong:** failures per problem (length, correction, content, off-topic question,
  sheet, language, …). Each failure gets a **layer**:
  - **router:** the turn was given the wrong reply type, for example rules asked for and not marked
    as an explanation. Fix the turn router, not the prompt.
  - **model:** the prompt fit the turn and the model did not follow it. Fix the prompt, or try
    another model or thinking level.
  - **service:** the request failed.
- **Kind of turn:** the pass rate for mistakes to correct, right sentences, word questions,
  rules or lists, "did not understand", role plays and chat.
- **Style against the reference** (reference runs only): length, questions, phrases in quotes,
  corrections, sheets, lists, emoji and Arabic share for both, with the biggest gaps in words. The
  reference also sets the length limit (its long replies plus 15%).
- **Judge** (when asked): the mean scores and, against a reference, how often each reply was
  better.
- **Worst 10 replies:** Uzyra's reply next to the reference, with the problems, the layer and the
  judge's reason.

Each row in the JSON also keeps the reply type the router chose, whether the explanation budget
was used, the thinking level, why the stream ended, the raw model text and how many characters
the speech cleaner removed.

### Reference history

By default, each turn of a reference chat is played with the **other app's** earlier replies in the
history. Both apps then answer every turn in the same context, and the replies can be compared one
to one. Set `history` to `own` locally (`--history own`) to feed Uzyra's own replies back and see
how a whole chat drifts.

### Comparing two runs

`python voice-agent/rita_eval_report.py A.json B.json` compares two runs: two branches (two prompt
versions), two models or two thinking levels. It prints the totals, the problem counts, and the
turns that went from fail to pass or back, with both replies.

### The judge is a help, not a verdict

The judge is a model grading a model, usually of the same family, so it can favour its own way of
writing. Its scores show where to read first; the replies are still read before any change.
Besides correct, dialect, helpful and fit it gives `understood` (it answers what the learner meant)
and `human` (warm and simple, not a lecture). On feelings it was lenient at first (it called a
reply with an English phrase to learn better than a reply that only listened), so its prompt is
strict on feelings turns; the automatic checks still decide pass or fail.

## The corpus

`voice-agent/rita_talk_eval_corpus.py` holds 42 conversations, 157 turns. They are written by hand
the way Jordanian students talk to a tutor:

- dialect with English or German mixed in;
- words a speech recogniser writes in Arabic letters (ميك، بيته، جوتن مورجن);
- real goals: IELTS, Goethe A1, working as a doctor in Germany, a job interview;
- role plays, "ما فهمت", giving up, off-topic questions;
- feelings: exam stress, shame after a round, "I'm useless", family pressure, loneliness abroad,
  hopeless words and talk of disappearing, and a push back on the questions ("شو هاي الأسئلة");
- "answer what I asked": a learner who corrects their own question.

No public dialect corpus is copied: MADAR and similar corpora hold general sentences, and their
licences are for research only.

- **DEV** (27 conversations): prompts are changed against it.
- **HOLDOUT** (15 conversations): only read for the final score. A change that only fits DEV lines
  does not count as an improvement. The prompt's own examples never reuse corpus words.

## How a reply is judged

1. **Automatic checks** (`rita_talk_probe.check_turn`):
   - spoken length and number of questions;
   - a sheet when one is needed;
   - a correction when there is a mistake, and none when the sentence is right;
   - the expected word or fact (`must`);
   - Arabic for an Arabic speaker (except role plays and a requested language switch);
   - no stock "hobbies / free time" question off the topic;
   - no phonetic symbols in speech;
   - a feelings turn (`listen`) gets no correction and no phrase to learn, and has room for about
     45 words; hopeless words (`risk`) get a gentle question about thoughts of harm; talk of harm or
     disappearing (`crisis`) gets a pointer to real help (911, a trusted person).
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
