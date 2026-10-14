/**
 * Motion model for the 3D Rita avatar. Pure and deterministic (seeded): it
 * turns Rita's playback level, the learner's microphone level and the
 * conversation mode into a pose. No DOM, no WebGL, so it can be unit tested.
 *
 * Design intent
 * - The mouth follows the loudness of Rita's own voice: a fast envelope opens
 *   it on syllables and closes it in pauses. Each new syllable picks a slightly
 *   different shape (wide / round) so speech never looks like a flapping hinge.
 * - Gestures change at phrase boundaries (a real pause in her speech), never on
 *   a blind timer, and never repeat back to back. Each gesture is a hand target
 *   for an IK arm, so moves are expressed as "where the hand goes".
 * - Every channel is a damped spring with its own speed. The torso leads, the
 *   head follows a beat later and the ponytail trails behind (overlapping
 *   action), which is what makes the motion read as natural rather than robotic.
 * - Amplitudes are capped: present, never theatrical.
 */

export type AvatarMode = "idle" | "listening" | "thinking" | "speaking";
export type Vec3 = [number, number, number];

export type AvatarTelemetry = {
  /** Learner microphone level, 0..1. */
  input: number;
  /** Rita's playback level, 0..1. */
  output: number;
  mode: AvatarMode;
  reducedMotion?: boolean;
};

export type HandPose = {
  /** IK target for the wrist, in chest space (metres, +y up, +z towards the viewer, +x her left). */
  target: Vec3;
  /** Point the elbow bends towards, in chest space. */
  pole: Vec3;
  /** Wrist rotation (euler XYZ, radians). */
  wrist: Vec3;
  /** 1 = open hand, 0 = fist. */
  open: number;
};

export type AvatarPose = {
  root: { y: number; yaw: number };
  hips: Vec3;
  chest: Vec3;
  neck: Vec3;
  head: Vec3;
  pony1: Vec3;
  pony2: Vec3;
  left: HandPose;
  right: HandPose;
  mouth: { open: number; wide: number; round: number; smile: number };
  /** 0 = eyes open, 1 = closed. */
  blink: number;
  gesture: GestureName;
  /** Smoothed mouth drive (0..1), exposed for tests and debugging. */
  voice: number;
};

export type GestureName =
  "rest" | "handOnChest" | "presentLeft" | "explainRight" | "behindBack" | "openBoth" | "thinking";

type Gesture = {
  left: Omit<HandPose, "open"> & { open: number };
  right: Omit<HandPose, "open"> & { open: number };
  chest: Vec3;
  head: Vec3;
};

// Shoulders sit at about (±0.086, 0.228, 0) in chest space; the arm reaches 0.46.
const REST_L: Gesture["left"] = {
  target: [0.13, -0.215, 0.03],
  pole: [0.25, -0.1, -0.25],
  wrist: [0, 0, 0],
  open: 1,
};
const REST_R: Gesture["right"] = {
  target: [-0.13, -0.215, 0.03],
  pole: [-0.25, -0.1, -0.25],
  wrist: [0, 0, 0],
  open: 1,
};
const CHEST_R: Gesture["right"] = {
  target: [-0.005, 0.13, 0.11],
  pole: [-0.2, -0.4, -0.05],
  wrist: [0, 0, 0],
  open: 0,
};

export const GESTURES: Record<GestureName, Gesture> = {
  rest: { left: REST_L, right: REST_R, chest: [0, 0, 0], head: [0, 0, 0] },
  handOnChest: { left: REST_L, right: CHEST_R, chest: [0.01, 0, 0], head: [0.03, 0, -0.04] },
  // The pose from the drawing: open palm raised to her left, other hand on her chest.
  presentLeft: {
    left: { target: [0.24, 0.24, 0.12], pole: [0.3, -0.35, -0.1], wrist: [0, -1.3, -1.1], open: 1 },
    right: CHEST_R,
    chest: [0, 0.06, 0.015],
    head: [0.03, 0.12, -0.08],
  },
  explainRight: {
    left: REST_L,
    right: { target: [-0.17, 0.04, 0.17], pole: [-0.3, -0.3, -0.1], wrist: [0, 1.2, 0.9], open: 1 },
    chest: [0.02, -0.05, -0.01],
    head: [0.02, -0.1, 0.05],
  },
  // Hands clasped behind the back with a gentle forward lean.
  behindBack: {
    left: { target: [0.075, -0.13, -0.2], pole: [0.16, -0.1, -0.5], wrist: [0, 0, 0], open: 0 },
    right: { target: [-0.075, -0.13, -0.2], pole: [-0.16, -0.1, -0.5], wrist: [0, 0, 0], open: 0 },
    chest: [0.075, 0, 0],
    head: [-0.04, 0, 0.03],
  },
  openBoth: {
    left: { target: [0.19, -0.02, 0.15], pole: [0.3, -0.3, -0.1], wrist: [0, -1.1, -0.8], open: 1 },
    right: {
      target: [-0.19, -0.02, 0.15],
      pole: [-0.3, -0.3, -0.1],
      wrist: [0, 1.1, 0.8],
      open: 1,
    },
    chest: [-0.015, 0, 0],
    head: [0.02, 0, 0],
  },
  thinking: {
    left: REST_L,
    right: { target: [-0.03, 0.28, 0.1], pole: [-0.25, -0.35, 0], wrist: [0, 0, 0], open: 0 },
    chest: [0.02, 0.04, 0],
    head: [-0.12, 0.16, 0.08],
  },
};

