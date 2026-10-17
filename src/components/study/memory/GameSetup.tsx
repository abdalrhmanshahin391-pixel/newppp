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
  return (
    <div className="rounded-[20px] bg-white p-6" style={{ border: "2px solid #121117" }}>
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-semibold text-[#6a697c]">Session</p>
        <button
          type="button"
          onClick={() => onMuted(!muted)}
          className="grid h-9 w-9 place-items-center rounded-lg text-[#6a697c] hover:bg-[#f4f4f8]"
          aria-label={muted ? "Unmute sounds" : "Mute sounds"}
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>

      <p className="mt-3 text-[38px] font-bold leading-none tracking-[-0.03em] text-[#121117]">
        {pairCount}
        <span className="ml-1.5 text-[14px] font-semibold text-[#6a697c]">
          pair{pairCount === 1 ? "" : "s"} ready
        </span>
      </p>
      <p className="mt-1 truncate text-[14px] font-medium text-[#6a697c]">
        {scopeLabel ?? "Tick a subject or sub-subject"}
      </p>

      <div className="mt-4 grid gap-2">
        {GAME_MODES.map((m) => {
          const on = mode === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => onMode(m.key)}
              aria-pressed={on}
              className={`min-h-16 rounded-xl border-2 border-[#121117] px-4 py-3 text-left transition-colors ${
                on ? "bg-[#2b6df0]" : "bg-white hover:bg-[#e7eefd]"
              }`}
            >
              <span
                className={`block text-[15px] font-bold ${on ? "text-white" : "text-[#121117]"}`}
              >
                {m.label}
              </span>
              <span
                className={`block text-[13px] font-medium ${on ? "text-white/90" : "text-[#4b4a5c]"}`}
              >
                {m.hint}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-2">
        <Toggle label="Sudden death" checked={suddenDeath} onChange={onSuddenDeath} />
        <Toggle label="Timed challenge" checked={timed} onChange={onTimed} />
      </div>

      <button
        type="button"
        onClick={onPlay}
        disabled={pairCount === 0}
        className="rita-pill mt-5 flex h-12 w-full items-center justify-center gap-2 text-[15px] font-semibold disabled:opacity-40"
      >
        <Play size={16} /> Play
      </button>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between rounded-xl bg-[#f4f4f8] px-4 py-2.5"
    >
      <span className="text-[14px] font-semibold text-[#121117]">{label}</span>
      <span
        className="relative h-6 w-11 rounded-full transition-colors"
        style={{ background: checked ? "#2b6df0" : "#ffffff", border: "2px solid #121117" }}
      >
        <span
          className="absolute top-[1px] h-4 w-4 rounded-full bg-[#121117] transition-all"
          style={{ left: checked ? 21 : 2 }}
        />
      </span>
    </button>
  );
}
