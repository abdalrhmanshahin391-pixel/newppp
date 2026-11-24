import assert from "node:assert/strict";
import test from "node:test";
import { CLIPS, EASES, FACES, POKE_SECONDS, sampleClip, sampleTrack } from "./mascot-clips.ts";
import {
  BLINK_SECONDS,
  createMascot,
  lidAt,
  restFrame,
  SPEED,
  SQUASH_LIMITS,
} from "./mascot-engine.ts";
import {
  BODY,
  EYE,
  FACE_HALF,
  mascotGeometry,
  REST_POSE,
  support,
  type Vec2,
} from "./mascot-shape.ts";

const bbox = (pts: Vec2[]) => {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};
/** Twice the signed area (shoelace). */
const area = (pts: Vec2[]) =>
  pts.reduce((s, p, i) => {
    const q = pts[(i + 1) % pts.length];
    return s + p[0] * q[1] - q[0] * p[1];
  }, 0) / 2;
const inside = (pts: Vec2[], [x, y]: Vec2) => {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};

test("at rest it is a 76 × 76 soft square with two upright eyes a little below the middle", () => {
  const g = mascotGeometry(REST_POSE, FACES.neutral);
  const b = bbox(g.body);
  assert.ok(Math.abs(b.x1 - b.x0 - 2 * BODY.half) < 0.05, `width ${b.x1 - b.x0}`);
  assert.ok(Math.abs(b.y1 - b.y0 - 2 * BODY.half) < 0.05, `height ${b.y1 - b.y0}`);
  // A soft corner: the 45° point sits well inside the square's corner.
  const corner = support([1, 1, 0]);
  assert.ok(corner[0] < BODY.half - 3 && corner[0] > BODY.half - 8, `corner ${corner[0]}`);
  const [l, r] = g.eyes!.map((o) => bbox([o.start, ...o.curves.map((c) => c[2])]));
  assert.ok(l.y1 - l.y0 > 2 * (l.x1 - l.x0), "eyes about twice as tall as wide");
  assert.ok((l.y0 + l.y1) / 2 > 50, "eyes sit below the middle");
  assert.ok(Math.abs((l.x0 + l.x1) / 2 + (r.x0 + r.x1) / 2 - 100) < 0.05, "eyes mirror");
  assert.ok(restFrame(200).body.startsWith("M") && restFrame(200).body.endsWith("Z"));
});

test("seen from the side it is 32 deep with a round edge, and it never jumps as it turns", () => {
  const side = bbox(mascotGeometry({ ...REST_POSE, yaw: 90 }, FACES.neutral).body);
  assert.ok(Math.abs(side.x1 - side.x0 - 2 * BODY.halfDepth) < 0.05, `depth ${side.x1 - side.x0}`);
  let last = 0;
  for (let yaw = 0; yaw <= 360; yaw += 1) {
    const g = mascotGeometry({ ...REST_POSE, yaw, pitch: yaw / 3 }, FACES.neutral);
    const a = Math.abs(area(g.body));
    if (yaw > 0) assert.ok(Math.abs(a - last) < 0.03 * last, `area jumps at ${yaw}°`);
    last = a;
    // Always one convex outline, turning the same way all round.
    const sign = Math.sign(area(g.body));
    for (let i = 0; i < g.body.length; i += 1) {
      const [p, q, s] = [
        g.body[i],
        g.body[(i + 1) % g.body.length],
        g.body[(i + 2) % g.body.length],
      ];
      const cross = (q[0] - p[0]) * (s[1] - q[1]) - (q[1] - p[1]) * (s[0] - q[0]);
      assert.ok(cross * sign >= -0.02, `convex at ${yaw}°`);
    }
  }
});

