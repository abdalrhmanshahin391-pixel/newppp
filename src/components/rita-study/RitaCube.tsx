import { useEffect, useRef, type MutableRefObject } from "react";
import { OrbDynamics, type OrbMode } from "@/components/rita-live/orb-dynamics";
import type { OrbLevels } from "@/components/rita-live/VoiceOrb";

/**
 * Rita's face on the study page: a blue jelly cube with two eyes. Before the call it is big, wobbles
 * like slime and Uzyra stands next to it. When the call starts it shrinks to the top; while the
 * learner speaks it gets smaller still (the same envelope the old orb used), and while Rita speaks
 * it swells a little with her voice.
 *
 * Motion is transform and opacity only. The slow wobble, the quick shiver and the blink are CSS
 * and stop under reduced motion; the voice follows `levelsRef` in one animation frame loop that
 * writes a single transform and never touches React state.
 */
export function RitaCube({
  levelsRef,
  mode,
  intro,
  label,
}: {
  levelsRef: MutableRefObject<OrbLevels>;
  mode: OrbMode;
  /** Before the call: big, with Uzyra beside it. */
  intro: boolean;
  label: string;
}) {
  const level = useRef<HTMLDivElement>(null);
  const modeRef = useRef<OrbMode>(mode);
  modeRef.current = mode;

  useEffect(() => {
    const el = level.current;
    if (!el) return;
    const dynamics = new OrbDynamics();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let out = 0;
    let last = performance.now();
    let raf = 0;
    let visible = document.visibilityState === "visible";
    const onVisibility = () => {
      visible = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", onVisibility);

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (!visible) {
        last = now;
        return;
      }
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (reduced.matches) {
        el.style.transform = "none";
        return;
      }
      const levels = levelsRef.current;
      const frame = dynamics.step(dt, {
        input: levels.input,
        output: levels.output,
        mode: modeRef.current,
        reducedMotion: false,
      });
      // Rita's voice: swell a little, smoothly (never a hard pulse).
      const target = modeRef.current === "speaking" ? Math.min(1, levels.output) : 0;
      out += (target - out) * (1 - Math.exp(-dt / (target > out ? 0.05 : 0.18)));
      // The learner speaking pulls the cube in (radius < 1); Rita's voice pushes it out.
      const scale = frame.radius * (1 + out * 0.09);
      el.style.transform = `scale(${scale.toFixed(4)})`;
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [levelsRef]);

  return (
    <div className="uz-cube-stage" data-intro={intro ? "true" : "false"} data-mode={mode}>
      <img
        className="uz-cube-uzyra"
        src="/brand-uzyra-wave.png"
        width={168}
        height={200}
        alt=""
        aria-hidden="true"
        draggable={false}
      />
      <div className="uz-cube-move" role="img" aria-label={label}>
        <div ref={level} className="uz-cube-level">
          <div className="uz-cube-jelly">
            <div className="uz-cube-body">
              <span className="uz-cube-shine" aria-hidden="true" />
              <span className="uz-cube-eye" aria-hidden="true" />
              <span className="uz-cube-eye" aria-hidden="true" />
            </div>
          </div>
        </div>
        <span className="uz-cube-shadow" aria-hidden="true" />
      </div>
    </div>
  );
}
