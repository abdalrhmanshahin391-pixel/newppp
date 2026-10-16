# Rita's Jordanian speech: how it works and how to add phrases

Where it lives: `voice-agent/rita_dialect.py` (prompt text `DIALECT_PROMPT`, greetings
`GREETINGS`, watch list `KNOWN_WRONG`). The worker image only carries Python modules, so to
add a phrase tell Claude (or edit that file) and redeploy the worker.

## What is in place
- **Phrasebank and "say this, not that"** in the prompt: هيك not هكذا، هلأ not الآن، شو not ماذا،
  ليش not لماذا، وين not أين، بدي not أريد، ما بعرف not لا أعرف، هاد/هاي not هذا/هذه.
- **Banned**: "كيف فيك" (means "how can you"; greet with "كيف الحال؟") and "شو حابب/حابة"
  (guesses gender; ask "عن شو بدنا نحكي؟").
- **"How do I say X in English?"** is answered in Arabic: one short sentence, the phrase once in
  quotes, one usage tip. A plain question like this no longer switches the conversation language.
- **First hello** ("مرحبا ريتا", "hello", "hallo"…) gets a scripted greeting, no model call.
- **Speech cleaner** drops `*` and backticks and a full stop after a closing quote before the voice.
- **Dialect watch**: phrases in `KNOWN_WRONG` are logged as "Rita dialect watch" (never rewritten
  mid-speech), so real mistakes can be collected and moved into the prompt.

## What is not covered
- How Cartesia pronounces the dialect. That needs a listening test.
- Comparing other language models. Only worth doing with a set of real sentences rated by a
  native speaker; send the phrases that sounded wrong and they become tests.

## Send me
Each phrase that sounded wrong, what you would say instead, and (if possible) the time of the call.
