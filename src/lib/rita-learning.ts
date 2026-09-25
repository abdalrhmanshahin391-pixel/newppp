export type LearningItem = {
  term: string;
  meaning: string;
  language: string;
  kind: "word" | "sentence";
  article: "der" | "die" | "das" | null;
  plural: string | null;
};

export type SaveTarget = "flashcards" | "german_lab";

export function learningKey(item: Pick<LearningItem, "term" | "language">) {
  return `${item.language.toLowerCase().split("-")[0]}:${item.term
    .toLocaleLowerCase()
    .normalize("NFKC")
    .replace(/[.,!?;:]+$/u, "")
    .replace(/\s+/gu, " ")
    .trim()}`;
}

export function isGermanItem(item: LearningItem) {
  return item.language.toLowerCase().split("-")[0] === "de";
}

export function termWithoutArticle(item: LearningItem) {
  return item.article
    ? item.term.replace(new RegExp(`^${item.article}\\s+`, "i"), "").trim()
    : item.term.trim();
}

export function flashcardFaces(item: LearningItem) {
  return {
    front: item.article ? `${item.article} ${termWithoutArticle(item)}` : item.term,
    back: item.meaning,
  };
}
