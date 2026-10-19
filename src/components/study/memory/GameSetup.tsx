import { Play, Volume2, VolumeX } from "lucide-react";
import { GAME_MODES, type GameMode } from "@/lib/memory-game";

/** Mode picker plus the two pressure toggles, shown beside the board. */
export function GameSetup({
  mode,
  onMode,
  pairCount,
  suddenDeath,
  onSuddenDeath,
  timed,
  onTimed,
  muted,
  onMuted,
  onPlay,
  scopeLabel,
}: {
  mode: GameMode;
  onMode: (m: GameMode) => void;
  pairCount: number;
  suddenDeath: boolean;
  onSuddenDeath: (v: boolean) => void;
  timed: boolean;
  onTimed: (v: boolean) => void;
  muted: boolean;
  onMuted: (v: boolean) => void;
  onPlay: () => void;
  scopeLabel: string | null;
}) {
  const current = GAME_MODES.find((m) => m.key === mode);
  return (
    <div className="rounded-[20px] bg-[#f4f4f8] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[34px] font-bold leading-none tracking-[-0.03em] text-[#121117]">
            {pairCount}
            <span className="ml-1.5 text-[14px] font-semibold text-[#4b4a5c]">
              pair{pairCount === 1 ? "" : "s"} ready
            </span>
          </p>
          <p className="mt-1.5 text-[14px] font-medium text-[#4b4a5c]">
            {scopeLabel ?? "Tick a subject or sub-subject to choose what to play"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onMuted(!muted)}
          className="-mr-1 -mt-1 grid h-11 w-11 shrink-0 touch-manipulation place-items-center rounded-lg text-[#4b4a5c] hover:bg-white"
          aria-label={muted ? "Unmute sounds" : "Mute sounds"}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      <button
        type="button"
        onClick={onPlay}
        disabled={pairCount === 0}
        className="rita-pill mt-4 flex h-12 w-full touch-manipulation items-center justify-center gap-2 text-[15px] font-semibold active:scale-[0.98] disabled:opacity-40"
      >
        <Play size={16} /> Play {current?.label ?? ""}
      </button>

      <div role="radiogroup" aria-label="Game" className="mt-4 grid grid-cols-2 gap-2">
        {GAME_MODES.map((m) => {
          const on = mode === m.key;
          return (
            <button
              key={m.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onMode(m.key)}
              className={`min-h-[72px] touch-manipulation rounded-xl border-2 px-3 py-2.5 text-left transition-colors duration-150 ${
                on
                  ? "border-[#121117] bg-[#2b6df0]"
                  : "border-[#dcdce5] bg-white hover:border-[#121117]"
              }`}
            >
              <span
                className={`block text-[15px] font-bold ${on ? "text-white" : "text-[#121117]"}`}
              >
                {m.label}
              </span>
              <span
                className={`mt-0.5 block text-[12.5px] font-medium leading-snug ${on ? "text-white" : "text-[#4b4a5c]"}`}
              >
                {m.hint}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-2">
        <Toggle
          label="Sudden death"
          note="One mistake ends the round"
          checked={suddenDeath}
          onChange={onSuddenDeath}
        />
        <Toggle label="Timed challenge" note="Race the clock" checked={timed} onChange={onTimed} />
      </div>
    </div>
  );
}

function Toggle({
  label,
  note,
  checked,
  onChange,
}: {
  label: string;
  note: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-14 touch-manipulation items-center justify-between gap-3 rounded-xl bg-white px-4 py-2 text-left"
    >
      <span className="min-w-0">
        <span className="block text-[14.5px] font-semibold text-[#121117]">{label}</span>
        <span className="block text-[12.5px] font-medium text-[#4b4a5c]">{note}</span>
      </span>
      <span
        className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
        style={{ background: checked ? "#2b6df0" : "#ffffff", border: "2px solid #121117" }}
      >
        <span
          className="absolute top-[1px] h-4 w-4 rounded-full transition-all duration-150"
          style={{ left: checked ? 21 : 2, background: checked ? "#ffffff" : "#121117" }}
        />
      </span>
    </button>
  );
}
