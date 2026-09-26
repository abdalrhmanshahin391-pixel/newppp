const INCOMPLETE_ENDINGS = [
  /(?:^|\s)(?:و|أو|او|بس|لأن|لانه|لأنّه|يعني|مثلا|مثلاً)$/u,
  /\b(?:and|or|but|because|so|to|if|when|that)$/i,
  /\b(?:und|oder|aber|weil|dass|wenn|ich möchte)$/i,
];

export function ritaEndOfTurnDelay(text: string) {
  const clean = text.trim();
  if (!clean) return 900;
  if (INCOMPLETE_ENDINGS.some((pattern) => pattern.test(clean))) return 900;
  if (/[.!?؟؛:]$/.test(clean)) return 150;
  const words = clean.split(/\s+/).length;
  if (words <= 2) return 550;
  return 250;
}
