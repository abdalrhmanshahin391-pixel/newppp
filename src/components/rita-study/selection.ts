// Reads the learner's selection from the guide frame and shows it while the menu is open. The frame
// runs no script: this page reads its document from outside (same origin, sandboxed).
import { normalizeStudyText } from "@/lib/guides/guide-blocks";

export type PageSelection = {
  /** The named pieces (data-seg) the selection touches, in page order, at most 12. */
  segIds: string[];
  /** The selected text inside each of those pieces, in the same order. */
  parts: string[];
  /** What the learner selected, normalized the same way as on the server. */
  exact: string;
  range: Range;
  takenAt: number;
};

function overlapText(doc: Document, range: Range, element: Element): string {
  const piece = doc.createRange();
  piece.selectNodeContents(element);
  // The part of the selection inside this piece.
  if (range.compareBoundaryPoints(0 /* START_TO_START */, piece) > 0)
    piece.setStart(range.startContainer, range.startOffset);
  if (range.compareBoundaryPoints(2 /* END_TO_END */, piece) < 0)
    piece.setEnd(range.endContainer, range.endOffset);
  return piece.collapsed ? "" : piece.toString();
}

export function readSelection(doc: Document): PageSelection | null {
  const selection = doc.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const segIds: string[] = [];
  const parts: string[] = [];
  for (const element of doc.querySelectorAll("[data-seg]")) {
    if (!range.intersectsNode(element)) continue;
    const part = overlapText(doc, range, element);
    if (!part.trim()) continue;
    const id = element.getAttribute("data-seg");
    if (id && !segIds.includes(id)) {
      segIds.push(id);
      parts.push(part);
    }
    if (segIds.length > 12) break;
  }
  // Each piece's own text, joined with a space: table cells next to each other never run together
  // ("most verbs" + "add -s"), which a plain range text would do.
  const exact = normalizeStudyText(parts.length ? parts.join(" ") : range.toString());
  if (!exact) return null;
  return {
    segIds,
    parts: parts.map((part) => normalizeStudyText(part)),
    exact,
    range: range.cloneRange(),
    takenAt: Date.now(),
  };
}

type HighlightWindow = Window & {
  CSS?: { highlights?: Map<string, unknown> };
  Highlight?: new (...ranges: Range[]) => unknown;
};

/** Keeps the selected text visibly marked after the browser's own selection goes (iPhone taps). */
export function markSelection(win: Window | null, range: Range | null): void {
  const target = win as HighlightWindow | null;
  const highlights = target?.CSS?.highlights;
  if (!highlights) return;
  if (!range || !target?.Highlight) highlights.delete("st-sel");
  else highlights.set("st-sel", new target.Highlight(range));
}

/** The pieces of one section, for actions about the section in view. */
export function sectionSegIds(doc: Document | null, section: string): string[] {
  if (!doc) return [];
  const heading = doc.querySelector(`[data-seg="${section}.h"]`);
  return heading ? [`${section}.h`] : [];
}
