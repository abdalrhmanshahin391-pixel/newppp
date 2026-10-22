/**
 * The language Rita explains in, chosen on the website. It is separate from the language being
 * learned (see learning-language.ts): a learner of German can have the explanations in Arabic or in
 * English. "automatic" keeps Rita's old behaviour (she follows the language the learner speaks).
 *
 * The choice is a `rita_*` key in localStorage, which the cloud sync already mirrors to the
 * account, so it follows the learner to another device without a database change. It is sent to
 * the voice worker when a conversation starts and, if it changes during one, as a live message.
 */

export type ExplanationLanguage = "automatic" | "ar" | "en";

export const EXPLANATION_LANGUAGES: readonly ExplanationLanguage[] = ["automatic", "ar", "en"];

/** Shared by every learning language, so it is not one of the per-language study-kit keys. */
export const EXPLANATION_STORAGE_KEY = "rita_explanation_language";

/** Same page, another tab or the cloud sync: anything that can change the stored value. */
export const EXPLANATION_CHANGED_EVENT = "rita-explanation-language";

export function parseExplanationLanguage(raw: unknown): ExplanationLanguage {
  let value = raw;
  if (typeof raw === "string") {
    // The cloud sync stores values as JSON ("ar" with quotes); a plain ar is accepted too.
    try {
      value = JSON.parse(raw);
    } catch {
      value = raw;
    }
  }
  return EXPLANATION_LANGUAGES.includes(value as ExplanationLanguage)
    ? (value as ExplanationLanguage)
    : "automatic";
}

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem">;

export function readExplanationLanguage(storage: ReadableStorage | null): ExplanationLanguage {
  try {
    return parseExplanationLanguage(storage?.getItem(EXPLANATION_STORAGE_KEY) ?? null);
  } catch {
    return "automatic";
  }
}

export function writeExplanationLanguage(
  storage: WritableStorage | null,
  value: ExplanationLanguage,
): void {
  try {
    storage?.setItem(EXPLANATION_STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* a private window or a full device: the choice still applies to this page */
  }
}

/** What the page tells the running worker when the choice changes during a conversation. */
export function settingsMessage(value: ExplanationLanguage) {
  return { type: "rita-settings" as const, data: { explanationLanguage: value } };
}

type Ui = "en" | "ar";

export function explanationLabel(value: ExplanationLanguage, ui: Ui): string {
  if (value === "ar") return "العربية";
  if (value === "en") return "English";
  return ui === "ar" ? "حسب كلامي" : "Like I speak";
}

/** One short line about what the choice does, said in the words of the page. */
export function explanationHint(value: ExplanationLanguage, ui: Ui, live: boolean): string {
  const when = live ? (ui === "ar" ? "من ردّها الجاي" : "from her next answer") : "";
  if (ui === "ar") {
    if (value === "automatic") return `ريتا بتجاوب بلغة كلامك${live ? ` ${when}` : ""}.`;
    const name = value === "ar" ? "بالعربي" : "بالإنجليزي";
    return `ريتا بتشرح ${name}${live ? ` ${when}` : ""}. العبارات اللي بتتعلمها بتضل بلغتها.`;
  }
  if (value === "automatic")
    return `Rita answers in the language you speak${live ? ` ${when}` : ""}.`;
  const name = value === "ar" ? "Arabic" : "English";
  return `Rita explains in ${name}${live ? ` ${when}` : ""}. The phrases you learn stay in their own language.`;
}

/** Arrow keys move the choice in a radio group; left and right swap in a right-to-left page. */
export function nextExplanationIndex(index: number, key: string, rtl: boolean): number | null {
  const step =
    key === "ArrowDown"
      ? 1
      : key === "ArrowUp"
        ? -1
        : key === "ArrowRight"
          ? rtl
            ? -1
            : 1
          : key === "ArrowLeft"
            ? rtl
              ? 1
              : -1
            : 0;
  if (!step) return null;
  const count = EXPLANATION_LANGUAGES.length;
  return (index + step + count) % count;
}

/**
 * What to show when the page reads the stored choice. The account sync clears the device copy and
 * then pulls the account's, so for a moment the key can be missing although the learner chose. A
 * missing key therefore keeps what this page already showed for the same account, and only means
 * "automatic" when nothing was shown yet (or the account changed).
 */
export function pickExplanation(
  raw: string | null,
  memory: { value: ExplanationLanguage; account: string | null } | null,
  account: string | null,
): ExplanationLanguage {
  if (raw !== null) return parseExplanationLanguage(raw);
  return memory && memory.account === account ? memory.value : "automatic";
}
