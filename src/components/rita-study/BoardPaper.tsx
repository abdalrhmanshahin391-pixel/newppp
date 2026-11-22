import { useId, useLayoutEffect, useMemo, useRef } from "react";
import type { BoardCommand, BoardStep } from "@/lib/study/whiteboard";
import { strokesFor } from "./pen-strokes";

import { layoutBoard } from "./board-layout";

const colors = { ink: "#273650", indigo: "#6447aa", teal: "#18776f", coral: "#b14c40" };
type Segment = {
  path: string;
  x: number;
  y: number;
  scale: number;
  color: string;
  label?: string;
  width?: number;
  rtl?: boolean;
};
function segments(command: BoardCommand, layout: ReturnType<typeof layoutBoard>): Segment[] {
  const [x, y] = command.at;
  const base = { x: 0, y: 0, scale: 1, color: colors[command.ink] };
  if (command.op === "write") {
    const letters = Array.from(command.text);
    const glyphs = letters.map(strokesFor);
    const { x: left, y: top, w: width } = layout.labels.get(command)!.box;
    const rtl = /[\u0600-\u06ff]/.test(command.text);
    const outline: Segment[] = command.circled
      ? [
          {
            ...base,
            x: left,
            y: top,
            color: colors.coral,
            path: `M0 -5 H${width} C${width + 15} -5 ${width + 15} 37 ${width} 37 H0 C-15 37 -15 -5 0 -5 Z`,
          },
        ]
      : [];
    if (glyphs.some((g) => !g) || width / letters.length < 7) {
      // Keep joined Arabic words and bidi runs shaped by the browser as ink appears from the right.

      return [
        {
          ...base,
          x: left,
          y: top,
          path: rtl ? `M${width} 22 H0` : `M0 22 H${width}`,
          label: command.text,
          width,
          rtl,
        },
        ...outline,
      ];
    }
    const scale = Math.min(1.65, width / (letters.length * 12));
    return [
      ...glyphs.flatMap((parts, i) =>
        (parts ?? []).map((path) => ({ ...base, path, x: left + i * 12 * scale, y: top, scale })),
      ),
      ...outline,
    ];
  }
  if (command.op === "path")
    return [
      { ...base, path: `M${x} ${y} ` + command.points.map((p) => "L" + p.join(" ")).join(" ") },
    ];
  const [ex, ey] = command.to;
  if (command.op === "ellipse") {
    const rx = Math.abs(ex - x) / 2,
      ry = Math.abs(ey - y) / 2,
      cy = (ey + y) / 2;
    return [
      { ...base, path: `M${x} ${cy} A${rx} ${ry} 0 1 1 ${ex} ${cy} A${rx} ${ry} 0 1 1 ${x} ${cy}` },
    ];
  }
  const line = { ...base, path: `M${x} ${y} L${ex} ${ey}` };
  if (command.op === "line") {
    const owner = layout.underlines.get(command);
    if (owner) line.path = `M${x} ${owner.y + owner.h + 3} H${ex}`;
    return [line];
  }
  const points = layout.arrow(command.at, command.to);
  if (points.length < 2) return [];
  const [tipX, tipY] = points[points.length - 1],
    [lastX, lastY] = points[points.length - 2];
  const angle = Math.atan2(tipY - lastY, tipX - lastX);
  line.path = points.map((p, i) => (i ? "L" : "M") + p.join(" ")).join(" ");
  const wing = (a: number) => [tipX - 7 * Math.cos(a), tipY - 7 * Math.sin(a)].join(" ");
  return [
    line,
    { ...base, path: `M${wing(angle - 0.48)} L${tipX} ${tipY} L${wing(angle + 0.48)}` },
  ];
}

