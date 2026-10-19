// The model sometimes writes a note to itself ("User wants continue.") inside its reply.
// The voice worker drops it before speech; this removes it from what the page shows, so the
// live chat never displays it either. Only specific openings match, so normal sentences pass.
const NOTE_OPENING =
  /^(?:the\s+)?(?:user|learner)\s+(?:wants?|asks?|asked|said|says|is|needs?|has|would)\b|^(?:we|rita|assistant)\s+(?:should|must|need to|needs to)\s+(?:respond|answer|reply|continue|explain)\b|^(?:learner_act|directive|last_question|topic_paused|response_type|teaching_strategy)\b|^(?:respond|answer|reply)\s+in\s+(?:arabic|jordanian)\b/i;

export function stripModelNotes(text: string): string {
  let cleaned = text;
  if (/[A-Za-z]/.test(cleaned)) {
    // Keep every separator so the text around a removed note reads as before.
    const parts = cleaned.split(/([.!?؟\n]+)/);
    const out: string[] = [];
    for (let i = 0; i < parts.length; i += 2) {
      const sentence = parts[i] ?? "";
      const stop = parts[i + 1] ?? "";
      if (NOTE_OPENING.test(sentence.trim())) continue;
      out.push(sentence + stop);
    }
    cleaned = out.join("");
  }
  // Speech should already be plain text. This is a final display guard for a
  // model that emitted page-oriented Markdown despite the voice contract.
  return cleaned
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/^\s{0,3}(?:#{1,6}|[-*+]\s)\s*/gm, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
