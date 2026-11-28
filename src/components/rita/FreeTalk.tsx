// The free conversation's own look (free-talk.css): its start screen in the home page's language
// (the field of marks gathered around Uzyra's cube, a headline that comes in word by word, topics
// to open with, the explanation language as one sliding switch) and, during the call, Uzyra's cube
// with a halo and two small bars of voice beside it, and the «مباشر» line at the top. Lessons and
// books keep the plain study column.
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
} from "react";
import { Clapperboard, Handshake, Plane, Sun, type LucideIcon } from "lucide-react";
import { useDotField } from "@/components/page-hero/useDotField";
import type { OrbLevels } from "@/components/rita-live/VoiceOrb";
import type { ExplanationLanguage } from "@/lib/explanation-language";
import { ExplanationLanguageControl } from "./ExplanationLanguageControl";
import "./free-talk.css";

export type FreeTalkTopic = {
  id: string;
  /** On the chip. */
  label: string;
  /** Sent as the learner's first message once Uzyra is connected, so she opens with it. */
  say: string;
  icon: LucideIcon;
};

export const FREE_TALK_TOPICS: readonly FreeTalkTopic[] = [
  { id: "meet", label: "نتعرّف على بعض", say: "خلينا نتعرّف على بعض.", icon: Handshake },
  { id: "day", label: "يومي", say: "خلينا نحكي عن يومي.", icon: Sun },
  { id: "trip", label: "سفرة بحلم فيها", say: "خلينا نحكي عن سفرة بحلم فيها.", icon: Plane },
  { id: "film", label: "فيلم شفته", say: "خلينا نحكي عن فيلم شفته.", icon: Clapperboard },
];

const HEADLINE = "احكي، ويوزرا بتسمعك.";

export function FreeTalkIntro({
  topic,
  onTopic,
  live,
  onExplanation,
}: {
  topic: FreeTalkTopic | null;
  onTopic: (topic: FreeTalkTopic | null) => void;
  /** A call is running (the language hint then says "from her next answer"). */
  live: boolean;
  onExplanation: (value: ExplanationLanguage) => void;
}) {
  const hero = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const spot = useRef<HTMLDivElement>(null);
  const topicsId = useId();
  // The marks gather around the cube; the headline's words come in once it is on screen.
  useDotField(hero, canvas, undefined, spot);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const words = HEADLINE.split(" ");

  return (
    <div ref={hero} className="uz-rc-hero ft-hero">
      <canvas ref={canvas} className="ft-marks" aria-hidden="true" />
      <div ref={spot} className="uz-rc-spot is-hero ft-spot" data-cube-spot="hero">
        <span className="ft-orbit" aria-hidden="true">
          <span className="ft-orbit-dot" />
        </span>
        <span className="ft-floor" aria-hidden="true" />
      </div>
      <p className="ft-kicker">
        <span className="ft-kicker-mark" aria-hidden="true" />
        محادثة حرة
      </p>
      <h1 className="ft-title" data-shown={shown ? "on" : undefined}>
        <span className="sr-only">{HEADLINE}</span>
        <span aria-hidden="true">
          {words.map((word, i) => (
            <span key={i} className="ft-word" style={{ "--i": i } as CSSProperties}>
              {word}
              {i < words.length - 1 ? " " : ""}
            </span>
          ))}
        </span>
      </h1>
      <p className="ft-lead">احكي عن أي إشي. يوزرا بترد بصوتها وبتصحّحلك بلطف.</p>

      <div className="ft-options">
        <div className="ft-topics" role="group" aria-labelledby={topicsId}>
          <p id={topicsId} className="ft-topics-label">
            عن شو بدك نحكي؟
          </p>
          <div className="ft-chips">
            {FREE_TALK_TOPICS.map((item) => {
              const Icon = item.icon;
              const on = topic?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className="ft-chip"
                  aria-pressed={on}
                  onClick={(event) => {
                    onTopic(on ? null : item);
                    // On a phone the row scrolls: bring a chip that was half off the edge in.
                    event.currentTarget.scrollIntoView({
                      behavior: "smooth",
                      block: "nearest",
                      inline: "nearest",
                    });
                  }}
                >
                  <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
          </div>
          <p className="ft-topics-hint" role="status" aria-live="polite">
            {topic
              ? `لما تبلّش، يوزرا بتفتح الحكي عن «${topic.label}».`
              : "اختياري: أو احكي عن أي إشي ببالك."}
          </p>
        </div>

        <div className="ft-explain">
          <ExplanationLanguageControl
            ui="ar"
            live={live}
            onChange={onExplanation}
            variant="segmented"
          />
        </div>
      </div>
    </div>
  );
}

/** Bars on each side of the cube: how many, and the nearest is `0`. */
const BARS = 9;

/**
 * Uzyra's cube during the call: its spot (the cube flies here), a soft halo behind it that grows
 * with the voice, and two short rows of bars beside it that move with whoever is speaking: blue
 * for Uzyra, ink for the learner. One animation-frame loop writes the bars' transforms and the
 * `--lvl` level (0 to 1) straight to the page, so nothing re-renders.
 */
export function CallStage({
  levelsRef,
  live,
}: {
  levelsRef: MutableRefObject<OrbLevels>;
  /** Connected: the bars follow the voices; otherwise they rest. */
  live: boolean;
}) {
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const bars = Array.from(el.querySelectorAll<HTMLElement>("[data-k]"));
    let frame = 0;
    let level = 0;
    let voice = "";
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const { input, output } = levelsRef.current;
      const target = live ? Math.min(1, Math.max(input, output) * 2.4) : 0;
      // Up quickly with a voice, down slowly after it.
      level += (target - level) * (target > level ? 0.4 : 0.1);
      const next = !live
        ? "off"
        : output >= 0.03 && output >= input
          ? "uzyra"
          : input >= 0.03
            ? "you"
            : "quiet";
      if (next !== voice) {
        voice = next;
        el.dataset.voice = next;
      }
      el.style.setProperty("--lvl", level.toFixed(3));
      for (const bar of bars) {
        const k = Number(bar.dataset.k);
        const reach = 1 - (k / BARS) * 0.72;
        const wave = 0.5 + 0.5 * Math.sin(now / 150 - k * 0.8);
        const rest = 0.16 + 0.07 * Math.sin(now / 900 + k * 0.9);
        const height = Math.max(rest, level * reach * (0.35 + 0.65 * wave));
        bar.style.transform = `scaleY(${height.toFixed(3)})`;
      }
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [levelsRef, live]);

  const side = (end: boolean) => (
    <span className={`ft-wave${end ? " is-end" : ""}`} aria-hidden="true">
      {Array.from({ length: BARS }, (_, k) => (
        <i key={k} data-k={k} />
      ))}
    </span>
  );
  return (
    <div ref={stage} className="ft-stage" data-voice="off">
      {side(false)}
      <div className="uz-rc-spot is-dock ft-dock-spot" data-cube-spot="dock" />
      {side(true)}
    </div>
  );
}

/** The quiet line at the top while connected: «● مباشر مع يوزرا». */
export function LivePill({ ready }: { ready: boolean }) {
  return (
    <p className="ft-live" data-ready={ready ? "" : undefined}>
      <span className="ft-live-dot" aria-hidden="true" />
      {ready ? (
        <span>
          مباشر<span className="ft-live-more"> مع يوزرا</span>
        </span>
      ) : (
        <span>عم نوصلك بيوزرا…</span>
      )}
    </p>
  );
}
