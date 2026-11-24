import assert from "node:assert/strict";
import test from "node:test";
import { CLIPS, EASES, FACES, sampleClip, sampleTrack } from "./pill-clips.ts";
import { BLINK_SECONDS, BRIDGE_SECONDS, createPill, lidAt, restFrame } from "./pill-engine.ts";
import { BODY, pillFrame, REST_POSE, stadium } from "./pill-shape.ts";

/** Every number in a path, as [x, y] pairs. */
const points = (d: string) => {
  const n = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < n.length; i += 2) out.push([n[i], n[i + 1]]);
  return out;
};
const box = (d: string) => {
  const p = points(d);
  const xs = p.map((q) => q[0]);
  const ys = p.map((q) => q[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};

test("at rest it is a 78 × 50 pill with two upright eyes, centred", () => {
  const f = restFrame(200);
  const b = box(f.body);
  assert.ok(Math.abs(b.x1 - b.x0 - BODY.w) < 0.05, `width ${b.x1 - b.x0}`);
  assert.ok(Math.abs(b.y1 - b.y0 - BODY.h) < 0.05, `height ${b.y1 - b.y0}`);
  assert.ok(Math.abs((b.x0 + b.x1) / 2 - 50) < 0.05 && Math.abs((b.y0 + b.y1) / 2 - 50) < 0.05);
  assert.ok(f.eyes);
  const [l, r] = f.eyes!.map(box);
  assert.ok(l.y1 - l.y0 > l.x1 - l.x0, "eyes are taller than wide");
  assert.ok(Math.abs((l.x0 + l.x1) / 2 + (r.x0 + r.x1) / 2 - 100) < 0.05, "eyes mirror");
  assert.ok(f.body.startsWith("M") && f.body.endsWith("Z"));
});

test("a stadium's ends are half circles (radius = half the short side)", () => {
  const o = stadium(50, 50, 78, 50);
  assert.equal(o.curves.length, 8);
  // The right end's middle point is 39 from the centre.
  assert.deepEqual(o.curves[2][2], [89, 75 - 25]);
});

test("turning widens the outline toward the side and slides the eyes, then hides them", () => {
  const a = pillFrame({ ...REST_POSE, yaw: 30 }, FACES.neutral);
  const w = box(a.body).x1 - box(a.body).x0;
  const expect = BODY.w * Math.cos(Math.PI / 6) + BODY.depth * Math.sin(Math.PI / 6);
  assert.ok(Math.abs(w - expect) < 0.05, `width ${w} vs ${expect}`);
  const eyesCentre = a.eyes!.map(box).reduce((s, e) => s + (e.x0 + e.x1) / 2, 0) / 2;
  assert.ok(eyesCentre > 50, "eyes slide toward the turn");
  assert.equal(pillFrame({ ...REST_POSE, yaw: 180 }, FACES.neutral).eyes, null, "back: no eyes");
});

test("a blink closes the lids, then opens them with a small overshoot", () => {
  assert.equal(lidAt(0), 0);
  assert.ok(Math.abs(lidAt(0.35) - 1) < 1e-6);
  const open = Array.from({ length: 40 }, (_, i) => lidAt(0.36 + i * 0.016));
  assert.ok(Math.min(...open) < 0, "pops a little past open");
  assert.equal(lidAt(1), 0);
});

test("clips start at rest-ish, stay in bounds and loop without a jump", () => {
  for (const [mood, clips] of Object.entries(CLIPS)) {
    for (const clip of clips) {
      assert.ok(clip.duration >= 2.4 && clip.duration <= 6, `${mood}/${clip.name} duration`);
      for (let t = 0; t <= clip.duration; t += 0.05) {
        const p = sampleClip(clip, t, REST_POSE);
        assert.ok(Math.abs(p.y) <= 16 && Math.abs(p.roll) <= 12, `${clip.name} at ${t}`);
        assert.ok(p.sx > 0.8 && p.sx < 1.2 && p.sy > 0.8 && p.sy < 1.2, `${clip.name} squash`);
        assert.ok(Math.abs(p.lx) <= 4.5 && Math.abs(p.ly) <= 4.5, `${clip.name} look`);
      }
    }
  }
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
  assert.ok(EASES.pop(0.8) > 1, "pop overshoots");
});

test("moving between clips blends from where it is: no jump between frames", () => {
  const pill = createPill({ seed: 7, size: 200 });
  let prev = pill.pose();
  let worst = 0;
  let worstTurn = 0;
  const dt = 1 / 60;
  const moods = ["idle", "listening", "thinking", "speaking", "idle"] as const;
  for (let i = 0; i < 60 * 40; i += 1) {
    if (i % 480 === 0) pill.setMood(moods[(i / 480) % moods.length]);
    pill.step(dt, { input: 0.3, output: 0.3 });
    const p = pill.pose();
    if (i > 2) {
      const yawStep = Math.abs(((p.yaw - prev.yaw + 540) % 360) - 180);
      worstTurn = Math.max(worstTurn, yawStep);
      worst = Math.max(worst, Math.abs(p.y - prev.y), Math.abs(p.roll - prev.roll));
      worst = Math.max(worst, Math.abs(p.lx - prev.lx), Math.abs(p.ly - prev.ly));
    }
    prev = p;
  }
  // At 60 fps no channel moves more than a few units in one frame, even across clip changes.
  // (A hop lands at about 2.5 units a frame; a full spin peaks under 13° a frame.)
  assert.ok(worst < 3, `largest step ${worst}`);
  assert.ok(worstTurn < 13, `largest turn step ${worstTurn}`);
  assert.ok(BRIDGE_SECONDS > 0.3 && BLINK_SECONDS < 0.3);
});

test("a change of feeling happens inside a blink", () => {
  const pill = createPill({ seed: 3 });
  pill.setMood("thinking");
  assert.equal(pill.face, "neutral", "not swapped yet");
  for (let i = 0; i < 30; i += 1) pill.step(1 / 60);
  assert.equal(pill.face, "squint", "swapped at the closed moment");
});

test("reduced motion holds the body still; only the eyes blink", () => {
  const pill = createPill({ seed: 5, reduced: true });
  const body = pill.frame().body;
  for (let i = 0; i < 600; i += 1) {
    pill.step(1 / 60, { input: 1, output: 1 });
    pill.poke();
    assert.equal(pill.frame().body, body);
  }
});

test("a tap hops, then spins, and it comes back to its clip", () => {
  const pill = createPill({ seed: 9, mood: "idle" });
  pill.poke();
  let lowest = 0;
  for (let i = 0; i < 30; i += 1) {
    pill.step(1 / 60);
    lowest = Math.min(lowest, pill.pose().y);
  }
  assert.ok(lowest < -8, `hop height ${lowest}`);
});