const SPEAKING_GESTURES: GestureName[] = [
  "presentLeft",
  "explainRight",
  "behindBack",
  "openBoth",
  "handOnChest",
];

export const AVATAR_TUNING = {
  noiseGate: 0.012,
  gainFloor: 0.06,
  peakDecayPerSecond: 0.18,
  /** Mouth envelope (seconds). */
  mouthAttack: 0.025,
  mouthRelease: 0.09,
  /** Voice gate for phrase detection. */
  voicedOn: 0.18,
  voicedOff: 0.08,
  /** A silence this long while speaking counts as a phrase boundary. */
  phrasePause: 0.35,
  /** A gesture is held at least this long. */
  minHold: 1.6,
  /** Long unbroken speech still changes gesture after this long. */
  maxHold: 7,
  /** Output must be absent this long while speaking before the synthetic mouth takes over. */
  syntheticAfter: 0.25,
  syllableRate: 4.3,
} as const;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const alpha = (dt: number, tau: number) => 1 - Math.exp(-dt / Math.max(1e-4, tau));

/** Small seeded PRNG (mulberry32) so behaviour is reproducible in tests. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Critically-damped-ish spring on a number (semi-implicit Euler, sub-stepped). */
class Spring {
  value: number;
  velocity = 0;
  private hz: number;
  private damping: number;
  constructor(value: number, hz: number, damping: number) {
    this.value = value;
    this.hz = hz;
    this.damping = damping;
  }
  step(target: number, dt: number) {
    const w = 2 * Math.PI * this.hz;
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / n;
    for (let i = 0; i < n; i += 1) {
      const accel = w * w * (target - this.value) - 2 * this.damping * w * this.velocity;
      this.velocity += accel * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }
}

class Spring3 {
  private s: [Spring, Spring, Spring];
  constructor(v: Vec3, hz: number, damping: number) {
    this.s = [
      new Spring(v[0], hz, damping),
      new Spring(v[1], hz, damping),
      new Spring(v[2], hz, damping),
    ];
  }
  step(t: Vec3, dt: number): Vec3 {
    return [this.s[0].step(t[0], dt), this.s[1].step(t[1], dt), this.s[2].step(t[2], dt)];
  }
  get value(): Vec3 {
    return [this.s[0].value, this.s[1].value, this.s[2].value];
  }
}

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];

type HandSprings = { target: Spring3; pole: Spring3; wrist: Spring3; open: Spring };

function handSprings(h: Gesture["left"], hz: number): HandSprings {
  return {
    target: new Spring3(h.target, hz, 0.78),
    pole: new Spring3(h.pole, hz * 0.8, 1),
    wrist: new Spring3(h.wrist, hz * 1.1, 0.85),
    open: new Spring(h.open, hz * 1.4, 1),
  };
}

export class AvatarDynamics {
  private random: () => number;
  private clock = 0;
  private peak = 0;
  private env = 0;
  private voiced = false;
  private silentFor = 0;
  private voicedFor = 0;
  private sinceOutput = 999;
  /** True once any real playback level arrived during the current speaking turn. */
  private heardThisTurn = false;
  private syllableShape = 0.5;
  private shapeTarget = 0.5;
  private lastRise = false;
  private nod = 0;
  private gesture: GestureName = "rest";
  private held = 0;
  private lastMode: AvatarMode = "idle";
  private listenFlip = 0;
  private nextBlink: number;
  private blinkT = -1;
  // Delayed targets give the overlapping action: chest first, head, then hands.
  private pending: { at: number; apply: () => void }[] = [];
  private chestTarget: Vec3 = [0, 0, 0];
  private headTarget: Vec3 = [0, 0, 0];
  private leftTarget: Gesture["left"] = REST_L;
  private rightTarget: Gesture["right"] = REST_R;

