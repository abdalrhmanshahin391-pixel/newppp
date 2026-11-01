/**
 * Thin, uneven black rings around a soft grey light, each turning slowly at its own pace. Black and
 * white only. Pure SVG and CSS transforms; with reduced motion they stand still.
 */
const RINGS = 9;

function ringPath(index: number): string {
  // A fixed, seeded wobble per ring so the picture is the same on every render.
  const base = 120 + index * 11;
  const a = 0.07 + (index % 3) * 0.02;
  const b = 0.04 + ((index * 7) % 4) * 0.012;
  const p1 = index * 1.7;
  const p2 = index * 0.9 + 1.3;
  const points: string[] = [];
  const steps = 140;
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * Math.PI * 2;
    const r = base * (1 + a * Math.sin(3 * t + p1) + b * Math.sin(5 * t + p2));
    points.push(`${(Math.cos(t) * r).toFixed(1)},${(Math.sin(t) * r).toFixed(1)}`);
  }
  return `M${points.join("L")}Z`;
}

const PATHS = Array.from({ length: RINGS }, (_, i) => ringPath(i));

export function AuthRings() {
  return (
    <svg viewBox="-280 -280 560 560" className="ua-rings" aria-hidden="true">
      <defs>
        <radialGradient id="ua-glow">
          <stop offset="0%" stopColor="#121117" stopOpacity="0.07" />
          <stop offset="60%" stopColor="#121117" stopOpacity="0.03" />
          <stop offset="100%" stopColor="#121117" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle r="200" fill="url(#ua-glow)" />
      {PATHS.map((d, i) => (
        <g key={i} className="ua-ring" style={{ ["--i" as string]: i }}>
          <path d={d} fill="none" stroke="#121117" strokeWidth="1" />
        </g>
      ))}
    </svg>
  );
}
