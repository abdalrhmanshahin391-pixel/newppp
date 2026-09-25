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
    <div className="rounded-3xl border border-border bg-card p-6 shadow-lg shadow-foreground/5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b3aa9c]">Session</p>
        <button
          type="button"
          onClick={() => onMuted(!muted)}
          className="grid h-8 w-8 place-items-center rounded-lg text-[#a29a8d] hover:bg-black/[0.06]"
          aria-label={muted ? "Unmute sounds" : "Mute sounds"}
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>

      <p className="mt-3 text-[34px] font-black leading-none text-foreground">
        {pairCount}
        <span className="ml-1.5 text-[13px] font-bold text-[#a29a8d]">
          pair{pairCount === 1 ? "" : "s"} ready
        </span>
      </p>
      <p className="mt-1 truncate text-[12.5px] font-semibold text-[#a29a8d]">
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
               className={`min-h-16 rounded-2xl border px-4 py-3 text-left transition-colors ${
                 on ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted"
              }`}
            >
              <span className="block text-[13.5px] font-extrabold text-[#23201d]">{m.label}</span>
              <span className="block text-[11.5px] font-semibold text-[#a29a8d]">{m.hint}</span>
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
         className="rita-pill mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-extrabold disabled:opacity-40"
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
      className="flex items-center justify-between rounded-xl bg-white px-4 py-2.5"
    >
      <span className="text-[13px] font-bold text-[#23201d]">{label}</span>
      <span
        className="relative h-6 w-11 rounded-full transition-colors"
        style={{ background: checked ? "#6ab887" : "#ded6c7" }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
          style={{ left: checked ? 22 : 2 }}
        />
      </span>
    </button>
  );
}