  private hips = new Spring3([0, 0, 0], 1.2, 0.9);
  private chest = new Spring3([0, 0, 0], 1.8, 0.85);
  private head = new Spring3([0, 0, 0], 2.4, 0.8);
  private pony1 = new Spring3([0, 0, 0], 1.6, 0.42);
  private pony2 = new Spring3([0, 0, 0], 1.3, 0.38);
  private left = handSprings(REST_L, 1.9);
  private right = handSprings(REST_R, 1.9);
  private mouthOpen = new Spring(0, 9, 0.9);
  private smile = new Spring(0.35, 2, 1);
  private prevHead: Vec3 = [0, 0, 0];

  constructor(seed = 1) {
    this.random = rng(seed);
    this.nextBlink = 1.5 + this.random() * 3;
  }

  get currentGesture() {
    return this.gesture;
  }

  /** Normalises Rita's level against her recent peak so quiet and loud voices both move the mouth. */
  private normalise(level: number, dt: number) {
    const t = AVATAR_TUNING;
    const gated = level < t.noiseGate ? 0 : clamp01(level);
    this.peak = Math.max(this.peak * Math.exp(-t.peakDecayPerSecond * dt), gated, t.gainFloor);
    return clamp01(gated / this.peak);
  }

  private setGesture(name: GestureName, reduced: boolean) {
    this.gesture = name;
    this.held = 0;
    const g = GESTURES[reduced && name !== "rest" && name !== "handOnChest" ? "handOnChest" : name];
    // Torso leads, head follows ~60 ms later, hands ~120 ms later.
    this.chestTarget = g.chest;
    this.pending = this.pending.filter((p) => p.at <= this.clock);
    this.pending.push({ at: this.clock + 0.06, apply: () => (this.headTarget = g.head) });
    this.pending.push({
      at: this.clock + 0.12,
      apply: () => {
        this.leftTarget = g.left;
        this.rightTarget = g.right;
      },
    });
  }

  private pickSpeakingGesture() {
    const options = SPEAKING_GESTURES.filter((g) => g !== this.gesture);
    return options[Math.floor(this.random() * options.length)] ?? "presentLeft";
  }

