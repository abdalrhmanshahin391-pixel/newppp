/** Slow or normal playback of one phrase with the browser's own voices. No server cost. */
export function canSpeak(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window
  );
}

export function speakSample(
  text: string,
  language: "de" | "en",
  rate: number,
  handlers: { onStart?: () => void; onEnd?: () => void } = {},
): void {
  if (!canSpeak() || !text.trim()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const tag = language === "de" ? "de-DE" : "en-GB";
  utterance.lang = tag;
  utterance.rate = rate;
  const voice = synth
    .getVoices()
    .find((candidate) => candidate.lang.toLowerCase().startsWith(language));
  if (voice) utterance.voice = voice;
  utterance.onstart = () => handlers.onStart?.();
  let ended = false;
  const finish = () => {
    if (ended) return;
    ended = true;
    handlers.onEnd?.();
  };
  utterance.onend = finish;
  utterance.onerror = finish;
  synth.speak(utterance);
}

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel();
}