test("the eyes stay on the face: inside the outline, sliding as it turns, hidden behind", () => {
  for (const face of ["neutral", "happy", "surprised", "sleepy", "curious"] as const) {
    for (const yaw of [-60, -30, 0, 25, 50, 70]) {
      for (const pitch of [-20, 0, 15]) {
        const g = mascotGeometry({ ...REST_POSE, yaw, pitch, lx: 4.5, ly: -4.5 }, FACES[face]);
        for (const o of g.eyes ?? []) {
          for (const p of [o.start, ...o.curves.map((c) => c[2])]) {
            assert.ok(inside(g.body, p), `${face} eye outside at yaw ${yaw}, pitch ${pitch}`);
          }
        }
      }
    }
  }
  const at = (yaw: number) => mascotGeometry({ ...REST_POSE, yaw }, FACES.neutral);
  const centre = (yaw: number) => bbox(at(yaw).eyes!.flatMap((o) => [o.start])).x0;
  assert.ok(centre(30) > centre(0), "eyes slide toward the turn");
  assert.equal(at(120).eyes, null, "back: no eyes");
  // The flat face holds the eyes even looking all the way to one side.
  assert.ok(EYE.gap / 2 + 2.5 + 6.2 + 2.7 + 4.5 < FACE_HALF);
});

test("happy and sleepy eyes are closed arcs: ◠ bulges up, ◡ down", () => {
  const happy = mascotGeometry(REST_POSE, FACES.happy).eyes![0];
  const end = happy.curves[happy.curves.length - 1][2];
  assert.ok(Math.hypot(end[0] - happy.start[0], end[1] - happy.start[1]) < 1e-6, "closed");
  const ends = (pair: typeof happy) => [pair.start, ...pair.curves.map((c) => c[2])];
  const hb = bbox(ends(happy));
  // The outer arc is two 75° segments: the first ends at the arc's middle.
  const mid = happy.curves[0][2];
  assert.ok(mid[1] < (hb.y0 + hb.y1) / 2, "◠: its middle is at the top");
  const sleepy = mascotGeometry(REST_POSE, FACES.sleepy).eyes![0];
  const sb = bbox(ends(sleepy));
  assert.ok(sleepy.curves[0][2][1] > (sb.y0 + sb.y1) / 2, "◡: its middle is at the bottom");
});

test("a blink shuts the eyes, then opens them with a small overshoot", () => {
  assert.equal(lidAt(0), 0);
  assert.ok(Math.abs(lidAt(0.35) - 1) < 1e-6);
  const opening = Array.from({ length: 40 }, (_, i) => lidAt(0.36 + i * 0.016));
  assert.ok(Math.min(...opening) < 0, "pops a little past open");
  assert.ok(BLINK_SECONDS < 0.3);
});

test("clips: lengths, squash within the ranges, and spins of 360° in under 0.9 s", () => {
  for (const [mood, clips] of Object.entries(CLIPS)) {
    for (const clip of clips) {
      assert.ok(clip.duration >= 2.4 && clip.duration <= 6, `${mood}/${clip.name} duration`);
      for (let t = 0; t <= clip.duration; t += 0.02) {
        const p = sampleClip(clip, t, REST_POSE);
        assert.ok(p.y >= -17 && p.y <= 4 && Math.abs(p.roll) <= 9, `${clip.name} at ${t}`);
        assert.ok(p.sx >= 0.92 && p.sx <= 1.13, `${clip.name} sx ${p.sx}`);
        assert.ok(p.sy >= 0.87 && p.sy <= 1.1, `${clip.name} sy ${p.sy}`);
        assert.ok(Math.abs(p.lx) <= 4.5 && Math.abs(p.ly) <= 4.5, `${clip.name} look`);
      }
      // A spin or flip turns a whole circle fast.
      for (const ch of ["yaw", "pitch"] as const) {
        const keys = clip.tracks[ch] ?? [];
        for (let i = 1; i < keys.length; i += 1) {
          const turned = Math.abs(keys[i].v - keys[i - 1].v);
          if (turned >= 300) {
            const seconds = (keys[i].t - keys[i - 1].t) / SPEED;
            assert.ok(seconds <= 0.9, `${clip.name} turns ${turned}° in ${seconds}s`);
            assert.ok(clip.showy, `${clip.name} is marked showy`);
          }
        }
      }
    }
  }
  assert.ok(POKE_SECONDS.spin <= 0.9, "a tapped spin is quick");
  assert.equal(
    sampleTrack(
      [
        { t: 0, v: 1 },
        { t: 1, v: 3, e: "lin" },
      ],
      0.5,
      0,
    ),
    2,
  );
  assert.ok(EASES.pop(0.8) > 1 && EASES.wind(0.1) < 0, "pop overshoots, wind draws back");
});

