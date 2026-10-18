/** Generated text is never proof that an interrupted reply reached the learner. */
export function committedRitaReply(args: {
  reportedSpokenText: string;
  generatedText: string;
  interrupted: boolean;
}) {
  return (
    args.interrupted ? args.reportedSpokenText : args.generatedText || args.reportedSpokenText
  ).trim();
}

/**
 * One isolated bot response. Scripted replies (for example "تمام.") do not
 * emit LLM text, so spoken progress must be able to own a response too.
 */
export class RitaReplyAccumulator {
  generatedText = "";
  spokenText = "";
  draftId: string | null = null;
  private settled = true;

  beginLlm() {
    this.reset(false);
  }

  /** Start a TTS-only response without erasing text from the current LLM response. */
  beginTts() {
    if (this.settled) this.reset(false);
  }

  appendGenerated(text: string) {
    this.settled = false;
    this.generatedText += text;
    return this.generatedText;
  }

  reportSpoken(text: string) {
    this.beginTts();
    this.spokenText = text.trim();
    return this.spokenText;
  }

  visibleText() {
    return (this.generatedText || this.spokenText).trim();
  }

  settle(interrupted: boolean) {
    const result = {
      draftId: this.draftId,
      reply: committedRitaReply({
        reportedSpokenText: this.spokenText,
        generatedText: this.generatedText,
        interrupted,
      }),
    };
    this.reset(true);
    return result;
  }

  clear() {
    this.reset(true);
  }

  private reset(settled: boolean) {
    this.generatedText = "";
    this.spokenText = "";
    this.draftId = null;
    this.settled = settled;
  }
}

/** A VAD start is only an interruption candidate; a brief acknowledgement may not stop Rita. */
export function wasRitaInterrupted(candidateAtMs: number, botStoppedAtMs: number) {
  return (
    candidateAtMs > 0 && botStoppedAtMs >= candidateAtMs && botStoppedAtMs - candidateAtMs < 1_500
  );
}

/** Insert a streamed reply, or update its text if the draft is already in the list. */
export function upsertDraftReply<T extends { id: string; text: string }>(
  messages: T[],
  draft: T,
): T[] {
  return messages.some((message) => message.id === draft.id)
    ? messages.map((message) =>
        message.id === draft.id ? { ...message, text: draft.text } : message,
      )
    : [...messages, draft];
}

/**
 * Settle a streamed reply once playback ends. The learner sees generated text
 * while Rita speaks; afterwards it is trimmed to what was actually heard if the
 * reply was interrupted, and removed if nothing was heard.
 */
export function settleDraftReply<T extends { id: string; text: string }>(
  messages: T[],
  draftId: string | null,
  committed: string,
  newMessage: T | null,
): T[] {
  if (draftId && messages.some((message) => message.id === draftId)) {
    return committed
      ? messages.map((message) =>
          message.id === draftId ? { ...message, text: committed } : message,
        )
      : messages.filter((message) => message.id !== draftId);
  }
  return committed && newMessage ? [...messages, newMessage] : messages;
}
