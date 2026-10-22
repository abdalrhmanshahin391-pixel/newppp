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
export function settleDraftReply<
  T extends { id: string; text: string; interruptedAt?: number | null },
>(
  messages: T[],
  draftId: string | null,
  visible: string,
  newMessage: T | null,
  interruptedAt: number | null = null,
): T[] {
  if (draftId && messages.some((message) => message.id === draftId)) {
    return visible
      ? messages.map((message) =>
          message.id === draftId ? { ...message, text: visible, interruptedAt } : message,
        )
      : messages.filter((message) => message.id !== draftId);
  }
  return visible && newMessage ? [...messages, { ...newMessage, interruptedAt }] : messages;
}

/**
 * The learner's side of one exchange. Soniox ends a segment at every breath, so one question can
 * arrive as several finished pieces and the learner can start speaking again before Rita has
 * answered. Until Rita starts to answer (or the exchange is settled) every piece belongs to the
 * same bubble: one id, one start time, the words in order and each word once. After that the next
 * words open a fresh turn that starts from nothing.
 */
export class LearnerTurn {
  private words = "";
  private bubbleId = "";
  private startedAt = "";
  private open = false;
  /** An id was handed out for the turn that has not been closed yet. */
  private assigned = false;

  get text() {
    return this.words;
  }

  get id() {
    return this.bubbleId;
  }

  get createdAt() {
    return this.startedAt;
  }

  /** The learner began to speak (a new piece of the turn, or the first one). */
  speechStarted(newId: string, nowIso: string) {
    if (this.open || this.assigned) return;
    this.bubbleId = newId;
    this.startedAt = nowIso;
    this.assigned = true;
  }

  /** A finished piece of speech; returns the whole turn so far. */
  addFinal(text: string, newId: string, nowIso: string, maxLength = 500) {
    const piece = text.trim();
    if (!this.open) {
      this.words = "";
      if (!this.assigned) {
        this.bubbleId = newId;
        this.startedAt = nowIso;
      }
    }
    this.open = true;
    this.assigned = true;
    this.words = `${this.words} ${piece}`.trim().slice(-maxLength);
    return this.words;
  }

  /** Rita started to answer: whatever the learner says next is a new turn. */
  replyStarted() {
    this.open = false;
    this.assigned = false;
  }

  /** The words of the turn, handed over once; the turn is closed afterwards. */
  take() {
    const taken = this.words;
    this.words = "";
    this.open = false;
    this.assigned = false;
    return taken;
  }
}
