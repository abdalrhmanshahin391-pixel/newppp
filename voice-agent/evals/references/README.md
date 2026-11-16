# Reference chats

A reference is a chat from another app whose replies the owner wants Uzyra to sound like. The
talk eval plays the same learner lines to Uzyra and puts both replies side by side, with the
reference's style (length, questions, corrections, sheets, Arabic share) as the target.

## Adding one

1. Send the chat (screenshots or pasted text) and say what you like about it.
2. It is written here as `<name>.json`, copying the learner lines and the app's replies as they
   are. A reply that was spoken by the app and also shown as a table goes in one string, with the
   table after a line `[[SHEET]]`.
3. Run it: Actions → Rita content probe → task `talk-eval`, reference `<name>` (optionally
   runs 2, judge `openai/gpt-oss-120b`). The report is on the run's summary page.

```json
{
  "name": "cafe-de",
  "source": "where the chat came from and when",
  "site_language": "ar",
  "target": {"code": "de", "name": "German", "speechCode": "de"},
  "notes": "what is good about these replies",
  "conversations": [
    {"id": "cafe", "turns": [
      {"learner": "learner line", "reply": "the app's reply"},
      {"learner": "Ich möchte ein Kaffee", "reply": "…", "expect": {"fix": ["einen Kaffee"]}}
    ]}
  ]
}
```

`expect` is optional per turn: `fix` (the right form must appear), `must` (one of these words must
appear), `right` (the learner's sentence is right: no correction), `forbid`, `sheet`
(`yes`/`no`/`any`), `free_language` (a reply without Arabic is fine), `listen` (a feeling: no teaching), `risk` (a gentle
question about thoughts of harm), `crisis` (real help), `no_question` (the learner asked for answers
only: no question), `arabic` (a plain Arabic chat: no English or German phrase of Uzyra's own).

Keep a chat's own words; do not tidy them. Leave out names and personal details of real people.
`example-short-tutor.json` shows the format; its replies are written by hand and do not come from
any app. `jordanian-everyday.json` is the same kind: the learner lines come from a chat on the live
site (speech recognition errors kept), and the replies are written by hand as the target.

Run references with history `own` to see how Uzyra holds a whole chat with her own replies; the
default `reference` history only shows each reply in the other app's context.
