import { useEffect, useRef } from "react";
import {
  SIG_CROSS_D,
  SIG_CROSS_R,
  SIG_DOT,
  SIG_MAIN_D,
  SIG_MAIN_R,
} from "./signature-paths";

const EASE_MAIN = "cubic-bezier(0.42, 0, 0.3, 1)";
const EASE_CROSS = "cubic-bezier(0.3, 0, 0.2, 1)";

/**
 * "Edith" written on the iPad screen, once. A pressure-shaded ribbon (thick on
 * the downstrokes) is revealed by a thick centerline mask, so it looks pen-written.
 * The write-on is pure CSS (works on first paint and without JS); the small
 * pen-tip glow is a client-only enhancement that just reads the animation state.
 */
export function HandwrittenSignature({ className = "" }: { className?: string }) {
  const main = useRef<SVGPathElement>(null);
  const cross = useRef<SVGPathElement>(null);
  const glow = useRef<SVGCircleElement>(null);
  const core = useRef<SVGCircleElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const m = main.current;
    const c = cross.current;
    const g = glow.current;
    const k = core.current;
    if (!m || !c || !g || !k) return;
    const started = performance.now();
    let raf = 0;
    const offset = (el: SVGPathElement) => parseFloat(getComputedStyle(el).strokeDashoffset);
    const frame = () => {
      const om = offset(m);
      const oc = offset(c);
      const active = om > 0.001 && om < 0.999 ? m : oc > 0.001 && oc < 0.999 ? c : null;
      if (active) {
        const off = active === m ? om : oc;
        const pt = active.getPointAtLength((1 - off) * active.getTotalLength());
        g.setAttribute("cx", String(pt.x));
        g.setAttribute("cy", String(pt.y));
        k.setAttribute("cx", String(pt.x));
        k.setAttribute("cy", String(pt.y));
        g.style.opacity = "0.35";
        k.style.opacity = "1";
      } else {
        g.style.opacity = "0";
        k.style.opacity = "0";
      }
      const done = om <= 0.001 && oc <= 0.001;
      if (!done && performance.now() - started < 6000) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <svg
      className={`edith-sig ${className}`}
      viewBox="0 0 800 340"
      role="img"
      aria-label="Edith"
    >
      <defs>
        <mask id="edith-sig-mk-main" maskUnits="userSpaceOnUse" x="-60" y="-60" width="920" height="460">
          <path
            ref={main}
            className="sig-draw"
            d={SIG_MAIN_D}
            pathLength={1}
            fill="none"
            stroke="#fff"
            strokeWidth={12}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ "--sig-delay": "150ms", "--sig-dur": "1550ms", "--sig-ease": EASE_MAIN } as React.CSSProperties}
          />
        </mask>
        <mask id="edith-sig-mk-cross" maskUnits="userSpaceOnUse" x="-60" y="-60" width="920" height="460">
          <path
            ref={cross}
            className="sig-draw"
            d={SIG_CROSS_D}
            pathLength={1}
            fill="none"
            stroke="#fff"
            strokeWidth={12}
            strokeLinecap="round"
            style={{ "--sig-delay": "1780ms", "--sig-dur": "260ms", "--sig-ease": EASE_CROSS } as React.CSSProperties}
          />
        </mask>
      </defs>
      <g transform="translate(14,0) skewX(-8)">
        <path d={SIG_MAIN_R} fill="#fff" mask="url(#edith-sig-mk-main)" />
        <path d={SIG_CROSS_R} fill="#fff" mask="url(#edith-sig-mk-cross)" />
        <circle className="sig-dot" cx={SIG_DOT.cx} cy={SIG_DOT.cy} r={4.6} fill="#fff" />
        <circle ref={glow} r={14} fill="#bcd8ff" style={{ opacity: 0 }} />
        <circle ref={core} r={4.2} fill="#fff" style={{ opacity: 0 }} />
      </g>
    </svg>
  );
}
