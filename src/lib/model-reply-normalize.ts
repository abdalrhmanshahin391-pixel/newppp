/**
 * Tidies what the AI writes before it is checked, so a lesson is not thrown away for a reason that
 * does not matter: a note a few characters too long, an id made of words, "Warm-up" for "warmup",
 * seven objectives where six fit. Only cosmetic and counted limits are fixed here. Anything that
 * decides whether an exercise is right (the prompt, the options, the answer) is left alone, so the
 * code checks and the AI's second try still catch a real mistake.
 * Pure: no server or browser imports, so it is tested with node.
 */

type Obj = Record<string, unknown>;
const isObj = (value: unknown): value is Obj =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A string cut to a limit (soft text only). Anything that is not a string is returned as it came. */
export function cut(value: unknown, max: number): unknown {
  return typeof value === "string" ? value.trim().slice(0, max).trim() : value;
}

function list(value: unknown, max: number): unknown[] | unknown {
  return Array.isArray(value) ? value.slice(0, max) : value;
}

function whole(value: unknown): unknown {
  if (typeof value === "string" && /^\s*\d+\s*$/.test(value)) return Number(value);
  return value;
}

function clampInt(value: unknown, min: number, max: number): unknown {
  const number = typeof value === "string" ? Number(value) : value;
  if (typeof number !== "number" || !Number.isFinite(number)) return value;
  return Math.max(min, Math.min(max, Math.round(number)));
}

/** "Uses the -s ending!" -> "uses-the-s-ending": lowercase letters, digits and dashes, at most `max`. */
export function slug(value: unknown, max: number, separator = "-"): string {
  const base = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`^${separator}+|${separator}+$`, "g"), "")
    .slice(0, max)
    .replace(new RegExp(`${separator}+$`, "g"), "");
  return base;
}

/** An id that is valid and not used yet; `fallback` + a number when the text gives nothing usable. */
function uniqueId(
  raw: unknown,
  taken: Set<string>,
  max: number,
  fallback: string,
  separator = "-",
) {
  let id = slug(raw, max, separator) || fallback;
  if (taken.has(id)) {
    let n = 2;
    while (taken.has(`${id.slice(0, max - 3)}${separator}${n}`)) n += 1;
    id = `${id.slice(0, max - 3)}${separator}${n}`;
  }
  taken.add(id);
  return id;
}

const PHASE_ALIASES: Record<string, string> = {
  warmup: "warmup",
  "warm-up": "warmup",
  "warm up": "warmup",
  intro: "warmup",
  introduction: "warmup",
  teach: "teach",
  teaching: "teach",
  explain: "teach",
  presentation: "teach",
  practice: "practice",
  practise: "practice",
  practicing: "practice",
  check: "check",
  checking: "check",
  assess: "check",
  assessment: "check",
  review: "check",
  wrap: "wrap",
  "wrap-up": "wrap",
  "wrap up": "wrap",
  wrapup: "wrap",
  closing: "wrap",
  conclusion: "wrap",
};

function normalizeVocabulary(value: unknown) {
  const items = list(value, 30);
  if (!Array.isArray(items)) return value;
  return items.map((item) =>
    isObj(item)
      ? {
          ...item,
          word: cut(item.word, 80),
          meaning_ar: cut(item.meaning_ar, 120),
          example: cut(item.example, 200),
        }
      : item,
  );
}

/** The lesson plan the AI writes for Rita (objectives, phases, words). */
export function normalizeLessonDraftReply(raw: unknown): unknown {
  if (!isObj(raw)) return raw;
  const taken = new Set<string>();
  const objectives = list(raw.objectives, 6);
  const plan = isObj(raw.plan) ? raw.plan : null;
  const phases = plan ? list(plan.phases, 12) : null;
  const out: Obj = {
    ...raw,
    title: cut(raw.title, 160),
    title_ar: cut(raw.title_ar, 160),
    topic: cut(raw.topic, 160),
    summary: cut(raw.summary, 1_500),
    image_prompt: cut(raw.image_prompt, 400),
    source_from_page: whole(raw.source_from_page),
    source_to_page: whole(raw.source_to_page),
    vocabulary: normalizeVocabulary(raw.vocabulary),
  };
  if (Array.isArray(objectives)) {
    out.objectives = objectives.map((objective, index) => {
      if (!isObj(objective)) return objective;
      const prompts = Array.isArray(objective.check_prompts)
        ? objective.check_prompts
        : typeof objective.check_prompts === "string"
          ? [objective.check_prompts]
          : objective.check_prompts;
      return {
        ...objective,
        id: uniqueId(objective.id || objective.text, taken, 40, `objective-${index + 1}`),
        text: cut(objective.text, 240),
        text_ar: cut(objective.text_ar, 240),
        criteria: cut(objective.criteria || objective.text, 400),
        check_prompts: Array.isArray(prompts)
          ? prompts.slice(0, 4).map((prompt) => cut(prompt, 240))
          : prompts,
        weight: clampInt(objective.weight ?? 1, 1, 5),
      };
    });
  }
  if (plan && Array.isArray(phases)) {
    out.plan = {
      ...plan,
      phases: phases
        .map((phase) => {
          if (!isObj(phase)) return phase;
          const name =
            PHASE_ALIASES[
              String(phase.phase ?? "")
                .trim()
                .toLowerCase()
            ];
          if (!name) return null;
          const steps = Array.isArray(phase.steps)
            ? phase.steps.slice(0, 6).map((step) => cut(step, 240))
            : phase.steps;
          return { ...phase, phase: name, minutes: clampInt(phase.minutes, 1, 10), steps };
        })
        .filter((phase) => phase !== null)
        .slice(0, 6),
      teacher_notes: cut(plan.teacher_notes, 1_200),
    };
  }
  return out;
}

