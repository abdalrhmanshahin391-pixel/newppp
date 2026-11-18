import { useLayoutEffect, useRef, useState } from "react";
import { anchorOffset, type BoardStep } from "@/lib/study/whiteboard";

type Row = BoardStep["rows"][number];
type Stroke = { kind: string; d: string };

export function AnnotatedQuote({ row }: { row: Row }) {
  const box = useRef<HTMLDivElement>(null);
  const quote = useRef<HTMLQuoteElement>(null);
  const [paths, setPaths] = useState<Stroke[]>([]);
  useLayoutEffect(() => {
    const el = box.current!;
    const node = quote.current!.firstChild;
    if (!node || !row.marks.length) {
      setPaths([]);
      return;
    }
    let active = true;
    function measure() {
      if (!active || !node) return;
      const origin = el.getBoundingClientRect();
      const rectangles = (anchor: { text: string; occurrence: number }) => {
        const i = anchorOffset(row.source, anchor);
        if (i < 0) return [];
        const range = document.createRange();
        range.setStart(node, i);
        range.setEnd(node, i + anchor.text.length);
        return Array.from(range.getClientRects())
          .filter((r) => r.width && r.height)
          .map((r) => ({
            x: r.left - origin.left,
            y: r.top - origin.top,
            w: r.width,
            h: r.height,
          }));
      };
      const strokes: Stroke[] = [];
      for (const mark of row.marks) {
        const targets = rectangles(mark.target);
        if (mark.kind === "arrow") {
          const a = rectangles(mark.from).at(-1),
            b = targets[0];
          if (!a || !b) continue;
          const x = a.x + a.w / 2,
            end = b.x + b.w / 2;
          const y = a.y + a.h + 4,
            tip = b.y + b.h + 4;
          const rail = 4;
          const middle = Math.abs(y - tip) < 3 ? "" : `H${rail} V${tip + 8}`;
          strokes.push({
            kind: mark.kind,
            d: `M${x} ${y} v8 ${middle} H${end} V${tip} m-3 4 3 -4 3 4`,
          });
        } else
          for (const r of targets) {
            const rx = r.w / 2 + 4,
              ry = r.h / 2 + 3;
            const d =
              mark.kind === "underline"
                ? `M${r.x} ${r.y + r.h + 1} q${r.w / 2} 1 ${r.w} 0`
                : `M${r.x - 4} ${r.y + r.h / 2} a${rx} ${ry} 0 1 1 ${2 * rx} 0 a${rx} ${ry} 0 1 1 ${-2 * rx} 0 Z`;
            strokes.push({ kind: mark.kind, d });
          }
      }
      setPaths(strokes);
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    document.fonts.addEventListener("loadingdone", measure);
    void document.fonts.ready.then(measure);
    return () => {
      active = false;
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", measure);
    };
  }, [row]);
  return (
    <div className="wb-quote" ref={box}>
      <q ref={quote} dir="auto">
        {row.source}
      </q>
      <svg aria-hidden="true" className="wb-marks">
        {paths.map((p, i) => (
          <path key={i} data-mark={p.kind} d={p.d} pathLength="1" />
        ))}
      </svg>
    </div>
  );
}
