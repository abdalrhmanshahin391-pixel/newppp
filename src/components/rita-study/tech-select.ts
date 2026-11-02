// Fast, "electronic" text selection for the guide frame. The frame runs no script, so this page
// drives it from outside (same origin):
//   - Apple Pencil or a mouse: press on a word and drag; whole words join the selection at once.
//   - A finger: hold a quarter of a second, then drag (a plain swipe still scrolls).
//   - Double tap or double click: the whole sentence.
// Every selected word gets a thin glowing box, joined to the next one by a line with small nodes,
// and each new word makes a short arcade "ti" (tech-sound.ts). The result is a normal browser
// selection, so the rest of the page (the circle, the menu, Rita) reads it as before.

import { blip, chirp, primeSound } from "./tech-sound";

type Caret = { node: Text; offset: number };
type Word = { node: Text; start: number; end: number };

const WORD_CHAR = /[\p{L}\p{N}'’-]/u;
const WORDS = /[\p{L}\p{N}'’-]+/gu;
const SENTENCE_END = /[.!?؟]/;
const HOLD_MS = 250;
const MOVE_PX = 8;
const MAX_FX_WORDS = 90;
const SVG = "http://www.w3.org/2000/svg";

function caretAt(doc: Document, x: number, y: number): Caret | null {
  const d = doc as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  let node: Node | null = null;
  let offset = 0;
  if (d.caretPositionFromPoint) {
    const pos = d.caretPositionFromPoint(x, y);
    if (pos) {
      node = pos.offsetNode;
      offset = pos.offset;
    }
  } else if (d.caretRangeFromPoint) {
    const range = d.caretRangeFromPoint(x, y);
    if (range) {
      node = range.startContainer;
      offset = range.startOffset;
    }
  }
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;
  if (!(node.parentElement?.closest(".sheet") ?? null)) return null;
  return { node: node as Text, offset };
}

/** The whole word around a caret (or null when the caret sits between words). */
function wordAt(caret: Caret): Word | null {
  const text = caret.node.data;
  let start = caret.offset;
  let end = caret.offset;
  while (start > 0 && WORD_CHAR.test(text[start - 1])) start -= 1;
  while (end < text.length && WORD_CHAR.test(text[end])) end += 1;
  if (start === end) {
    // Just after the last letter of a word: take that word.
    if (end < text.length && WORD_CHAR.test(text[end])) end += 1;
    else return null;
    while (end < text.length && WORD_CHAR.test(text[end])) end += 1;
  }
  return { node: caret.node, start, end };
}

/** True when word `a` comes before word `b` in the page. */
function before(doc: Document, a: Word, b: Word): boolean {
  const range = doc.createRange();
  range.setStart(a.node, a.start);
  return range.comparePoint(b.node, b.start) > 0;
}

function select(doc: Document, range: Range) {
  const selection = doc.getSelection();
  if (!selection) return;
  selection.removeAllRanges();
  selection.addRange(range);
}

/** The text nodes of an element with their offsets in its whole text. */
function textMap(element: Element): { node: Text; at: number }[] {
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const out: { node: Text; at: number }[] = [];
  let at = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    out.push({ node: node as Text, at });
    at += (node as Text).data.length;
  }
  return out;
}

function sentenceRange(doc: Document, caret: Caret): Range | null {
  const block =
    caret.node.parentElement?.closest("[data-seg]") ??
    caret.node.parentElement?.closest("p, li, td, th, h1, h2, h3");
  if (!block) return null;
  const map = textMap(block);
  const full = map.map((item) => item.node.data).join("");
  const here = map.find((item) => item.node === caret.node);
  if (!here) return null;
  const at = here.at + caret.offset;
  let start = at;
  while (start > 0 && !(SENTENCE_END.test(full[start - 1]) && /\s/.test(full[start] ?? " ")))
    start -= 1;
  let end = at;
  while (end < full.length && !SENTENCE_END.test(full[end])) end += 1;
  if (end < full.length) end += 1;
  while (start < end && /\s/.test(full[start])) start += 1;
  while (end > start && /\s/.test(full[end - 1])) end -= 1;
  if (start >= end) return null;
  const locate = (offset: number, isEnd: boolean) => {
    for (const item of map) {
      const length = item.node.data.length;
      if (offset < item.at + length || (isEnd && offset === item.at + length))
        return { node: item.node, offset: offset - item.at };
    }
    const last = map[map.length - 1];
    return { node: last.node, offset: last.node.data.length };
  };
  const from = locate(start, false);
  const to = locate(end, true);
  const range = doc.createRange();
  range.setStart(from.node, from.offset);
  range.setEnd(to.node, to.offset);
  return range;
}

/** Every word inside a range, with its boxes on screen (one per line it covers). */
function wordBoxes(doc: Document, range: Range): DOMRect[][] {
  const root =
    range.commonAncestorContainer.nodeType === Node.TEXT_NODE
      ? range.commonAncestorContainer.parentElement
      : (range.commonAncestorContainer as Element);
  if (!root) return [];
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const words: DOMRect[][] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    if (!range.intersectsNode(text)) continue;
    const from = text === range.startContainer ? range.startOffset : 0;
    const to = text === range.endContainer ? range.endOffset : text.data.length;
    const slice = text.data.slice(from, to);
    for (const match of slice.matchAll(WORDS)) {
      const piece = doc.createRange();
      piece.setStart(text, from + (match.index ?? 0));
      piece.setEnd(text, from + (match.index ?? 0) + match[0].length);
      const rects = [...piece.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
      if (rects.length) words.push(rects);
      if (words.length >= MAX_FX_WORDS) return words;
    }
  }
  return words;
}

function fxLayer(doc: Document): SVGSVGElement | null {
  if (!doc.body) return null;
  if (!doc.getElementById("st-fx-css")) {
    const style = doc.createElement("style");
    style.id = "st-fx-css";
    style.textContent = `
#st-fx{position:absolute;left:0;top:0;width:1px;height:1px;overflow:visible;pointer-events:none;z-index:5}
#st-fx .b{fill:rgba(43,109,240,.09);stroke:#2b6df0;stroke-width:1.3;filter:drop-shadow(0 0 2.5px rgba(61,139,255,.8));transform-box:fill-box;transform-origin:center;animation:stfx-in 200ms cubic-bezier(.23,1,.32,1) backwards}
#st-fx .l{fill:none;stroke:#3d8bff;stroke-width:1;opacity:.9;stroke-dasharray:1;animation:stfx-draw 260ms ease-out backwards}
#st-fx .n{fill:#fff;stroke:#2b6df0;stroke-width:1.3;animation:stfx-pop 200ms ease-out backwards}
@keyframes stfx-in{from{opacity:0;transform:scale(1.4)}}
@keyframes stfx-draw{from{stroke-dashoffset:1}}
@keyframes stfx-pop{from{opacity:0}}
@media (prefers-reduced-motion:reduce){#st-fx *{animation:none!important}}`;
    doc.head.appendChild(style);
  }
  let svg = doc.getElementById("st-fx") as SVGSVGElement | null;
  if (!svg) {
    svg = doc.createElementNS(SVG, "svg") as SVGSVGElement;
    svg.id = "st-fx";
    svg.setAttribute("aria-hidden", "true");
    doc.body.appendChild(svg);
  }
  return svg;
}

/**
 * Draws (or clears) the glowing word boxes for a selection. Shapes that are already on screen are
 * kept, so only the new words animate in while the learner drags.
 */
export function drawSelectionFx(doc: Document | null, range: Range | null): void {
  if (!doc) return;
  const svg = fxLayer(doc);
  if (!svg) return;
  if (!range || range.collapsed) {
    svg.replaceChildren();
    return;
  }
  const words = wordBoxes(doc, range);
  const keep = new Map<string, Element>();
  for (const child of [...svg.children]) keep.set(child.getAttribute("data-k") ?? "", child);
  const wanted = new Set<string>();
  const add = (key: string, make: () => Element) => {
    wanted.add(key);
    if (!keep.has(key)) svg.appendChild(make());
  };
  const r = (n: number) => Math.round(n * 10) / 10;
  let previous: DOMRect | null = null;
  words.forEach((rects) => {
    rects.forEach((box, index) => {
      const x = r(box.left - 2);
      const y = r(box.top - 1);
      const w = r(box.width + 4);
      const h = r(box.height + 2);
      add(`b${x},${y},${w}`, () => {
        const rect = doc.createElementNS(SVG, "rect");
        rect.setAttribute("class", "b");
        rect.setAttribute("x", String(x));
        rect.setAttribute("y", String(y));
        rect.setAttribute("width", String(w));
        rect.setAttribute("height", String(h));
        rect.setAttribute("rx", "2");
        rect.setAttribute("data-k", `b${x},${y},${w}`);
        return rect;
      });
      // A line from this word back to the one before, with a node at each end, when they are
      // apart (another line of text, or a gap): the "circuit" that joins the whole selection.
      if (previous && index === 0) {
        const x1 = r(previous.right + 2);
        const y1 = r(previous.top + previous.height / 2);
        const x2 = r(box.left - 2);
        const y2 = r(box.top + box.height / 2);
        if (Math.abs(y2 - y1) > 2 || x2 - x1 > 14) {
          // Across lines the wire runs like a circuit trace through the gap between the lines,
          // never over the words: out to the right, down, back to the left, in to the next word.
          const gapY = r((previous.bottom + box.top) / 2);
          const points =
            Math.abs(y2 - y1) > 2
              ? `${x1},${y1} ${x1 + 6},${y1} ${x1 + 6},${gapY} ${x2 - 6},${gapY} ${x2 - 6},${y2} ${x2},${y2}`
              : `${x1},${y1} ${x2},${y2}`;
          const key = `l${points}`;
          add(key, () => {
            const line = doc.createElementNS(SVG, "polyline");
            line.setAttribute("class", "l");
            line.setAttribute("points", points);
            line.setAttribute("pathLength", "1");
            line.setAttribute("data-k", key);
            return line;
          });
          for (const [cx, cy] of [
            [x1, y1],
            [x2, y2],
          ]) {
            add(`n${cx},${cy}`, () => {
              const dot = doc.createElementNS(SVG, "circle");
              dot.setAttribute("class", "n");
              dot.setAttribute("cx", String(cx));
              dot.setAttribute("cy", String(cy));
              dot.setAttribute("r", "2.2");
              dot.setAttribute("data-k", `n${cx},${cy}`);
              return dot;
            });
          }
        }
      }
      previous = box;
    });
  });
  for (const [key, element] of keep) if (!wanted.has(key)) element.remove();
}

/** Takes over pressing and dragging on the guide's text. Returns a function that stops it. */
export function attachTechSelect(doc: Document): () => void {
  let pressed: {
    id: number;
    type: string;
    x: number;
    y: number;
    anchor: Word | null;
    dragging: boolean;
    timer: number;
    count: number;
  } | null = null;
  let pointers = 0;
  let lastTap = { at: 0, x: 0, y: 0 };
  // The whole page: no long-press callout over the guide (our own hold replaces it).
  doc.documentElement.style.setProperty("-webkit-touch-callout", "none");

  const update = (x: number, y: number) => {
    if (!pressed?.anchor) return;
    const caret = caretAt(doc, x, y);
    const focus = caret ? wordAt(caret) : null;
    if (!focus) return;
    const range = doc.createRange();
    if (before(doc, focus, pressed.anchor)) {
      range.setStart(focus.node, focus.start);
      range.setEnd(pressed.anchor.node, pressed.anchor.end);
    } else {
      range.setStart(pressed.anchor.node, pressed.anchor.start);
      range.setEnd(focus.node, focus.end);
    }
    select(doc, range);
    const count = (range.toString().match(WORDS) ?? []).length;
    if (count !== pressed.count) blip();
    pressed.count = count;
    drawSelectionFx(doc, range);
  };

  const begin = () => {
    if (!pressed?.anchor) return;
    pressed.dragging = true;
    pressed.count = 0;
    update(pressed.x, pressed.y);
  };

  const onDown = (event: PointerEvent) => {
    pointers += 1;
    if (pointers > 1) {
      // A second finger: this is a pinch, not a selection.
      if (pressed) window.clearTimeout(pressed.timer);
      pressed = null;
      return;
    }
    if (event.button !== 0) return;
    const caret = caretAt(doc, event.clientX, event.clientY);
    const anchor = caret ? wordAt(caret) : null;
    primeSound();
    pressed = {
      id: event.pointerId,
      type: event.pointerType,
      x: event.clientX,
      y: event.clientY,
      anchor,
      dragging: false,
      timer: 0,
      count: 0,
    };
    if (event.pointerType === "touch") {
      if (anchor) pressed.timer = window.setTimeout(begin, HOLD_MS);
    } else {
      // Pencil and mouse: our selection, not the browser's.
      event.preventDefault();
    }
  };

  const onMove = (event: PointerEvent) => {
    if (!pressed || pressed.id !== event.pointerId) return;
    const moved = Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y);
    if (!pressed.dragging) {
      if (pressed.type === "touch") {
        // Moved before the hold: the finger is scrolling.
        if (moved > MOVE_PX) {
          window.clearTimeout(pressed.timer);
          pressed = null;
        }
        return;
      }
      if (moved < 4 || !pressed.anchor) return;
      begin();
    }
    update(event.clientX, event.clientY);
  };

  const onUp = (event: PointerEvent) => {
    pointers = Math.max(0, pointers - 1);
    if (!pressed || pressed.id !== event.pointerId) return;
    window.clearTimeout(pressed.timer);
    const was = pressed;
    pressed = null;
    if (was.dragging) {
      chirp();
      return;
    }
    // A tap: twice in a row on the same spot picks the sentence; once clears the selection.
    const now = performance.now();
    const again =
      now - lastTap.at < 320 &&
      Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 24;
    lastTap = { at: now, x: event.clientX, y: event.clientY };
    if (again) {
      const caret = caretAt(doc, event.clientX, event.clientY);
      const range = caret ? sentenceRange(doc, caret) : null;
      if (range) {
        select(doc, range);
        drawSelectionFx(doc, range);
        chirp();
        lastTap.at = 0;
        return;
      }
    }
    if (was.type !== "touch") doc.getSelection()?.removeAllRanges();
  };

  const onCancel = (event: PointerEvent) => {
    pointers = Math.max(0, pointers - 1);
    if (pressed?.id === event.pointerId) {
      window.clearTimeout(pressed.timer);
      pressed = null;
    }
  };

  // While selecting, the finger or pencil must not scroll the page.
  const onTouchMove = (event: TouchEvent) => {
    if (pressed?.dragging) event.preventDefault();
  };
  // The browser's own mouse selection would fight ours.
  const onMouseDown = (event: MouseEvent) => {
    if (pressed && pressed.type === "mouse") event.preventDefault();
  };

  doc.addEventListener("pointerdown", onDown);
  doc.addEventListener("pointermove", onMove);
  doc.addEventListener("pointerup", onUp);
  doc.addEventListener("pointercancel", onCancel);
  doc.addEventListener("touchmove", onTouchMove, { passive: false });
  doc.addEventListener("mousedown", onMouseDown);
  return () => {
    doc.removeEventListener("pointerdown", onDown);
    doc.removeEventListener("pointermove", onMove);
    doc.removeEventListener("pointerup", onUp);
    doc.removeEventListener("pointercancel", onCancel);
    doc.removeEventListener("touchmove", onTouchMove);
    doc.removeEventListener("mousedown", onMouseDown);
  };
}
