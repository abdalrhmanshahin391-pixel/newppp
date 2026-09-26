<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Mandatory Planning Protocol
1. **Always Plan First**: For every task, inquiry involving changes, bug fix, or feature, create a comprehensive architectural implementation plan first. Do NOT edit code, run modifying commands, or make changes until the plan is approved.
2. **Senior Architect Standard**: Plans must analyze edge cases, state lifecycles, error states, and invariants thoroughly (Lovable-level architectural review).
3. **Approval Phrase**: When the plan is ready, conclude with the exact phrase:
   **"do u want to apply it like lovable"**
4. **Execution**: Only execute the changes after the user explicitly replies to apply it.

## RitaVoice architecture
- RitaVoice uses Deepgram for live recognition, Groq only for response generation (single model openai/gpt-oss-20b, no fallback chain by owner choice; lesson state computed in browser via rita-lesson-state.ts), and the selected Fish/OpenAI engine only for speech; no second-listen transcription (Deepgram text used directly); learning items come from JSON-mode extraction with examples stored inside the card.
- RitaVoice uses structured AR/DE/NOTE reply lines so Layan speaks Arabic, official Emma speaks German, and written breakdowns stay silent; this prevents mixed-language pronunciation errors.

