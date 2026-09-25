import ritaPortrait from "@/assets/rita-live/rita-voice-portrait.png";

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

export function RitaStage({
  mood,
  active,
  inputLevel = 0,
  outputLevel = 0,
  dialect,
  accentPreference = "",
  onAccentChange,
  latencyMs,
  timingDetails,
}: Props) {
  const level = mood === "talking" ? outputLevel : inputLevel;
  const energy = Math.min(1, Math.max(0, level));
  const speaking = mood === "talking" || mood === "laughing";
  const listening = mood === "listening";
  const thinking = mood === "thinking";
  const glow = active ? "rgba(139, 94, 246, .62)" : "rgba(174, 151, 222, .18)";

  return (
    <aside className="relative isolate flex h-full min-h-0 flex-col overflow-hidden bg-[#251b37] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_52%_45%,rgba(154,109,255,.28),transparent_35%),radial-gradient(circle_at_90%_90%,rgba(241,206,255,.13),transparent_38%),linear-gradient(145deg,#2b1e40_0%,#191225_66%,#271d39_100%)]" />
      <div className="absolute -right-24 -top-20 h-64 w-64 rounded-full bg-[#a783ff]/15 blur-3xl" />

      <header className="relative z-20 flex items-center justify-between px-5 py-5 md:px-8 md:py-7">
        <span className="text-sm font-bold tracking-[-.02em] text-white/90">Rita</span>
        <span className="inline-flex items-center gap-2 text-xs font-medium text-white/55">
          <span
            className={`h-2 w-2 rounded-full ${active ? "bg-[#b99bff] shadow-[0_0_12px_#b99bff]" : "bg-white/25"}`}
          />
          {active ? "Live" : "Ready"}
        </span>
      </header>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-5">
        <div className="relative grid place-items-center">
          <div
            className={`absolute rounded-full border transition-all duration-150 ${active ? "border-white/10" : "border-white/[.05]"}`}
            style={{
              inset: `${-30 - energy * 24}px`,
              boxShadow: `0 0 ${36 + energy * 70}px ${10 + energy * 20}px ${glow}`,
              transform: `scale(${1 + energy * 0.055})`,
            }}
          />
          <div
            className={`absolute -inset-10 rounded-full border ${thinking ? "animate-pulse border-[#b99bff]/45" : "border-white/[.08]"}`}
          />
          <div
            className={`absolute -inset-5 rounded-full border ${listening || speaking ? "animate-pulse border-[#c6afff]/80" : "border-white/10"}`}
          />
          <div className="relative h-36 w-36 overflow-hidden rounded-full border-[3px] border-[#f4ead8]/90 bg-[radial-gradient(circle_at_50%_25%,#f5d49b,#b96b3e_68%,#5b3326)] shadow-[0_28px_80px_-28px_rgba(0,0,0,.9)] sm:h-48 sm:w-48 lg:h-72 lg:w-72">
            <img
              src={ritaPortrait}
              alt="Rita, your language tutor"
              className={`h-full w-full object-cover object-center transition-transform duration-500 ${active ? "scale-[1.03]" : "scale-100 grayscale-[.12]"}`}
            />
            <div className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(145deg,rgba(255,255,255,.2),transparent_32%,rgba(0,0,0,.12))]" />
          </div>
          {active && (
            <div className="absolute -bottom-5 flex h-11 items-end gap-1 rounded-full border border-white/10 bg-[#26183d]/85 px-4 py-2 shadow-xl backdrop-blur-xl">
              {Array.from({ length: 13 }, (_, index) => {
                const wave = Math.abs(Math.sin(index * 0.78 + energy * 4.5));
                const height = 5 + 8 + energy * 20 * wave;
                return (
                  <span
                    key={index}
                    className="w-1 rounded-full bg-[#c6afff] transition-[height] duration-100"
                    style={{ height }}
                  />
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-7 text-center" aria-live="polite">
          <p className="text-sm font-medium text-white/70">
            {active ? moodCopy[mood] : "Your language tutor"}
          </p>
          {onAccentChange ? (
            <label className="mt-4 block text-[10px] font-bold uppercase tracking-[.14em] text-white/40">
              Dialect
              <select
                value={accentPreference}
                onChange={(event) => onAccentChange(event.target.value)}
                className="mt-1 block max-w-48 rounded-full border border-[#c6afff]/25 bg-[#c6afff]/10 px-3 py-1.5 text-xs font-bold normal-case tracking-normal text-[#e4dbff] outline-none"
                aria-label="Rita dialect"
              >
                {ACCENTS.map(([value, label]) => (
                  <option key={value || "automatic"} value={value} className="bg-[#251b37]">
                    {value || !dialect || dialect === "unknown" || dialect === "standard"
                      ? label
                      : `${label} · ${dialect}`}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {typeof latencyMs === "number" && (
            <span className="mt-3 block text-[10px] font-medium text-white/35">
              Voice started in {(latencyMs / 1_000).toFixed(2)}s
            </span>
          )}
          {timingDetails && (
            <span className="mt-1 block text-[9px] font-medium text-white/30">{timingDetails}</span>
          )}
        </div>
      </div>
    </aside>
  );
}
