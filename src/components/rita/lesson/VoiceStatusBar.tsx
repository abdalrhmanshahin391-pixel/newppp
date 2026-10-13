import type { MutableRefObject } from "react";
import { Mic, MicOff } from "lucide-react";
import type { Phase } from "@/lib/rita-lesson-types";
import { VoiceOrb, type OrbLevels } from "@/components/rita-live/VoiceOrb";
import type { OrbMode } from "@/components/rita-live/orb-dynamics";

const STEPS: { phase: Phase; label: string }[] = [
  { phase: "listening", label: "Listening" },
  { phase: "understanding", label: "Understanding" },
  { phase: "preparing", label: "Preparing" },
  { phase: "speaking", label: "Speaking" },
];

const HINT: Record<Phase, string> = {
  connecting: "",
  listening: "Your words appear here as you speak.",
  understanding: "Rita heard you and is working out what you meant.",
  preparing: "Rita is putting her answer together.",
  speaking: "Talk any time to interrupt.",
  muted: "Rita can't hear you until you unmute.",
};

function Indicator({ phase }: { phase: Phase }) {
  if (phase === "listening") return <span className="rl-ind rl-ind--listen" aria-hidden="true" />;
  if (phase === "understanding" || phase === "preparing") {
    return (
      <span className="rl-ind rl-ind--think" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    );
  }
  if (phase === "speaking") {
    return (
      <span className="rl-ind rl-ind--speak" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
    );
  }
  return <span className="rl-ind" aria-hidden="true" />;
}

type Props = {
  phase: Phase;
  /** Plain-language progress while connecting. */
  connectingText: string;
  caption: string;
  muted: boolean;
  onToggleMute: () => void;
  levelsRef: MutableRefObject<OrbLevels>;
  orbMode: OrbMode;
};

/** Always shows who has the turn: Listening, Understanding, Preparing reply, or Speaking. */
export function VoiceStatusBar({
  phase,
  connectingText,
  caption,
  muted,
  onToggleMute,
  levelsRef,
  orbMode,
}: Props) {
  const current = STEPS.find((step) => step.phase === phase);
  const label =
    phase === "connecting"
      ? connectingText
      : phase === "muted"
        ? "Microphone muted"
        : phase === "preparing"
          ? "Preparing reply"
          : (current?.label ?? "");
  return (
    <div className="rl-status">
      <VoiceOrb
        levelsRef={levelsRef}
        mode={orbMode}
        label="Rita's voice"
        className="rl-status-orb"
      />
      <div style={{ minWidth: 0 }}>
        <div className="rl-phase" role="status" aria-live="polite">
          <Indicator phase={phase} />
          <span>{label}</span>
        </div>
        <p className="rl-caption" aria-live="polite" aria-atomic="true">
          {caption || HINT[phase]}
        </p>
      </div>
      <button type="button" className="rl-btn" onClick={onToggleMute} aria-pressed={muted}>
        {muted ? <MicOff size={16} aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}
        {muted ? "Unmute" : "Mute"}
      </button>
      {phase !== "connecting" && (
        <ol className="rl-steps" aria-label="Voice state">
          {STEPS.map((step) => (
            <li key={step.phase} aria-current={step.phase === phase ? "step" : undefined}>
              {step.label}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
