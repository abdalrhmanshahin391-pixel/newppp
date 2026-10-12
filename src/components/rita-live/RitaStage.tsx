import { useRef, type MutableRefObject } from "react";
import { VoiceOrb, type OrbLevels } from "./VoiceOrb";
import type { OrbMode } from "./orb-dynamics";

export type RitaMood = "ready" | "listening" | "thinking" | "talking" | "laughing";

const moodCopy: Record<RitaMood, string> = {
  ready: "Ready for your lesson",
  listening: "I’m listening…",
  thinking: "Let me think…",
  talking: "Rita is speaking",
  laughing: "That was excellent",
};

type Props = {
  mood: RitaMood;
  active: boolean;
  inputLevel?: number;
  outputLevel?: number;
  /** Live transport levels. When given, the orb follows them frame by frame. */
  levelsRef?: MutableRefObject<OrbLevels>;
  caption?: string;
  dialect?: string;
  accentPreference?: string;
  onAccentChange?: (accent: string) => void;
  latencyMs?: number | null;
  timingDetails?: string;
};

const ACCENTS = [
  ["", "Automatic"],
  ["ar-JO", "Jordanian Arabic"],
  ["ar-IQ", "Iraqi Arabic"],
  ["ar-PS", "Palestinian Arabic"],
  ["ar-EG", "Egyptian Arabic"],
  ["ar-LB", "Lebanese Arabic"],
  ["ar-SY", "Syrian Arabic"],
  ["ar-SA", "Saudi Arabic"],
  ["Gulf Arabic", "Gulf Arabic"],
  ["ar-MA", "Moroccan Arabic"],
  ["en-US", "American English"],
  ["en-GB", "British English"],
  ["de-DE", "German"],
] as const;

/** Maps the lesson state onto the orb's motion mode. */
export function orbModeFor(active: boolean, mood: RitaMood): OrbMode {
  if (!active) return "idle";
  if (mood === "talking" || mood === "laughing") return "speaking";
  if (mood === "thinking") return "thinking";
  return "listening";
}

export function RitaStage({
  mood,
  active,
  inputLevel = 0,
  outputLevel = 0,
  levelsRef,
  dialect,
  accentPreference = "",
  onAccentChange,
  latencyMs,
  timingDetails,
}: Props) {
  // Without live levels the orb falls back to the constant values the caller passed.
  const fallbackLevels = useRef<OrbLevels>({ input: inputLevel, output: outputLevel });
  fallbackLevels.current.input = inputLevel;
  fallbackLevels.current.output = outputLevel;
  const levels = levelsRef ?? fallbackLevels;

  return (
    <aside className="relative isolate flex h-full min-h-0 flex-col overflow-hidden bg-black text-white">
      <header className="relative z-20 flex items-center justify-between px-5 py-5 md:px-8 md:py-7">
        <span className="text-sm font-semibold tracking-[-.02em] text-white/85">Rita</span>
        <span className="inline-flex items-center gap-2 text-xs font-medium text-white/50">
          <span
            className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${active ? "bg-white" : "bg-white/25"}`}
          />
          {active ? "Live" : "Ready"}
        </span>
      </header>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-8">
        <VoiceOrb
          levelsRef={levels}
          mode={orbModeFor(active, mood)}
          label={active ? moodCopy[mood] : "Rita, your language tutor"}
          className="w-[min(100%,760px)]"
        />

        <div className="-mt-[14%] text-center md:-mt-24" aria-live="polite">
          <p className="text-sm font-medium text-white/70">
            {active ? moodCopy[mood] : "Your language tutor"}
          </p>
          {onAccentChange ? (
            <label className="mt-4 block text-[10px] font-semibold uppercase tracking-[.14em] text-white/35">
              Dialect
              <select
                value={accentPreference}
                onChange={(event) => onAccentChange(event.target.value)}
                className="mt-1 block max-w-48 rounded-full border border-white/12 bg-white/[.04] px-3 py-1.5 text-xs font-semibold normal-case tracking-normal text-white/80 outline-none"
                aria-label="Rita dialect"
              >
                {ACCENTS.map(([value, label]) => (
                  <option key={value || "automatic"} value={value} className="bg-black">
                    {value || !dialect || dialect === "unknown" || dialect === "standard"
                      ? label
                      : `${label} · ${dialect}`}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {typeof latencyMs === "number" && (
            <span className="mt-3 block text-[10px] font-medium text-white/30">
              Voice started in {(latencyMs / 1_000).toFixed(2)}s
            </span>
          )}
          {timingDetails && (
            <span className="mt-1 block text-[9px] font-medium text-white/25">{timingDetails}</span>
          )}
        </div>
      </div>
    </aside>
  );
}