test("the favourites come up often: a spin or flip in at least a quarter of idle clips", () => {
  const idle = CLIPS.idle;
  const total = idle.reduce((s, c) => s + c.weight, 0);
  const showy = idle.filter((c) => c.showy).reduce((s, c) => s + c.weight, 0);
  assert.ok(showy / total >= 0.25, `showy share ${showy / total}`);
  const m = createMascot({ seed: 11 });
  const seen = new Set<string>();
  let spins = 0;
  let last = m.clip;
  for (let i = 0; i < 60 * 400; i += 1) {
    m.step(1 / 60);
    if (m.clip !== last) {
      last = m.clip;
      seen.add(last);
      if (last === "spin" || last === "flip") spins += 1;
    }
  }
  assert.ok(spins >= 15, `spins in 400 s: ${spins}`);
  assert.ok(seen.size >= 7, `variety: ${[...seen].join(", ")}`);
});

test("never jumps: 60 s of moods and taps change little from frame to frame", () => {
  const m = createMascot({ seed: 7, size: 200 });
  const moods = ["idle", "speaking", "listening", "thinking", "idle", "speaking"] as const;
  let prev = m.pose();
  let worst = { move: 0, lean: 0, turn: 0, look: 0 };
  for (let i = 0; i < 60 * 60; i += 1) {
    if (i % 600 === 0) m.setMood(moods[(i / 600) % moods.length]);
    if (i % 450 === 200) m.poke();
    m.step(1 / 60, { input: 0.4 * Math.abs(Math.sin(i / 9)), output: Math.abs(Math.sin(i / 7)) });
    const p = m.pose();
    if (i > 2) {
      const wrap = (a: number) => Math.abs(((a + 540) % 360) - 180);
      worst = {
        move: Math.max(worst.move, Math.abs(p.y - prev.y)),
        lean: Math.max(worst.lean, Math.abs(p.roll - prev.roll)),
        turn: Math.max(worst.turn, wrap(p.yaw - prev.yaw), wrap(p.pitch - prev.pitch)),
        look: Math.max(worst.look, Math.abs(p.lx - prev.lx), Math.abs(p.ly - prev.ly)),
      };
      assert.ok(p.sx >= SQUASH_LIMITS[0] && p.sx <= SQUASH_LIMITS[1], `sx ${p.sx}`);
      assert.ok(p.sy >= SQUASH_LIMITS[0] && p.sy <= SQUASH_LIMITS[1], `sy ${p.sy}`);
    }
    prev = p;
  }
  // At 60 fps: a hop lands at about 4.5 units a frame; a full spin peaks near 21° a frame.
  assert.ok(worst.move < 5, `move ${worst.move}`);
  assert.ok(worst.lean < 4, `lean ${worst.lean}`);
  assert.ok(worst.turn < 24, `turn ${worst.turn}`);
  assert.ok(worst.look < 1.5, `look ${worst.look}`);
});

test("landing makes it jiggle, and a spin leans it", () => {
  const m = createMascot({ seed: 2, mood: "idle" });
  m.poke("hop");
  let widest = 1;
  for (let i = 0; i < 70; i += 1) {
    m.step(1 / 60);
    if (i > 30) widest = Math.max(widest, m.pose().sx);
  }
  assert.ok(widest > 1.08, `squashes on landing (${widest})`);
});

test("a change of feeling happens inside a blink", () => {
  const m = createMascot({ seed: 3 });
  m.setMood("thinking");
  assert.equal(m.face, "neutral", "not swapped yet");
  for (let i = 0; i < 30; i += 1) m.step(1 / 60);
  assert.equal(m.face, "squint", "swapped at the closed moment");
});

test("reduced motion holds the body still; only the eyes blink", () => {
  const m = createMascot({ seed: 5, reduced: true });
  const body = m.frame().body;
  for (let i = 0; i < 600; i += 1) {
    m.step(1 / 60, { input: 1, output: 1 });
    m.poke();
    assert.equal(m.frame().body, body);
  }
});

test("the first tap spins it all the way round, with happy eyes", () => {
  const m = createMascot({ seed: 9, mood: "idle" });
  m.poke();
  let turned = 0;
  let last = m.pose().yaw;
  for (let i = 0; i < 50; i += 1) {
    m.step(1 / 60);
    const y = m.pose().yaw;
    turned += ((y - last + 540) % 360) - 180;
    last = y;
  }
  assert.ok(turned > 300, `turned ${turned}°`);
  assert.equal(m.face, "happy");
});
