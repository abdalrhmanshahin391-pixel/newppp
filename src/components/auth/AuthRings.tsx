import { useMemo } from "react";

/**
 * Nine thin, uneven rings around a soft light, each turning slowly at its own pace, so together they
 * seem to breathe and change shape. Pure SVG and CSS transforms: nothing to download, and with
 * reduced motion they simply stand still.
 */
const RINGS = 9;

function ringPath(index: number): string {
  // A fixed, seeded wobble per ring so the picture is the same on the server and in the browser.
  const base = 118 + index * 9;
  const a = 0.06 + (index % 3) * 0.018;
  const b = 0.035 + ((index * 7) % 4) * 0.01;
  const p1 = index * 1.7;
  const p2 = index * 0.9 + 1.3;
  const points: string[] = [];
  const steps = 120;
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * Math.PI * 2;
    const r = base * (1 + a * Math.sin(3 * t + p1) + b * Math.sin(5 * t + p2));
    points.push(`${(Math.cos(t) * r).toFixed(1)},${(Math.sin(t) * r).toFixed(1)}`);
  }
  return `M${points.join("L")}Z`;
}

export function AuthRings({ className = "" }: { className?: string }) {
  const paths = useMemo(() => Array.from({ length: RINGS }, (_, i) => ringPath(i)), []);
  return (
    <svg viewBox="-260 -260 520 520" className={`uz-rings ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id="uz-ring-ink" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7fb2ff" />
          <stop offset="55%" stopColor="#2b6df0" />
          <stop offset="100%" stopColor="#9b7cf2" />
        </linearGradient>
        <radialGradient id="uz-ring-core">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#dbe8ff" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#dbe8ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle r="150" fill="url(#uz-ring-core)" className="uz-rings-core" />
      {paths.map((d, i) => (
        <g key={i} className="uz-ring" style={{ ["--i" as string]: i }}>
          <path d={d} fill="none" stroke="url(#uz-ring-ink)" strokeWidth="1.1" />
        </g>
      ))}
    </svg>
  );
}
