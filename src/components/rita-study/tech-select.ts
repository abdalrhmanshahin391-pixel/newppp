// Fast, "electronic" text selection for the guide. The guide sits in a locked frame that runs no
// code; Safari also runs no listener inside such a frame, so all input is taken by a transparent
// layer of this page over the sheet (GuideFrame's `layer`), and the selection inside the frame is
// set from outside:
//   - Apple Pencil or a mouse: press on a word and drag; whole words join at once.
//   - A finger: hold a quarter of a second, then drag (a plain swipe still scrolls).
//   - Double tap or double click: the whole sentence. A single tap clears.
// Every selected word gets a thin glowing box, joined to the next one by a wire that runs through
// the gap between lines, and each new word makes a short arcade "ti".

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

function caretAt(doc: Document, x: number, y: number, scope: string): Caret | null {
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
  if (!(node.parentElement?.closest(scope) ?? null)) return null;
  if (node.parentElement?.closest("[aria-hidden='true'], input, textarea, select")) return null;
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

type SelectionFxOptions = { host?: HTMLElement; tone?: "guide" | "reply" };

function fxLayer(doc: Document, options: SelectionFxOptions): SVGSVGElement | null {
  if (!doc.body) return null;
  if (!doc.getElementById("st-fx-css")) {
    const style = doc.createElement("style");
    style.id = "st-fx-css";
    style.textContent = `
.st-selection-fx{--sel-stroke:#2b6df0;--sel-fill:rgba(43,109,240,.09);--sel-glow:rgba(61,139,255,.8);position:absolute;left:0;top:0;width:1px;height:1px;overflow:visible;pointer-events:none;z-index:5}
.st-selection-fx[data-tone=reply]{--sel-stroke:#8e1b2b;--sel-fill:rgba(142,27,43,.09);--sel-glow:rgba(142,27,43,.45);width:100%;height:100%;overflow:hidden}
.st-selection-fx .b{fill:var(--sel-fill);stroke:var(--sel-stroke);stroke-width:1.3;filter:drop-shadow(0 0 2.5px var(--sel-glow));transform-box:fill-box;transform-origin:center;animation:stfx-in 200ms cubic-bezier(.23,1,.32,1) backwards}
.st-selection-fx .l{fill:none;stroke:var(--sel-stroke);stroke-width:1;opacity:.9;stroke-dasharray:1;animation:stfx-draw 260ms ease-out backwards}
.st-selection-fx .n{fill:#fff;stroke:var(--sel-stroke);stroke-width:1.3;animation:stfx-pop 200ms ease-out backwards}
@keyframes stfx-in{from{opacity:0;transform:scale(1.4)}}
@keyframes stfx-draw{from{stroke-dashoffset:1}}
@keyframes stfx-pop{from{opacity:0}}
@media (prefers-reduced-motion:reduce){.st-selection-fx *{animation:none!important}}`;
    doc.head.appendChild(style);
  }
  const id = options.tone === "reply" ? "st-fx-reply" : "st-fx";
  let svg = doc.getElementById(id) as SVGSVGElement | null;
  if (!svg) {
    svg = doc.createElementNS(SVG, "svg") as SVGSVGElement;
    svg.id = id;
    svg.setAttribute("class", "st-selection-fx");
    svg.setAttribute("data-tone", options.tone ?? "guide");
    svg.setAttribute("aria-hidden", "true");
    (options.host ?? doc.body).appendChild(svg);
  }
  return svg;
}

/**
 * Draws (or clears) the glowing word boxes for a selection. Shapes that are already on screen are
 * kept, so only the new words animate in while the learner drags.
 */
export function drawSelectionFx(
  doc: Document | null,
  range: Range | null,
  options: SelectionFxOptions = {},
): void {
  if (!doc) return;
  const svg = fxLayer(doc, options);
  if (!svg) return;
  if (
    !range ||
    range.collapsed ||
    (options.host && !options.host.contains(range.commonAncestorContainer))
  ) {
    svg.replaceChildren();
    return;
  }
  const words = wordBoxes(doc, range);
  const hostBox = options.host?.getBoundingClientRect();
  const offsetX = hostBox ? hostBox.left + options.host!.clientLeft - options.host!.scrollLeft : 0;
  const offsetY = hostBox ? hostBox.top + options.host!.clientTop - options.host!.scrollTop : 0;
  // Clip to every scrolling ancestor of the answer: word boxes must not cover the composer
  // when the selected answer scrolls behind it.
  if (options.host && hostBox) {
    let top = hostBox.top,
      left = hostBox.left,
      right = hostBox.right,
      bottom = hostBox.bottom;
    for (
      let element = range.startContainer.parentElement;
      element && element !== options.host;
      element = element.parentElement
    ) {
      const style = doc.defaultView?.getComputedStyle(element);
      if (
        style &&
        /auto|scroll|hidden|clip/.test(style.overflow + style.overflowY + style.overflowX)
      ) {
        const box = element.getBoundingClientRect();
        top = Math.max(top, box.top);
        left = Math.max(left, box.left);
        right = Math.min(right, box.right);
        bottom = Math.min(bottom, box.bottom);
      }
    }
    svg.style.clipPath = `inset(${Math.max(0, top - hostBox.top)}px ${Math.max(0, hostBox.right - right)}px ${Math.max(0, hostBox.bottom - bottom)}px ${Math.max(0, left - hostBox.left)}px)`;
  }
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
      const x = r(box.left - offsetX - 2);
      const y = r(box.top - offsetY - 1);
      const w = r(box.width + 4);
      const h = r(box.height + 2);
      add(`b${x},${y},${w},${h}`, () => {
        const rect = doc.createElementNS(SVG, "rect");
        rect.setAttribute("class", "b");
        rect.setAttribute("x", String(x));
        rect.setAttribute("y", String(y));
        rect.setAttribute("width", String(w));
        rect.setAttribute("height", String(h));
        rect.setAttribute("rx", "2");
        rect.setAttribute("data-k", `b${x},${y},${w},${h}`);
        return rect;
      });
      // A line from this word back to the one before, with a node at each end, when they are
      // apart (another line of text, or a gap): the "circuit" that joins the whole selection.
      if (previous && index === 0) {
        const x1 = r(previous.right - offsetX + 2);
        const y1 = r(previous.top - offsetY + previous.height / 2);
        const x2 = r(box.left - offsetX - 2);
        const y2 = r(box.top - offsetY + box.height / 2);
        if (Math.abs(y2 - y1) > 2 || x2 - x1 > 14) {
          // Across lines the wire runs like a circuit trace through the gap between the lines,
          // never over the words: out to the right, down, back to the left, in to the next word.
          const gapY = r((previous.bottom + box.top) / 2 - offsetY);
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

/**
 * Takes pen, finger and mouse on `layer` (this page's element over the sheet) and selects text in
 * the frame's document. `toSheet` turns a screen point into the sheet's units. `onChange` hears
 * the finished selection (or null when it is cleared). Returns a function that stops it.
 */
export function attachTechSelect(options: {
  doc: Document;
  layer: HTMLElement;
  toSheet: (clientX: number, clientY: number) => { x: number; y: number };
  onChange: (range: Range | null) => void;
  /** Assistant answers use the same engine, bounded to a single answer and a different palette. */
  scope?: string;
  host?: HTMLElement;
  tone?: "guide" | "reply";
}): () => void {
  const { doc, layer, toSheet, onChange } = options;
  const scope = options.scope ?? ".sheet";
  const paint = (range: Range | null) => drawSelectionFx(doc, range, options);
  let pressed: {
    id: number;
    type: string;
    x: number;
    y: number;
    anchor: Word | null;
    dragging: boolean;
    timer: number;
    count: number;
    range: Range | null;
  } | null = null;
  const pointers = new Set<number>();
  let suppressClick: { x: number; y: number; until: number } | null = null;
  let lastTap = { at: 0, x: 0, y: 0 };

  const wordFrom = (clientX: number, clientY: number) => {
    const point = toSheet(clientX, clientY);
    const caret = caretAt(doc, point.x, point.y, scope);
    if (caret && options.host && !options.host.contains(caret.node)) return null;
    return caret ? { caret, word: wordAt(caret) } : null;
  };

  const update = (clientX: number, clientY: number) => {
    if (!pressed?.anchor) return;
    const focus = wordFrom(clientX, clientY)?.word;
    if (!focus) return;
    if (
      focus.node.parentElement?.closest(scope) !== pressed.anchor.node.parentElement?.closest(scope)
    )
      return;
    const range = doc.createRange();
    if (before(doc, focus, pressed.anchor)) {
      range.setStart(focus.node, focus.start);
      range.setEnd(pressed.anchor.node, pressed.anchor.end);
    } else {
      range.setStart(pressed.anchor.node, pressed.anchor.start);
      range.setEnd(focus.node, focus.end);
    }
    select(doc, range);
    pressed.range = range;
    const count = (range.toString().match(WORDS) ?? []).length;
    if (count !== pressed.count) blip();
    pressed.count = count;
    paint(range);
  };

  const begin = () => {
    if (!pressed?.anchor) return;
    pressed.dragging = true;
    pressed.count = 0;
    layer.setAttribute("data-tech-selecting", "");
    update(pressed.x, pressed.y);
  };

  const finish = (range: Range) => {
    chirp();
    onChange(range);
  };

  const onDown = (event: PointerEvent) => {
    pointers.add(event.pointerId);
    if (pointers.size > 1) {
      // A second finger: this is a pinch, not a selection.
      if (pressed) {
        window.clearTimeout(pressed.timer);
        if (pressed.dragging) {
          doc.getSelection()?.removeAllRanges();
          paint(null);
          onChange(null);
        }
      }
      pressed = null;
      layer.removeAttribute("data-tech-selecting");
      return;
    }
    if (event.button !== 0) return;
    const anchor = wordFrom(event.clientX, event.clientY)?.word ?? null;
    // Do not take over the composer, report buttons or other controls in the conversation pane.
    if (options.host && !anchor) return;
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
      range: null,
    };
    if (event.pointerType === "touch") {
      if (options.host && pressed.anchor) layer.setAttribute("data-tech-selecting", "");
      if (pressed.anchor) pressed.timer = window.setTimeout(begin, HOLD_MS);
      return;
    }
    if (event.pointerType === "mouse") event.preventDefault();
    // Pencil and mouse select from the first press: keep the moves even past the sheet's edge.
    try {
      layer.setPointerCapture(event.pointerId);
    } catch {
      /* not a live pointer (some browsers refuse); moves still arrive while over the sheet */
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
          layer.removeAttribute("data-tech-selecting");
        }
        return;
      }
      if (moved < 3 || !pressed.anchor) return;
      begin();
    }
    update(event.clientX, event.clientY);
  };

  const onUp = (event: PointerEvent) => {
    pointers.delete(event.pointerId);
    layer.removeAttribute("data-tech-selecting");
    if (!pressed || pressed.id !== event.pointerId) return;
    window.clearTimeout(pressed.timer);
    const was = pressed;
    pressed = null;
    if (was.dragging) {
      suppressClick = { x: event.clientX, y: event.clientY, until: performance.now() + 400 };
      if (was.range) finish(was.range);
      return;
    }
    // A tap: twice in a row on the same spot picks the sentence; once clears the selection.
    const now = performance.now();
    const again =
      now - lastTap.at < 350 &&
      Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 28;
    lastTap = { at: now, x: event.clientX, y: event.clientY };
    if (again) {
      const hit = wordFrom(event.clientX, event.clientY);
      const range = hit ? sentenceRange(doc, hit.caret) : null;
      if (range) {
        suppressClick = { x: event.clientX, y: event.clientY, until: performance.now() + 400 };
        select(doc, range);
        paint(range);
        finish(range);
        lastTap.at = 0;
        return;
      }
    }
    doc.getSelection()?.removeAllRanges();
    paint(null);
    onChange(null);
  };

  const onCancel = (event: PointerEvent) => {
    pointers.delete(event.pointerId);
    layer.removeAttribute("data-tech-selecting");
    if (pressed?.id === event.pointerId) {
      window.clearTimeout(pressed.timer);
      const was = pressed;
      pressed = null;
      if (was.dragging && was.range) {
        // A cancelled touch is not a completed selection and must not chirp.
        paint(null);
        doc.getSelection()?.removeAllRanges();
        onChange(null);
      }
    }
  };

  // A pencil never scrolls the page here (it selects); a finger only stops scrolling once it
  // is selecting.
  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0] as Touch & { touchType?: string };
    if (pressed?.anchor && event.touches.length === 1 && touch.touchType === "stylus")
      event.preventDefault();
  };
  const onTouchMove = (event: TouchEvent) => {
    if (pressed?.dragging) event.preventDefault();
  };
  const onClick = (event: MouseEvent) => {
    if (
      suppressClick &&
      performance.now() < suppressClick.until &&
      Math.hypot(event.clientX - suppressClick.x, event.clientY - suppressClick.y) < 12 &&
      (event.target as Element | null)?.closest(scope)
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  const onContextMenu = (event: MouseEvent) => {
    if (pressed?.dragging) event.preventDefault();
  };

  layer.addEventListener("pointerdown", onDown);
  layer.addEventListener("pointermove", onMove);
  layer.addEventListener("pointerup", onUp);
  layer.addEventListener("pointercancel", onCancel);
  layer.addEventListener("touchstart", onTouchStart, { passive: false });
  layer.addEventListener("touchmove", onTouchMove, { passive: false });
  layer.addEventListener("click", onClick, true);
  layer.addEventListener("contextmenu", onContextMenu);
  return () => {
    if (pressed) window.clearTimeout(pressed.timer);
    pressed = null;
    pointers.clear();
    layer.removeAttribute("data-tech-selecting");
    paint(null);
    layer.removeEventListener("pointerdown", onDown);
    layer.removeEventListener("pointermove", onMove);
    layer.removeEventListener("pointerup", onUp);
    layer.removeEventListener("pointercancel", onCancel);
    layer.removeEventListener("touchstart", onTouchStart);
    layer.removeEventListener("touchmove", onTouchMove);
    layer.removeEventListener("click", onClick, true);
    layer.removeEventListener("contextmenu", onContextMenu);
  };
}