// The pen and ink use one clock. When audio plays this clock follows its playback position.
export function BoardPaper({
  step,
  clock,
  playing,
  visibleCommands = 0,
  onInk,
}: {
  step: BoardStep;
  clock: () => number;
  playing: boolean;
  visibleCommands?: number;
  onInk?: () => void;
}) {
  const id = useId().replace(/:/g, "");
  const svg = useRef<SVGSVGElement>(null);
  const layout = useMemo(() => layoutBoard(step.commands), [step]);
  const lines = useMemo(
    () =>
      step.commands.flatMap((c, commandIndex) =>
        segments(c, layout).map((line) => ({ ...line, commandIndex })),
      ),
    [step, layout],
  );
  useLayoutEffect(() => {
    const paper = svg.current!;
    const pen = paper.querySelector<SVGGElement>("[data-nib]")!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let end = 0;
    let previousEnd = { x: 25, y: 35 };
    const paths = Array.from(paper.querySelectorAll<SVGPathElement>("[data-line]")).map((el, i) => {
      const line = lines[i],
        length = el.getTotalLength(),
        start = end;
      end += Math.max(3, length * line.scale) + 6;
      const from = previousEnd;
      const lastPoint = el.getPointAtLength(length);
      previousEnd = { x: line.x + lastPoint.x * line.scale, y: line.y + lastPoint.y * line.scale };
      return {
        from,
        el,
        line,
        length,
        start,
        finish: end,
        clip: paper.querySelector<SVGRectElement>(`[data-mask="${i}"]`),
        last: -1,
      };
    });
    const firstNewPath = paths.find((path) => path.line.commandIndex >= visibleCommands);
    const alreadyDrawn = firstNewPath?.start ?? end;
    let sawInk = false;
    let raf = 0;
    let previous = { x: 25, y: 35 };
    const draw = () => {
      const progress = reduced.matches ? 1 : clock();
      const position = alreadyDrawn + progress * (end - alreadyDrawn);
      previous = { x: 25, y: 35 };
      for (const s of paths) {
        const fraction = Math.max(
          0,
          Math.min(1, (position - s.start - 6) / (s.finish - s.start - 6)),
        );
        const { x, y, scale, width, rtl } = s.line;
        if (onInk && !sawInk && fraction > 0) {
          sawInk = true;
          onInk();
        }
        if (s.last !== fraction) {
          if (s.clip && width) {
            s.clip.setAttribute("width", String(fraction * width));
            s.clip.setAttribute("x", String(rtl ? width * (1 - fraction) : 0));
          } else {
            s.el.style.strokeDasharray = String(s.length + 1);
            s.el.style.strokeDashoffset = String((1 - fraction) * (s.length + 1));
            s.el.style.opacity = fraction > 0 ? "1" : "0";
          }
          s.last = fraction;
        }
        if (position >= s.start && position < s.finish) {
          const pt = s.el.getPointAtLength(s.length * fraction);
          const travel = Math.max(0, Math.min(1, (position - s.start) / 6));
          previous = {
            x: s.from.x + (x + pt.x * scale - s.from.x) * travel,
            y: s.from.y + (y + pt.y * scale - s.from.y) * travel,
          };
        }
      }
      pen.setAttribute("transform", `translate(${previous.x} ${previous.y})`);
      pen.style.opacity = position >= end ? "0" : "1";
      if (playing && progress < 1) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [clock, lines, playing, visibleCommands, onInk]);
  return (
    <svg
      className="wb-drawing"
      ref={svg}
      viewBox={`-12 -12 624 ${layout.height + 24}`}
      role="img"
      aria-label={[
        step.title,
        ...step.commands.flatMap((c) => (c.op === "write" ? [c.text] : [])),
      ].join(" · ")}
      direction="ltr"
    >
      {lines.map((s, i) => (
        <g key={i} transform={`translate(${s.x} ${s.y}) scale(${s.scale})`}>
          {s.label && (
            <>
              <defs>
                <clipPath id={id + "mask" + i}>
                  <rect data-mask={i} y="-8" height="54" width="0" />
                </clipPath>
              </defs>
              <text
                clipPath={`url(#${id}mask${i})`}
                x={s.rtl ? s.width : 0}
                y="25"
                direction={s.rtl ? "rtl" : "ltr"}
                fill={s.color}
                fontSize="25"
                fontWeight="600"
                textLength={s.width}
                lengthAdjust="spacingAndGlyphs"
              >
                {s.label}
              </text>
            </>
          )}
          <path
            data-line={i}
            d={s.path}
            fill="none"
            stroke={s.label ? "none" : s.color}
            strokeWidth={s.scale === 1 ? 2.7 : 1.65}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={s.label ? 0 : undefined}
          />
        </g>
      ))}
      <g data-nib="" aria-hidden="true" pointerEvents="none">
        <g transform="rotate(36)">
          <path
            d="M0 0 -3 -8 -3 -29 Q0 -33 3 -29 L3 -8Z"
            fill="#f3be67"
            stroke="#483e38"
            strokeWidth="1.2"
          />
          <path d="M-3 -8 H3 L0 0Z" fill="#f6dec2" />
          <path d="M-1.2 -3.5 H1.2 L0 0Z" fill="#302e35" />
          <path d="M-2.5 -25 H2.5" stroke="#805b3a" />
        </g>
      </g>
    </svg>
  );
}
