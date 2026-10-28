// The server's check of a learner's selection, and the trusted context Rita gets for it. Pure.
// The browser sends which named pieces were selected (data-seg) and the text it saw. The text must
// really be in those pieces of the guide, or the request is refused: a selection can never carry
// new instructions to Rita. Rita then reads the guide's own text, never the browser's.
import { guideSegments, normalizeStudyText, type GuideSegment } from "../guides/guide-blocks.ts";
import type { GuideContent } from "../guides/guide-content.ts";
import { classifySelection, type SelectionKind, type StudyAction } from "./study-actions.ts";
import { MAX_SELECTION_CHARS } from "./study-limits.ts";

export const MAX_SELECTED_SEGMENTS = 12;
export const MAX_CONTEXT_CHARS = 2400;

export type SelectionInput = {
  segIds: string[];
  exact: string;
  /** What was selected inside each piece, in the same order as segIds (lets a word be cut). */
  parts?: string[];
};

export type ResolvedSelection = {
  ok: true;
  quote: string;
  kind: SelectionKind;
  segments: GuideSegment[];
  blockIds: string[];
  section: string | null;
  context: string;
};

export type SelectionRefusal = {
  ok: false;
  code: "empty" | "unknown_piece" | "selection_mismatch" | "too_long";
};

function tokens(text: string): string[] {
  return normalizeStudyText(text)
    .toLowerCase()
    .split(/[^\p{L}\p{N}'’+-]+/u)
    .filter(Boolean);
}

/** Every word of the selection must be in the named pieces; one piece must contain it whole. */
export function selectionMatches(
  exact: string,
  segments: GuideSegment[],
  parts?: Map<string, string>,
): boolean {
  const quote = normalizeStudyText(exact);
  if (!quote || !segments.length) return false;
  if (segments.length === 1) return segments[0].text.includes(quote);
  if (parts && segments.every((segment) => parts.has(segment.seg))) {
    // Each piece's part must be inside that piece, and together they must be the quote.
    const pieces = segments.map((segment) => normalizeStudyText(parts.get(segment.seg) ?? ""));
    return (
      pieces.every((piece, index) => Boolean(piece) && segments[index].text.includes(piece)) &&
      normalizeStudyText(pieces.join(" ")) === quote
    );
  }
  const known = new Set(segments.flatMap((segment) => tokens(segment.text)));
  return tokens(quote).every((token) => known.has(token));
}

function blockText(all: GuideSegment[], block: string): string {
  return all
    .filter((segment) => segment.block === block)
    .map((segment) => segment.text)
    .join(" | ");
}

/** The pieces around the selection: its whole row or item, the one before and after, the heading. */
export function buildStudyContext(
  content: GuideContent,
  all: GuideSegment[],
  chosen: GuideSegment[],
  action: StudyAction,
  objectives: string[],
): string {
  const lines: string[] = [`Guide: ${normalizeStudyText(content.title)}`];
  const section = chosen.find((segment) => segment.section)?.section ?? null;
  if (section) {
    const heading = all.find((segment) => segment.seg === `${section}.h`)?.text;
    if (heading) lines.push(`Section: ${heading}`);
  }
  if (action === "summarize_section" && section) {
    const blocks = [...new Set(all.filter((s) => s.section === section).map((s) => s.block))];
    lines.push(...blocks.map((block) => `- ${blockText(all, block)}`));
  } else {
    for (const segment of chosen) lines.push(`Selected (${segment.role}): ${segment.text}`);
    const blocks = [...new Set(chosen.map((segment) => segment.block))];
    const order = [...new Set(all.map((segment) => segment.block))];
    for (const block of blocks) {
      const whole = blockText(all, block);
      if (!chosen.some((segment) => segment.text === whole))
        lines.push(`Whole row or item: ${whole}`);
    }
    const first = order.indexOf(blocks[0]);
    const last = order.indexOf(blocks[blocks.length - 1]);
    const before = order[first - 1];
    const after = order[last + 1];
    const sameSection = (block: string | undefined) =>
      block && all.find((segment) => segment.block === block)?.section === section;
    if (sameSection(before)) lines.push(`Before: ${blockText(all, before as string)}`);
    if (sameSection(after)) lines.push(`After: ${blockText(all, after as string)}`);
  }
  const terms = [...new Set(chosen.flatMap((segment) => segment.terms))];
  if (terms.length) lines.push(`Taught terms: ${terms.join(", ")}`);
  const note = all.find((segment) => segment.seg === "a")?.text;
  if (note && action === "compare_arabic") lines.push(`Arabic note in the guide: ${note}`);
  if (objectives.length) lines.push(`Lesson goals: ${objectives.slice(0, 6).join("; ")}`);
  return lines.join("\n").slice(0, MAX_CONTEXT_CHARS);
}

export function resolveSelection(
  content: GuideContent,
  input: SelectionInput,
  action: StudyAction,
  objectives: string[] = [],
): ResolvedSelection | SelectionRefusal {
  const all = guideSegments(content);
  const byId = new Map(all.map((segment) => [segment.seg, segment]));
  const ids = [...new Set(input.segIds)];
  if (!ids.length) return { ok: false, code: "empty" };
  if (ids.length > MAX_SELECTED_SEGMENTS) return { ok: false, code: "too_long" };
  const chosen: GuideSegment[] = [];
  for (const id of ids) {
    const segment = byId.get(id);
    if (!segment) return { ok: false, code: "unknown_piece" };
    chosen.push(segment);
  }
  // Keep the page order whatever order the browser sent.
  chosen.sort((a, b) => all.indexOf(a) - all.indexOf(b));
  const quote = normalizeStudyText(input.exact);
  if (quote.length > MAX_SELECTION_CHARS) return { ok: false, code: "too_long" };
  if (action === "summarize_section") {
    // A whole section is asked for by naming its heading: no text to match.
    const section = chosen[0].section;
    if (!section) return { ok: false, code: "unknown_piece" };
    return {
      ok: true,
      quote: chosen[0].text,
      kind: "rule",
      segments: chosen,
      blockIds: [chosen[0].block],
      section,
      context: buildStudyContext(content, all, chosen, action, objectives),
    };
  }
  if (!quote) return { ok: false, code: "empty" };
  const parts =
    input.parts && input.parts.length === input.segIds.length
      ? new Map(input.segIds.map((id, index) => [id, input.parts?.[index] ?? ""]))
      : undefined;
  if (!selectionMatches(quote, chosen, parts)) return { ok: false, code: "selection_mismatch" };
  const kind = classifySelection({ exact: quote, segments: chosen });
  if (kind === "too_long" || kind === "non_text")
    return { ok: false, code: kind === "too_long" ? "too_long" : "empty" };
  return {
    ok: true,
    quote,
    kind,
    segments: chosen,
    blockIds: [...new Set(chosen.map((segment) => segment.block))],
    section: chosen.find((segment) => segment.section)?.section ?? null,
    context: buildStudyContext(content, all, chosen, action, objectives),
  };
}

export const REFUSAL_TEXT: Record<SelectionRefusal["code"], string> = {
  empty: "حدّد كلام من الدرس.",
  unknown_piece: "ما لقيت هالجزء بالدرس. حدّده مرة ثانية.",
  selection_mismatch: "التحديد ما طابق نص الدرس. حدّده مرة ثانية.",
  too_long: "التحديد كبير. حدّد جزء أصغر.",
};
