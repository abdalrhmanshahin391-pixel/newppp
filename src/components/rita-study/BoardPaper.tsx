import { useLayoutEffect, useRef } from "react";
import { AnnotatedQuote } from "./AnnotatedQuote";
import type { BoardStep } from "@/lib/study/whiteboard";

export function BoardPaper({
  step,
  clock,
  playing,
}: {
  step: BoardStep;
  clock: () => number;
  playing: boolean;
}) {
  const board = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const rows = Array.from(board.current!.children) as HTMLElement[];
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const draw = () => {
      const progress = reduced.matches ? 1 : clock();
      rows.forEach((row, i) => {
        const amount = Math.max(0, Math.min(1, progress * rows.length - i));
        row.style.setProperty("--ink", String(amount));
      });
      if (playing && progress < 1) frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [step, clock, playing]);
  return (
    <div className="wb-relations" ref={board}>
      {step.rows.map((row, i) => (
        <div className="wb-relation" key={i}>
          <AnnotatedQuote row={row} />
          <span dir="auto">{row.explanation}</span>
        </div>
      ))}
      {step.example && (
        <div className="wb-relation">
          <strong>مثال إضافي</strong>
          <span dir="auto">{step.example}</span>
        </div>
      )}
    </div>
  );
}
