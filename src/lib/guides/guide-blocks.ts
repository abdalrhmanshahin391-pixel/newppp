// Stable names for every piece of text in a guide, so a learner's selection, a mark or a card can say
// exactly where it came from. The names come from the position in the guide's data, and a guide row
// never changes once it is ready (a rewrite is a new row), so a name always means the same text.
// The page template puts the same names on the page (data-block / data-seg); a test keeps the two in
// step. Pure: used by the page template, the server and node tests.
//   t title · i intro · s2.h heading of section 2 · s2.hd.c1 first column label
//   s2.r3 row 3 · s2.r3.c1 its first cell · s2.r3.l a matrix row label
//   s2.i1 item 1 (usage or rules) · s2.i1.l usage label · s2.i1.x usage example
//   s2.i1.r the rule · s2.i1.e2 its second example · c callout · a Arabic note
import { plainText, type GuideContent } from "./guide-content.ts";

export type SegmentRole =
  | "title"
  | "intro"
  | "heading"
  | "label"
  | "cell"
  | "rowlabel"
  | "example"
  | "rule"
  | "callout"
  | "arabic";

export type GuideSegment = {
  /** The smallest named piece: one cell, one example, the title. */
  seg: string;
  /** The piece it belongs to: a row, an item, a heading. */
  block: string;
  /** "s2", or null for the title, intro, callout and Arabic note. */
  section: string | null;
  role: SegmentRole;
  /** The text a reader sees, without markup, normalized (see normalizeStudyText). */
  text: string;
  /** Terms the guide marks as taught ([[term]]) inside this piece. */
  terms: string[];
  lang: "ar" | "target";
};

/** The one normalization the page and the server share: Unicode NFC and single spaces. */
export function normalizeStudyText(value: string): string {
  return value.normalize("NFC").replace(/\s+/g, " ").trim();
}

function termsOf(markup: string): string[] {
  const found: string[] = [];
  const pattern = /\[\[([^\]]+)\]\]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markup))) {
    const term = normalizeStudyText(plainText(match[1]));
    if (term && !found.includes(term)) found.push(term);
  }
  return found;
}

export function sectionId(index: number): string {
  return `s${index + 1}`;
}

/** Every named piece of the guide, in the order it appears on the page. */
export function guideSegments(content: GuideContent): GuideSegment[] {
  const out: GuideSegment[] = [];
  const add = (
    seg: string,
    block: string,
    section: string | null,
    role: SegmentRole,
    markup: string,
    lang: GuideSegment["lang"] = "target",
  ) => {
    const text = normalizeStudyText(plainText(markup));
    if (!text) return;
    out.push({ seg, block, section, role, text, terms: termsOf(markup), lang });
  };

  add("t", "t", null, "title", content.title);
  add("i", "i", null, "intro", content.intro);
  content.sections.forEach((section, index) => {
    const s = sectionId(index);
    add(`${s}.h`, `${s}.h`, s, "heading", section.heading);
    if (section.kind === "table") {
      section.columns.forEach((column, c) =>
        add(`${s}.hd.c${c + 1}`, `${s}.hd`, s, "label", column.label),
      );
      section.rows.forEach((row, r) =>
        row.forEach((cell, c) =>
          add(
            `${s}.r${r + 1}.c${c + 1}`,
            `${s}.r${r + 1}`,
            s,
            section.row_headers && c === 0 ? "rowlabel" : "cell",
            cell,
          ),
        ),
      );
    } else if (section.kind === "matrix") {
      section.columns.forEach((column, c) =>
        add(`${s}.hd.c${c + 1}`, `${s}.hd`, s, "label", column),
      );
      section.rows.forEach((row, r) => {
        add(`${s}.r${r + 1}.l`, `${s}.r${r + 1}`, s, "rowlabel", row.label);
        row.cells.forEach((cell, c) =>
          add(`${s}.r${r + 1}.c${c + 1}`, `${s}.r${r + 1}`, s, "cell", cell),
        );
      });
    } else if (section.kind === "usage") {
      section.items.forEach((item, n) => {
        if (item.label) add(`${s}.i${n + 1}.l`, `${s}.i${n + 1}`, s, "label", item.label);
        add(`${s}.i${n + 1}.x`, `${s}.i${n + 1}`, s, "example", item.example);
      });
    } else {
      section.items.forEach((item, n) => {
        add(`${s}.i${n + 1}.r`, `${s}.i${n + 1}`, s, "rule", item.rule);
        item.examples.forEach((example, m) =>
          add(`${s}.i${n + 1}.e${m + 1}`, `${s}.i${n + 1}`, s, "example", example),
        );
      });
    }
  });
  add("c", "c", null, "callout", content.callout);
  add("a", "a", null, "arabic", content.arabic_note, "ar");
  return out;
}

/** The pieces by name, for quick checks on the server. */
export function guideSegmentMap(content: GuideContent): Map<string, GuideSegment> {
  return new Map(guideSegments(content).map((segment) => [segment.seg, segment]));
}

/** A short outline for Rita: headings and taught terms, never the whole text. */
export function guideOutline(content: GuideContent): {
  title: string;
  sections: { id: string; heading: string; terms: string[] }[];
} {
  const segments = guideSegments(content);
  return {
    title: normalizeStudyText(plainText(content.title)),
    sections: content.sections.map((section, index) => {
      const id = sectionId(index);
      const terms = new Set<string>();
      for (const segment of segments)
        if (segment.section === id) for (const term of segment.terms) terms.add(term);
      return { id, heading: normalizeStudyText(section.heading), terms: [...terms].slice(0, 12) };
    }),
  };
}
