// Flashcard subjects form a tree (a subject can have sub-subjects). The picker shows
// each one with its path so "Grammar / Articles" is never confused with "Verbs / Articles".

export type FlashSubject = { id: string; parent_id: string | null; name: string };
export type SubjectOption = { id: string; label: string; depth: number };

const MAX_DEPTH = 5;

export function subjectOptions(subjects: FlashSubject[]): SubjectOption[] {
  const byId = new Map(subjects.map((subject) => [subject.id, subject]));
  const children = new Map<string | null, FlashSubject[]>();
  for (const subject of subjects) {
    // A parent that is missing (deleted) makes the subject top-level; never lose it.
    const parent = subject.parent_id && byId.has(subject.parent_id) ? subject.parent_id : null;
    children.set(parent, [...(children.get(parent) ?? []), subject]);
  }
  const out: SubjectOption[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | null, path: string[]) => {
    const list = [...(children.get(parent) ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
    for (const subject of list) {
      if (seen.has(subject.id) || path.length >= MAX_DEPTH) continue; // cycles and runaway depth
      seen.add(subject.id);
      const names = [...path, subject.name];
      out.push({ id: subject.id, label: names.join(" / "), depth: path.length });
      walk(subject.id, names);
    }
  };
  walk(null, []);
  return out;
}

/**
 * Makes a spoken subject name and a stored one comparable. The voice worker sends its hint
 * with Arabic letters unified and repeats collapsed, so both sides get the same treatment.
 */
export function foldName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f\u064b-\u065f\u0640]/g, "")
    .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627")
    .replace(/\u0649/g, "\u064a")
    .replace(/\u0629/g, "\u0647")
    .replace(/\u00df/g, "ss")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]|_/gu, " ")
    .replace(/(.)\1+/gu, "$1")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word.length > 3 && word.startsWith("\u0627\u0644") ? word.slice(2) : word))
    .join(" ");
}

/** Finds the one subject a spoken name points to; null when it is missing or ambiguous. */
export function matchSubject(options: SubjectOption[], spoken: string): SubjectOption | null {
  const wanted = foldName(spoken);
  if (!wanted) return null;
  const exact = options.filter((option) => foldName(option.label) === wanted);
  if (exact.length === 1) return exact[0];
  const lastName = (option: SubjectOption) => foldName(option.label.split(" / ").pop() ?? "");
  const byName = options.filter((option) => lastName(option) === wanted);
  if (byName.length === 1) return byName[0];
  const contains = options.filter((option) => foldName(option.label).includes(wanted));
  return contains.length === 1 ? contains[0] : null;
}
