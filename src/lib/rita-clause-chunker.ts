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

const OPENING_FILLER = /^(?:(?:مم+|همم+|آ?مم+|فهمت\s+عليك(?:ي)?|خليني\s+(?:أ|ا)?شوف|طيب|تمام|حسناً|حسنا|okay(?:\s+so)?|ok(?:ay)?|h+m+|m+h+m+|got\s+you|let\s+me\s+(?:think|see)|also\s+gut|verstehe|lass\s+mich\s+kurz\s+überlegen)[\s،,.!?؟؛:…-]*)+/iu;

export function stripRitaOpeningFiller(value: string) {
  return value.replace(OPENING_FILLER, "").trimStart();
}

/** Holds only the opening long enough to remove spoken filler before text or audio sees it. */
export class RitaReplySanitizer {
  private pending = "";
  private released = false;

  push(delta: string) {
    if (this.released) return delta;
    this.pending += delta;
    if (this.pending.length < 48 && !/[.!?؟؛:\n]/u.test(this.pending)) return "";
    this.released = true;
    const clean = stripRitaOpeningFiller(this.pending);
    this.pending = "";
    return clean;
  }

  flush() {
    if (this.released) return "";
    this.released = true;
    const clean = stripRitaOpeningFiller(this.pending);
    this.pending = "";
    return clean;
  }
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
    while (clean && this.emitted < 7) {
      // The first clause is released early (≥4 words at any clause mark, hard
      // cap 10 words) so the voice starts almost as soon as the text appears.
      // Later clauses stay longer so speech never sounds chopped.
      const first = this.emitted === 0;
      const minWords = first ? 3 : 8;
      const maxWords = first ? 6 : 18;
      const pattern = first ? /[.!?؟؛:,،](?:\s|$)/g : /[.!?؟؛:](?:\s|$)/g;
      const matches = [...clean.matchAll(pattern)];
      const boundary = matches.find(
        (match) => wordCount(clean.slice(0, (match.index ?? 0) + 1)) >= minWords,
      );
      let cut = boundary ? (boundary.index ?? 0) + 1 : -1;
      if (cut < 0 && wordCount(clean) > maxWords) {
        const firstWords = clean.split(/\s+/).slice(0, maxWords).join(" ");
        const soft = Math.max(firstWords.lastIndexOf(","), firstWords.lastIndexOf("،"));
        cut =
          soft >= 0 && wordCount(firstWords.slice(0, soft)) >= minWords
            ? soft + 1
            : firstWords.length;
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
      const words = clean.split(/\s+/);
      while (words.length && this.emitted < 8) {
        output.push(words.splice(0, 24).join(" "));
        this.emitted += 1;
      }
      this.raw = "";
    }
    return output;
  }
}
