/**
 * Very light diagonal wordmark used behind the Rita summary sheets.
 * Tuned for the cream/light pages — dark ink at a very low opacity so it
 * never competes with the body text.
 */
export function watermarkBackground(siteName: string, opacity = 0.035) {
  const text = (siteName || "").toUpperCase();
  const svg = `
<svg xmlns='http://www.w3.org/2000/svg' width='520' height='320' viewBox='0 0 520 320'>
  <g transform='rotate(-24 260 160)' fill='#23201d' fill-opacity='${opacity}' font-family='Nunito, system-ui, sans-serif' font-weight='800' font-size='22' letter-spacing='6'>
    <text x='16' y='110'>${text}</text>
    <text x='16' y='250'>${text}</text>
  </g>
</svg>`.trim();
  const enc = encodeURIComponent(svg).replace(/'/g, "%27").replace(/"/g, "%22");
  return `url("data:image/svg+xml;charset=utf-8,${enc}")`;
}

/** Soft centred wordmark — present, but far below the text contrast. */
export function CenterWatermark({ siteName }: { siteName: string }) {
  const text = (siteName || "").toUpperCase();
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden"
    >
      <svg
        viewBox="0 0 800 200"
        className="w-[130%] max-w-none opacity-[0.04]"
        style={{ transform: "rotate(-20deg)" }}
      >
        <text
          x="50%"
          y="55%"
          textAnchor="middle"
          fontFamily="Nunito, system-ui, sans-serif"
          fontWeight={900}
          fontSize="120"
          letterSpacing="14"
          fill="#23201d"
        >
          {text}
        </text>
      </svg>
    </div>
  );
}

export function WatermarkLayer({ siteName }: { siteName: string }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage: watermarkBackground(siteName),
        backgroundRepeat: "repeat",
      }}
    />
  );
}
