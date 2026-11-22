/**
 * Uzyra's cube, alive: it plays its clips, blends between them, blinks, follows the pointer with
 * its eyes and then its body, reacts to taps, and moves with the voices in a conversation. Each
 * frame it gives two things to draw: the block's outline and its two eyes, as SVG paths in the
 * 100 × 100 logo box. Pure (no DOM), so it is the same on the server and in tests.
 */

import { OrbDynamics } from "../../rita-live/orb-dynamics.ts";
import {
  CLIPS,
  MOOD_FACE,
  REST,
  sampleClip,
  type Clip,
  type Mood,
  type Pose,
} from "./cube-clips.ts";
import { eyeOutline, FacePlayer, type FaceName } from "./cube-faces.ts";
import {
  cubicBezier,
  facing,
  HALF,
  lerp,
  nearestAngle,
  onFace,
  rotation,
  seeded,
  silhouette,
  Spring,
  UNIT,
  type Vec2,
} from "./cube-math.ts";

export type Poke = "hop" | "spin" | "wiggle" | "nod" | "perk";
export type CubeFrame = { body: string; eyes: [string, string] | null };

const BRIDGE_SECONDS = 0.42;
const BRIDGE = cubicBezier(0.4, 0, 0.2, 1);
const POKE_SECONDS: Record<Poke, number> = {
  hop: 0.66,
  spin: 1.05,
  wiggle: 0.8,
  nod: 0.55,
  perk: 0.4,
};
const TAP_ORDER: Poke[] = ["hop", "spin", "wiggle", "nod"];
const SPIN = cubicBezier(0.55, -0.3, 0.2, 1);

/** sin² bump from a to b (0 outside): a soft rise and fall. */
function bump(p: number, a: number, b: number) {
  if (p <= a || p >= b) return 0;
  const s = Math.sin((Math.PI * (p - a)) / (b - a));
  return s * s;
}

function mixPose(a: Pose, b: Pose, t: number): Pose {
  return {
    rx: lerp(a.rx, b.rx, t),
    ry: lerp(a.ry, b.ry, t),
    rz: lerp(a.rz, b.rz, t),
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    sx: lerp(a.sx, b.sx, t),
    sy: lerp(a.sy, b.sy, t),
    s: lerp(a.s, b.s, t),
    lx: lerp(a.lx, b.lx, t),
    ly: lerp(a.ly, b.ly, t),
  };
}

/** A pose's angles moved by whole turns next to the angles it will blend into. */
function unwrapNear(p: Pose, near: Pose): Pose {
  return {
    ...p,
    rx: nearestAngle(p.rx, near.rx),
    ry: nearestAngle(p.ry, near.ry),
    rz: nearestAngle(p.rz, near.rz),
  };
}

export type CubeOptions = { seed?: number; reduced?: boolean; size?: number; mood?: Mood };

