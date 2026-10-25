/**
 * What the AI's reading of one scanned page came back as. The AI is asked for the page's text only,
 * and for the word NO_TEXT when the page has none. Real replies are messier (an empty answer, a
 * polite refusal, a JSON wrapper, a reply cut at the limit), and none of them may stop a whole book
 * or be silently dropped.
 */
export type TranscriptOutcome =
  | { kind: "text"; text: string }
  /** The AI said the page has no text to read: a cover, a divider, a picture. */
  | { kind: "blank"; reason: string }
  /** The AI declined to read it. */
  | { kind: "refused"; reason: string }
  /** The reply was cut at the length limit: the text so far is kept. */
  | { kind: "cut"; text: string };

const REFUSAL_START =
  /^(i['’]?m sorry|i am sorry|sorry|i can['’]?t|i cannot|i['’]?m unable|i am unable|unable to|as an ai)/i;

export function interpretTranscript(
  raw: string | null | undefined,
  finishReason?: string | null,
  refusal?: string | null,
): TranscriptOutcome {
  if (refusal && refusal.trim()) {
    return { kind: "refused", reason: `The AI declined: ${refusal.trim().slice(0, 160)}` };
  }
  if (finishReason === "content_filter") {
    return { kind: "refused", reason: "The AI's safety filter blocked this page." };
  }
  let text = String(raw ?? "")
    .trim()
    .replace(/^```(?:json|text)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  // An older style of answer: {"text":"..."}.
  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text) as { text?: unknown };
      if (typeof parsed?.text === "string") text = parsed.text.trim();
    } catch {
      /* not JSON: use it as written */
    }
  }
  if (!text || /^["'`.\s]*no[_ ]text["'`.\s]*$/i.test(text)) {
    return { kind: "blank", reason: "The AI found no readable text on the page." };
  }
  if (text.length < 300 && REFUSAL_START.test(text)) {
    return { kind: "refused", reason: `The AI declined: ${text.slice(0, 160)}` };
  }
  if (finishReason === "length") return { kind: "cut", text };
  return { kind: "text", text };
}