const ITEM_SOFT = [
  ["skill_tag", 60],
  ["instruction_ar", 120],
  ["spoken_prompt", 240],
  ["hint_ar", 240],
  ["hint_en", 240],
  ["explain_ar", 300],
  ["explain_en", 300],
] as const;

function normalizeItem(item: unknown, taken: Set<string>, index: number): unknown {
  if (!isObj(item)) return item;
  const out: Obj = {
    ...item,
    // The id is replaced by a neutral one when the lesson is saved, so only its shape matters.
    id: uniqueId(item.id, taken, 48, `item-${index + 1}`, "_"),
    source_page: whole(item.source_page),
  };
  for (const [field, max] of ITEM_SOFT) out[field] = cut(item[field], max);
  if (out.clue_ar !== undefined) out.clue_ar = cut(item.clue_ar, 120);
  return out;
}

/** The exercises the AI writes for one lesson (parts with an explanation and questions). */
export function normalizeLessonContentReply(raw: unknown): unknown {
  if (!isObj(raw)) return raw;
  const sections = list(raw.sections, 6);
  const itemIds = new Set<string>();
  const sectionIds = new Set<string>();
  const out: Obj = {
    ...raw,
    schema: 2,
    language:
      typeof raw.language === "string"
        ? raw.language.trim().toLowerCase().slice(0, 8)
        : raw.language,
    estimated_minutes: clampInt(raw.estimated_minutes ?? 12, 3, 40),
    intro_ar: cut(raw.intro_ar, 300),
    intro_en: cut(raw.intro_en, 300),
  };
  if (isObj(raw.wrap)) {
    out.wrap = {
      ...raw.wrap,
      summary_ar: cut(raw.wrap.summary_ar, 600),
      summary_en: cut(raw.wrap.summary_en, 600),
    };
  }
  if (!Array.isArray(sections)) return out;
  out.sections = sections.map((section, sectionIndex) => {
    if (!isObj(section)) return section;
    const explain = isObj(section.explain) ? section.explain : null;
    const items = (bank: unknown, max: number) => {
      const entries = list(bank, max);
      return Array.isArray(entries)
        ? entries.map((entry, index) => normalizeItem(entry, itemIds, index))
        : entries;
    };
    const mastery = isObj(section.mastery)
      ? {
          required: clampInt(section.mastery.required, 1, 10),
          min_correct: clampInt(section.mastery.min_correct, 1, 10),
        }
      : section.mastery;
    const pages = Array.isArray(section.source_pages)
      ? section.source_pages.slice(0, 20).map(whole)
      : section.source_pages;
    return {
      ...section,
      id: uniqueId(section.id, sectionIds, 48, `part-${sectionIndex + 1}`, "_"),
      title: cut(section.title, 120),
      title_ar: cut(section.title_ar, 120),
      source_pages: pages,
      explain: explain
        ? {
            ...explain,
            rule_ar: cut(explain.rule_ar, 600),
            rule_en: cut(explain.rule_en, 600),
            table: Array.isArray(explain.table)
              ? explain.table
                  .slice(0, 10)
                  .map((row) =>
                    isObj(row)
                      ? { ...row, left: cut(row.left, 60), right: cut(row.right, 60) }
                      : row,
                  )
              : explain.table,
            examples: Array.isArray(explain.examples)
              ? explain.examples
                  .slice(0, 6)
                  .map((row) =>
                    isObj(row)
                      ? { ...row, text: cut(row.text, 160), note_ar: cut(row.note_ar, 160) }
                      : row,
                  )
              : explain.examples,
          }
        : section.explain,
      guided: items(section.guided, 2),
      practice: items(section.practice, 20),
      remediation: items(section.remediation, 12),
      mastery,
    };
  });
  return out;
}
