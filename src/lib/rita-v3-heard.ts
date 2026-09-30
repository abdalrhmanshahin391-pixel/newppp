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

/** A VAD start is only an interruption candidate; a brief acknowledgement may not stop Rita. */
export function wasRitaInterrupted(candidateAtMs: number, botStoppedAtMs: number) {
  return (
    candidateAtMs > 0 && botStoppedAtMs >= candidateAtMs && botStoppedAtMs - candidateAtMs < 1_500
  );
}
