// A selection in Rita's own answers (the left column). Only the text of one answer counts (each is
// marked data-reply-text); the learner's words, buttons and the report link do not. The selected
// text and the answer are read the same way (every text piece joined with a space), so the server
// can check that the one is inside the other.

export type ReplySelection = {
  /** What the learner selected, spaces folded. */
  exact: string;
  /** The whole answer it comes from, read the same way. */
  reply: string;
  range: Range;
  takenAt: number;
};

export type ReplySelectionRead = ReplySelection | { problem: string } | null;

const ANSWER = "[data-reply-text]";

function answerOf(node: Node | null): Element | null {
  const element = node instanceof Element ? node : (node?.parentElement ?? null);
  return element?.closest(ANSWER) ?? null;
}

/** The text of the part of `scope` inside `range` (all of it without a range). */
function textIn(scope: Element, range: Range | null): string {
  const doc = scope.ownerDocument;
  const walker = doc.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  const pieces: string[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    if (text.parentElement?.closest("[aria-hidden='true']")) continue;
    if (!range) {
      pieces.push(text.data);
      continue;
    }
    if (!range.intersectsNode(text)) continue;
    let from = 0;
    let to = text.data.length;
    if (text === range.startContainer) from = range.startOffset;
    if (text === range.endContainer) to = range.endOffset;
    pieces.push(text.data.slice(from, to));
  }
  return pieces.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * The selection when it is in Rita's answers inside `root`; a problem when it is there but not
 * usable (two answers, or the learner's own words with it); null when it is not in `root`.
 */
export function readReplySelection(root: Element): ReplySelectionRead {
  const selection = root.ownerDocument.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const start = answerOf(range.startContainer);
  const end = answerOf(range.endContainer);
  if (!start || start !== end) return { problem: "حدّد من رد واحد لريتا." };
  const exact = textIn(start, range);
  if (!exact) return null;
  return {
    exact,
    reply: textIn(start, null),
    range: range.cloneRange(),
    takenAt: Date.now(),
  };
}

type HighlightWindow = Window & {
  CSS?: { highlights?: Map<string, unknown> };
  Highlight?: new (...ranges: Range[]) => unknown;
};

/** Keeps the selected part of Rita's answer marked in dark red after the browser's selection goes. */
export function markReplySelection(range: Range | null): void {
  const target = (typeof window === "undefined" ? null : window) as HighlightWindow | null;
  const highlights = target?.CSS?.highlights;
  if (!highlights) return;
  if (!range || !target?.Highlight) highlights.delete("st-sel-reply");
  else highlights.set("st-sel-reply", new target.Highlight(range));
}