export function createCube(options: CubeOptions = {}) {
  const rand = seeded(options.seed ?? 1);
  const between = (a: number, b: number) => a + rand() * (b - a);
  let reduced = options.reduced ?? false;
  let mood: Mood = options.mood ?? "idle";
  const face = new FacePlayer(MOOD_FACE[mood]);
  const dynamics = new OrbDynamics();

  // Drawing detail follows the drawn size.
  let samples = 40;
  let decimals = 2;
  const setSize = (px: number) => {
    samples = Math.round(Math.min(44, Math.max(14, px / 6)));
    decimals = px >= 96 ? 2 : 1;
  };
  setSize(options.size ?? 200);

  // ---- Clips: a shuffled round of the mood's clips, never the same one twice in a row.
  let bag: Clip[] = [];
  let lastClip: Clip | null = null;
  const nextClip = (): Clip => {
    if (bag.length === 0) {
      const pool = CLIPS[mood];
      // Weighted: a clip with weight 2 comes up about twice as often (rare ones sometimes skip a round).
      bag = pool.filter((clip) => clip.weight >= 1 || rand() < clip.weight);
      for (const clip of pool) if (clip.weight >= 2 && rand() < clip.weight - 1.5) bag.push(clip);
      for (let i = bag.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rand() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      if (bag.length > 1 && bag[0] === lastClip) bag.push(bag.shift() as Clip);
    }
    const clip = bag.shift() as Clip;
    lastClip = clip;
    return clip;
  };

  /** Rest between clips: a short pause, longer when idle. */
  const restClip = (): Clip => ({
    name: "pause",
    duration: mood === "idle" ? between(0.4, 1.4) : between(0.15, 0.6),
    weight: 0,
  });

  let clip: Clip = restClip();
  let clipT = 0;
  let firedFace = 0;
  let firedBlink = 0;
  let bridgeFrom: Pose | null = null;
  let bridgeT = 0;
  let base: Pose = REST;
  let playingRest = true;

  const start = (next: Clip) => {
    bridgeFrom = unwrapNear(base, sampleClip(next, 0));
    bridgeT = 0;
    clip = next;
    clipT = 0;
    firedFace = 0;
    firedBlink = 0;
  };

  // ---- Blinks.
  let nextBlink = between(1.2, 3.2);
  let clock = 0;

  // ---- Pointer: eyes lead, the body follows.
  let gazeAt: Vec2 | null = null;
  let gazeSeen = -10;
  const hold = new Spring(0, 7, 1);
  const lookX = new Spring(0, 34, 0.85);
  const lookY = new Spring(0, 34, 0.85);
  const headX = new Spring(0, 10, 0.78);
  const headY = new Spring(0, 10, 0.78);

  // ---- Taps and changes of mood.
  let pokes: { kind: Poke; t: number }[] = [];
  let taps = 0;
  let faceHold = 0;
  let faceHoldName: FaceName | null = null;

  // ---- Voices.
  const lift = new Spring(0, 15, 0.42);
  const stretch = new Spring(0, 18, 0.35);
  const nod = new Spring(0, 12, 0.5);
  let voice = 0;
  let beatReady = true;
  let wasVoiced = false;

  let listenPress = 0;

  const faceFor = (name: FaceName | "base"): FaceName => (name === "base" ? MOOD_FACE[mood] : name);

  const api = {
    get mood() {
      return mood;
    },
    setMood(next: Mood) {
      if (next === mood) return;
      mood = next;
      bag = [];
      if (reduced) {
        face.set(MOOD_FACE[mood]);
        return;
      }
      face.set(MOOD_FACE[mood]);
      start(nextClip());
      playingRest = false;
      pokes.push({ kind: "perk", t: 0 });
    },
    setReduced(value: boolean) {
      reduced = value;
      if (reduced) {
        pokes = [];
        base = REST;
        bridgeFrom = null;
      }
    },
    setSize,
    /** Pointer position around the cube, each axis about −1..1 (x right, y up), or null when gone. */
    gaze(at: Vec2 | null) {
      gazeAt = at;
      if (at) gazeSeen = clock;
    },
    poke(kind?: Poke) {
      if (reduced) return;
      const chosen = kind ?? TAP_ORDER[taps++ % TAP_ORDER.length];
      if (pokes.some((p) => p.kind === chosen)) return;
      pokes.push({ kind: chosen, t: 0 });
      if (chosen !== "perk") {
        faceHoldName = chosen === "nod" ? "attentive" : "happy";
        // Held a little past the move, so quick taps in a row keep the same happy face.
        faceHold = POKE_SECONDS[chosen] + 0.9;
        face.set(faceHoldName);
      }
    },
    /** Moves time on by dt seconds. Levels are the raw microphone and voice levels, 0..1. */
    step(dt: number, levels: { input: number; output: number } = { input: 0, output: 0 }) {
      const step = Math.min(0.1, Math.max(0, dt));
      clock += step;

      // Blinks happen even with reduced motion: they are small and keep it alive.
      if (clock >= nextBlink) {
        face.blink();
        nextBlink = clock + (rand() < 0.22 ? 0.3 : between(2.4, 5.6));
      }
      face.step(step);
      if (reduced) return;

      // Clips.
      clipT += step;
      if (clip.face) {
        while (firedFace < clip.face.length && clip.face[firedFace].t <= clipT) {
          if (faceHold <= 0) face.set(faceFor(clip.face[firedFace].name));
          firedFace += 1;
        }
      }
      if (clip.blinks) {
        while (firedBlink < clip.blinks.length && clip.blinks[firedBlink] <= clipT) {
          face.blink();
          firedBlink += 1;
        }
      }
      if (clipT >= clip.duration) {
        if (playingRest) start(nextClip());
        else start(restClip());
        playingRest = !playingRest;
      }
      if (bridgeFrom) {
        bridgeT += step;
        if (bridgeT >= BRIDGE_SECONDS) bridgeFrom = null;
      }

      // Taps.
      for (const poke of pokes) poke.t += step;
      pokes = pokes.filter((poke) => poke.t < POKE_SECONDS[poke.kind]);
      if (faceHold > 0) {
        faceHold -= step;
        if (faceHold <= 0) {
          faceHoldName = null;
          face.set(MOOD_FACE[mood]);
        }
      }

      // Pointer: active while it keeps moving; after a few still seconds it lets go.
      const following = gazeAt !== null && clock - gazeSeen < 2.8;
      hold.target = following ? 1 : 0;
      hold.step(step);
      const [gx, gy] = following && gazeAt ? gazeAt : [0, 0];
      lookX.target = gx * 0.045;
      lookY.target = gy * 0.034;
      headY.target = gx * 22;
      headX.target = -gy * 15;
      lookX.step(step);
      lookY.step(step);
      headX.step(step);
      headY.step(step);

      // Voices.
      if (mood === "speaking") {
        const target = Math.min(1, levels.output * 1.5);
        voice += (target - voice) * (1 - Math.exp(-step / (target > voice ? 0.03 : 0.12)));
        if (beatReady && voice > 0.42) {
          beatReady = false;
          lift.kick(1.5);
          stretch.kick(1.2);
        } else if (voice < 0.2) {
          beatReady = true;
        }
      } else {
        voice += (0 - voice) * (1 - Math.exp(-step / 0.12));
      }
      const heard = dynamics.step(step, { input: levels.input, output: levels.output, mode: mood });
      if (mood === "listening" && heard.voiced && !wasVoiced) nod.kick(70);
      wasVoiced = heard.voiced;
      lift.step(step);
      stretch.step(step);
      nod.step(step);
      listenPress = mood === "listening" ? heard.pulse : 0;
    },
    /** The pose being drawn now (after clips, pointer, taps and voices). */
    pose(): Pose {
      if (reduced) return REST;
      let p = sampleClip(clip, clipT);
      if (bridgeFrom) p = mixPose(bridgeFrom, p, BRIDGE(Math.min(1, bridgeT / BRIDGE_SECONDS)));
      base = p;
      const w = hold.x;
      // Towards the pointer by the short way round, even in the middle of a full turn.
      p = {
        ...p,
        rx: lerp(p.rx, nearestAngle(headX.x, p.rx), 0.8 * w),
        ry: lerp(p.ry, nearestAngle(headY.x, p.ry), 0.8 * w),
        x: p.x + 0.03 * (headY.x / 22) * w,
        y: p.y + 0.02 * (-headX.x / 15) * w,
        lx: lerp(p.lx, lookX.x, w),
        ly: lerp(p.ly, lookY.x, w),
      };
      for (const poke of pokes) {
        const q = Math.min(1, poke.t / POKE_SECONDS[poke.kind]);
        if (poke.kind === "hop") {
          p.y += 0.26 * Math.sin(Math.PI * Math.min(1, Math.max(0, (q - 0.16) / 0.68)));
          const crouch = bump(q, 0, 0.2);
          const air = bump(q, 0.2, 0.78);
          const land = bump(q, 0.8, 1);
          p.sx *= 1 + 0.11 * crouch - 0.05 * air + 0.13 * land;
          p.sy *= 1 - 0.13 * crouch + 0.08 * air - 0.15 * land;
          p.rx += -7 * air + 5 * land;
        } else if (poke.kind === "spin") {
          // A small wind-up the other way, the turn, and a soft landing.
          p.ry += 360 * SPIN(q);
          p.y += 0.1 * Math.sin(Math.PI * q);
          p.sx *= 1 + 0.06 * bump(q, 0, 0.2) + 0.08 * bump(q, 0.82, 1);
          p.sy *= 1 - 0.07 * bump(q, 0, 0.2) - 0.09 * bump(q, 0.82, 1);
        } else if (poke.kind === "wiggle") {
          const fade = (1 - q) * (1 - q);
          p.rz += 11 * Math.sin(2 * Math.PI * 2.5 * q) * fade;
          p.sx *= 1 + 0.04 * Math.sin(2 * Math.PI * 5 * q) * fade;
          p.sy *= 1 - 0.04 * Math.sin(2 * Math.PI * 5 * q) * fade;
        } else if (poke.kind === "nod") {
          p.rx += 15 * bump(q, 0, 0.6) + 6 * bump(q, 0.55, 1);
        } else if (poke.kind === "perk") {
          p.s *= 1 + 0.055 * Math.sin(Math.PI * q);
          p.sy *= 1 + 0.04 * bump(q, 0, 0.7);
        }
      }
      // Voices: Uzyra's own hops and stretch; the learner's voice presses it down and it nods.
      p.y += Math.max(0, lift.x) * 0.06;
      p.sy *= 1 + 0.05 * voice + 0.03 * stretch.x;
      p.sx *= 1 - 0.035 * voice - 0.02 * stretch.x;
      p.sy *= 1 - 0.07 * listenPress;
      p.sx *= 1 + 0.05 * listenPress;
      p.rx += nod.x;
      // Breathing.
      const breath = Math.sin((2 * Math.PI * clock) / 3.6);
      p.sy *= 1 + 0.011 * breath;
      p.sx *= 1 - 0.007 * breath;
      return p;
    },
    frame(): CubeFrame {
      return draw(api.pose(), face, samples, decimals);
    },
  };
  return api;
}

export type Cube = ReturnType<typeof createCube>;

const BOTTOM = -HALF.h;

function draw(p: Pose, face: FacePlayer, samples: number, decimals: number): CubeFrame {
  const m = rotation(p.rx, p.ry, p.rz);
  const place = (x: number, y: number): Vec2 => {
    const sx = x * p.s * p.sx + p.x;
    const sy = BOTTOM + (y * p.s - BOTTOM) * p.sy + p.y;
    return [50 + sx * UNIT, 50 - sy * UNIT];
  };
  const toPath = (points: Vec2[]) => {
    let d = "";
    for (let i = 0; i < points.length; i += 1) {
      const [x, y] = points[i];
      d += (i === 0 ? "M" : "L") + x.toFixed(decimals) + " " + y.toFixed(decimals);
    }
    return d + "Z";
  };
  const body = toPath(silhouette(m, samples).map(([x, y]) => place(x, y)));
  // Nearly edge on, the eyes would be thin slivers at the rim: they are hidden instead.
  if (facing(m) < 0.2) return { body, eyes: null };
  const eyes = face.eyes().map((eye) =>
    toPath(
      eyeOutline({ ...eye, x: eye.x + p.lx, y: eye.y + p.ly }).map(([u, v]) => {
        const [x, y] = onFace(m, u, v);
        return place(x, y);
      }),
    ),
  ) as [string, string];
  return { body, eyes };
}

/** The cube at rest, for the first paint (the same on the server and in the browser). */
export function restFrame(size = 200): CubeFrame {
  return createCube({ size, reduced: true }).frame();
}