  step(dt: number, telemetry: AvatarTelemetry): AvatarPose {
    const t = AVATAR_TUNING;
    const step = Math.min(0.1, Math.max(0, dt));
    const reduced = Boolean(telemetry.reducedMotion);
    this.clock += step;
    this.held += step;

    // ------------------------------------------------------------ voice envelope
    const speaking = telemetry.mode === "speaking";
    const level = this.normalise(speaking ? telemetry.output : 0, step);
    if (!speaking || telemetry.mode !== this.lastMode) this.heardThisTurn = false;
    if (level > 0.05) {
      this.sinceOutput = 0;
      this.heardThisTurn = true;
    } else this.sinceOutput += step;

    let drive = level;
    // No level at all in this speaking turn (sound blocked, level not reported):
    // fall back to a gentle syllable rhythm so the mouth never freezes. Once real
    // levels arrive, silences are real pauses and the mouth closes in them.
    if (speaking && !this.heardThisTurn && this.sinceOutput > t.syntheticAfter) {
      const s = Math.sin(
        this.clock * 2 * Math.PI * t.syllableRate + Math.sin(this.clock * 1.7) * 1.3,
      );
      drive = clamp01(0.15 + 0.45 * Math.max(0, s));
    }
    const prevEnv = this.env;
    this.env += (drive - this.env) * alpha(step, drive > this.env ? t.mouthAttack : t.mouthRelease);

    // Syllable onsets pick a new mouth shape and give the head a small beat.
    const rising = this.env > prevEnv + 0.002 && this.env > 0.25;
    if (rising && !this.lastRise) {
      this.shapeTarget = this.random();
      if (!reduced && this.env > 0.55) this.nod = Math.min(1, this.nod + 0.6);
    }
    this.lastRise = rising;
    this.syllableShape += (this.shapeTarget - this.syllableShape) * alpha(step, 0.07);
    this.nod *= Math.exp(-step / 0.18);

    this.voiced = this.voiced ? this.env > t.voicedOff : this.env > t.voicedOn;
    if (this.voiced) {
      this.voicedFor += step;
      this.silentFor = 0;
    } else {
      this.silentFor += step;
      if (this.silentFor > t.phrasePause) this.voicedFor = 0;
    }

    // ------------------------------------------------------------ gesture director
    if (telemetry.mode !== this.lastMode) {
      const next: GestureName =
        telemetry.mode === "speaking"
          ? this.pickSpeakingGesture()
          : telemetry.mode === "thinking"
            ? "thinking"
            : telemetry.mode === "listening"
              ? "handOnChest"
              : "rest";
      this.setGesture(reduced && next !== "rest" ? "handOnChest" : next, reduced);
      this.lastMode = telemetry.mode;
    } else if (speaking && !reduced) {
      const boundary = this.silentFor > t.phrasePause && this.silentFor - step <= t.phrasePause;
      if ((boundary && this.held >= t.minHold) || this.held >= t.maxHold) {
        this.setGesture(this.pickSpeakingGesture(), reduced);
      }
    } else if (telemetry.mode === "listening" && !reduced) {
      // While listening, now and then settle between hand-on-chest and a relaxed rest.
      this.listenFlip += step;
      if (this.listenFlip > 8 + this.random() * 5) {
        this.listenFlip = 0;
        this.setGesture(this.gesture === "handOnChest" ? "rest" : "handOnChest", reduced);
      }
    }
    for (const p of this.pending) if (p.at <= this.clock) p.apply();
    this.pending = this.pending.filter((p) => p.at > this.clock);

    // ------------------------------------------------------------ body springs
    const calm = reduced ? 0 : 1;
    const breathe = Math.sin(this.clock * 2 * Math.PI * 0.24);
    const sway = Math.sin(this.clock * 2 * Math.PI * 0.11) * calm;
    const listeningLean = telemetry.mode === "listening" ? 0.02 : 0;
    const hips = this.hips.step([0, sway * 0.02, sway * 0.012], step);
    const chest = this.chest.step(
      add(this.chestTarget, [
        breathe * 0.01 * (reduced ? 0.4 : 1) + listeningLean,
        0,
        -sway * 0.008,
      ]),
      step,
    );
    const drift: Vec3 = [
      Math.sin(this.clock * 0.53) * 0.015 * calm,
      Math.sin(this.clock * 0.37 + 1) * 0.03 * calm,
      Math.sin(this.clock * 0.29 + 2) * 0.012 * calm,
    ];
    const listenTilt: Vec3 = telemetry.mode === "listening" ? [0.02, 0, -0.07 * calm] : [0, 0, 0];
    const head = this.head.step(
      add(add(this.headTarget, drift), add(listenTilt, [this.nod * 0.05, 0, 0])),
      step,
    );

    // Ponytail trails the head: it is pushed opposite to the head's angular velocity.
    const headVel = scale(
      [head[0] - this.prevHead[0], head[1] - this.prevHead[1], head[2] - this.prevHead[2]],
      1 / Math.max(step, 1e-3),
    );
    this.prevHead = head;
    const trail = reduced ? 0 : 1;
    const pony1 = this.pony1.step(
      [
        -headVel[0] * 0.06 * trail,
        -headVel[1] * 0.05 * trail,
        -headVel[2] * 0.08 * trail - chest[2] * 0.3,
      ],
      step,
    );
    const pony2 = this.pony2.step(
      [pony1[0] * 0.8, pony1[1] * 0.6, pony1[2] * 1.2 + Math.sin(this.clock * 1.1) * 0.012 * trail],
      step,
    );

    const beat = this.nod * 0.012;
    const hand = (springs: HandSprings, h: Gesture["left"]): HandPose => ({
      target: springs.target.step(add(h.target, [0, -beat, 0]), step),
      pole: springs.pole.step(h.pole, step),
      wrist: springs.wrist.step(h.wrist, step),
      open: clamp01(springs.open.step(h.open, step)),
    });
    const left = hand(this.left, this.leftTarget);
    const right = hand(this.right, this.rightTarget);

    // ------------------------------------------------------------ face
    const open = clamp01(this.mouthOpen.step(Math.pow(this.env, 0.85), step));
    const smile = this.smile.step(
      speaking ? 0.12 : telemetry.mode === "thinking" ? 0.05 : 0.38,
      step,
    );

    let blink = 0;
    if (this.blinkT < 0 && this.clock >= this.nextBlink) this.blinkT = 0;
    if (this.blinkT >= 0) {
      this.blinkT += step;
      const close = 0.06;
      const reopen = 0.09;
      blink =
        this.blinkT < close ? this.blinkT / close : clamp01(1 - (this.blinkT - close) / reopen);
      if (this.blinkT > close + reopen) {
        this.blinkT = -1;
        // Occasionally a quick double blink.
        this.nextBlink = this.clock + (this.random() < 0.15 ? 0.25 : 2.5 + this.random() * 3);
      }
    }

    return {
      root: { y: breathe * 0.0015 * (reduced ? 0.4 : 1), yaw: 0 },
      hips,
      chest,
      neck: scale(head, 0.35),
      head: scale(head, 0.65),
      pony1,
      pony2,
      left,
      right,
      mouth: {
        open: open * (0.55 + 0.45 * (1 - Math.abs(this.syllableShape - 0.5) * 2)),
        wide: open * clamp01(1 - this.syllableShape * 1.6) * 0.8,
        round: open * clamp01(this.syllableShape * 1.6 - 0.6) * 0.9,
        smile,
      },
      blink,
      gesture: this.gesture,
      voice: this.env,
    };
  }
}
