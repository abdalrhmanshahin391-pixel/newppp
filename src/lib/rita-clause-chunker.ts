export function cleanRitaSpokenText(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\*\*|__|~~|`/g, "")
    .replace(/^\s{0,3}(?:#{1,6}|[-*+]\s|\d+[.)]\s)/gm, "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\[[^\]]{0,80}\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export class RitaClauseChunker {
  private raw = "";
  private emitted = 0;

  push(delta: string) {
    this.raw += delta;
    return this.take(false);
  }

  flush() {
    return this.take(true);
  }

  private take(final: boolean) {
    const output: string[] = [];
    let clean = cleanRitaSpokenText(this.raw);
    while (clean && this.emitted < 2) {
      const matches = [...clean.matchAll(/[.!?؟؛:](?:\s|$)/g)];
      const boundary = matches.find(
        (match) => wordCount(clean.slice(0, (match.index ?? 0) + 1)) >= 8,
      );
      let cut = boundary ? (boundary.index ?? 0) + 1 : -1;
      if (cut < 0 && wordCount(clean) >= 18) {
        const firstWords = clean.split(/\s+/).slice(0, 18).join(" ");
        const soft = Math.max(firstWords.lastIndexOf(","), firstWords.lastIndexOf("،"));
        cut = soft >= 0 && wordCount(firstWords.slice(0, soft)) >= 8 ? soft + 1 : firstWords.length;
      }
      if (cut < 0) break;
      const segment = clean.slice(0, cut).trim();
      if (!segment) break;
      output.push(segment);
      this.emitted += 1;
      const rawCut = this.raw.indexOf(segment) + segment.length;
      this.raw = rawCut >= segment.length ? this.raw.slice(rawCut) : clean.slice(cut);
      clean = cleanRitaSpokenText(this.raw);
    }
    if (final && clean) {
      output.push(clean);
      this.raw = "";
      this.emitted += 1;
    }
    return output;
  }
}
