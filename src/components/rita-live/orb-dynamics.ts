/**
 * Motion model for the Rita voice orb. Pure and deterministic: it turns raw
 * microphone / playback levels plus the conversation mode into the handful of
 * numbers the shader needs. No DOM, no WebGL, so it can be unit tested.
 *
 * Design intent
 * - While the learner talks the orb contracts; it recovers in proportion to how
 *   long they pause. Two envelopes make that readable: a fast one that follows
 *   syllables, and a slow "speech activity" one that only releases after a real
 *   pause. A gap between words barely lets the orb grow, a comma lets it grow a
 *   little more, the end of a sentence lets it open fully.
 * - While Rita talks the orb stays at full size and only the clouds inside move,
 *   faster and wilder with her voice. The orb itself never pulses.
 */

export type OrbMode = "idle" | "listening" | "thinking" | "speaking";

export type OrbTelemetry = {
  /** Raw microphone level, 0..1 (the transport's local audio level). */
  input: number;
  /** Raw playback level of Rita's voice, 0..1 (the transport's remote audio level). */
  output: number;
  mode: OrbMode;
  reducedMotion?: boolean;
};

export type OrbFrame = {
  /** 1 is full size. Below 1 while the learner is speaking. */
  radius: number;
  /** 0..1 fast energy used for surface ripples. */
  pulse: number;
  /** Cloud flow speed (phase units per second). */
  flowSpeed: number;
  /** Accumulated flow phase, fed straight to the shader as time. */
  phase: number;
  /** 0..1 amount of domain warp, i.e. how violently the clouds churn. */
  warp: number;
  /** 0..1 outer glow strength. */
  glow: number;
  /** Smoothed mode weights (sum to 1 together with idle). */
  mix: { idle: number; listening: number; thinking: number; speaking: number };
  /** True while the learner's voice is above the gate. */
  voiced: boolean;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
/** Exponential smoothing coefficient for a time constant (seconds). */
const alpha = (dt: number, tau: number) => 1 - Math.exp(-dt / Math.max(1e-4, tau));

export const ORB_TUNING = {
  /** Levels under this are treated as room noise. */
  noiseGate: 0.012,
  /** The auto gain never amplifies by more than 1 / floor. */
  gainFloor: 0.06,
  /** Fraction of the tracked peak that decays each second. */
  peakDecayPerSecond: 0.14,
  voicedOn: 0.2,
  voicedOff: 0.11,
  pulseAttack: 0.035,
  pulseRelease: 0.16,
  activityAttack: 0.22,
  activityRelease: 0.8,
  outputAttack: 0.05,
  outputRelease: 0.22,
  modeBlend: 0.35,
  /** How far the orb contracts at most while the learner talks. */
  contractActivity: 0.2,
  contractPulse: 0.06,
  /** Rest sizes per mode. */
  idleRadius: 0.86,
  thinkingRadius: 0.94,
  /** Rita's voice moves the inside only; the outline stays put. */
  speakingBoost: 0,
} as const;

export class OrbDynamics {
  private peak = 0;
  private pulse = 0;
  private activity = 0;
  private outLevel = 0;
  private voiced = false;
  private phase = 0;
  private clock = 0;
  private mix = { idle: 1, listening: 0, thinking: 0, speaking: 0 };

  /** Normalises a raw level against the loudest recent level so quiet microphones still move the orb. */
  private normalise(level: number, dt: number) {
    const t = ORB_TUNING;
    const gated = level < t.noiseGate ? 0 : clamp01(level);
    this.peak = Math.max(this.peak * Math.exp(-t.peakDecayPerSecond * dt), gated, t.gainFloor);
    return clamp01(gated / this.peak);
  }

  step(dt: number, telemetry: OrbTelemetry): OrbFrame {
    const t = ORB_TUNING;
    const step = Math.min(0.1, Math.max(0, dt));
    this.clock += step;

    const input = this.normalise(telemetry.input, step);
    const output = clamp01(telemetry.output);

    // Voice gate with hysteresis so the contraction does not flicker on soft consonants.
    this.voiced = this.voiced ? input > t.voicedOff : input > t.voicedOn;
    const listeningNow = telemetry.mode === "listening";

    const pulseTarget = listeningNow ? input : 0;
    this.pulse +=
      (pulseTarget - this.pulse) *
      alpha(step, pulseTarget > this.pulse ? t.pulseAttack : t.pulseRelease);

    const activityTarget = listeningNow && this.voiced ? 1 : 0;
    this.activity +=
      (activityTarget - this.activity) *
      alpha(step, activityTarget > this.activity ? t.activityAttack : t.activityRelease);

    const outputTarget = telemetry.mode === "speaking" ? output : 0;
    this.outLevel +=
      (outputTarget - this.outLevel) *
      alpha(step, outputTarget > this.outLevel ? t.outputAttack : t.outputRelease);

    // Mode weights ease toward a one-hot vector so changes of state glide.
    const targets = {
      idle: telemetry.mode === "idle" ? 1 : 0,
      listening: listeningNow ? 1 : 0,
      thinking: telemetry.mode === "thinking" ? 1 : 0,
      speaking: telemetry.mode === "speaking" ? 1 : 0,
    };
    const k = alpha(step, t.modeBlend);
    this.mix.idle += (targets.idle - this.mix.idle) * k;
    this.mix.listening += (targets.listening - this.mix.listening) * k;
    this.mix.thinking += (targets.thinking - this.mix.thinking) * k;
    this.mix.speaking += (targets.speaking - this.mix.speaking) * k;

    const calm = telemetry.reducedMotion ? 0.3 : 1;
    const breathe = Math.sin(this.clock * 0.9);

    const idleRadius = t.idleRadius + 0.012 * breathe * calm;
    const listeningRadius =
      1 - (t.contractActivity * this.activity + t.contractPulse * this.pulse) * calm;
    const thinkingRadius = t.thinkingRadius + 0.018 * Math.sin(this.clock * 1.6) * calm;
    const speakingRadius = 1 + t.speakingBoost * this.outLevel * calm;

    const radius =
      this.mix.idle * idleRadius +
      this.mix.listening * listeningRadius +
      this.mix.thinking * thinkingRadius +
      this.mix.speaking * speakingRadius;

    const flowSpeed =
      (this.mix.idle * 0.1 +
        this.mix.listening * (0.22 + 0.45 * this.activity) +
        this.mix.thinking * 0.16 +
        this.mix.speaking * (0.35 + 1.9 * this.outLevel)) *
      (telemetry.reducedMotion ? 0.3 : 1);
    this.phase += step * flowSpeed;

    const warp = clamp01(
      this.mix.idle * 0.18 +
        this.mix.listening * (0.22 + 0.5 * this.pulse) +
        this.mix.thinking * 0.26 +
        this.mix.speaking * (0.35 + 0.85 * this.outLevel),
    );
    const glow = clamp01(
      this.mix.idle * 0.12 +
        this.mix.listening * (0.2 + 0.35 * this.activity) +
        this.mix.thinking * 0.22 +
        this.mix.speaking * (0.3 + 0.6 * this.outLevel),
    );

    return {
      radius,
      pulse: this.pulse,
      flowSpeed,
      phase: this.phase,
      warp,
      glow,
      mix: { ...this.mix },
      voiced: this.voiced,
    };
  }
}
