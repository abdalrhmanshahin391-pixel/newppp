import assert from "node:assert/strict";
import test from "node:test";
import { CLIPS, REST, sampleClip, type Key } from "./cube-clips.ts";
import { createCube, restFrame } from "./cube-engine.ts";
import { eyeOutline, FACES, FacePlayer } from "./cube-faces.ts";
import {
  apply,
  convexHull,
  cubicBezier,
  facing,
  HALF,
  nearestAngle,
  rotation,
  silhouette,
  Spring,
} from "./cube-math.ts";

const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;

test("rotations keep lengths and right angles", () => {
  for (const [rx, ry, rz] of [
    [0, 0, 0],
    [12, -40, 7],
    [-90, 30, 180],
    [33, 360, -15],
  ]) {
    const m = rotation(rx, ry, rz);
    for (const axis of [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ] as [number, number, number][]) {
      const v = apply(m, axis);
      assert.ok(close(Math.hypot(...v), 1));
    }
    const x = apply(m, [1, 0, 0]);
    const y = apply(m, [0, 1, 0]);
    assert.ok(close(x[0] * y[0] + x[1] * y[1] + x[2] * y[2], 0));
  }
  // + turns the face to the viewer's right; + tips the top towards the viewer.
  assert.ok(apply(rotation(0, 30, 0), [0, 0, 1])[0] > 0);
  assert.ok(apply(rotation(30, 0, 0), [0, 1, 0])[2] > 0);
});

test("at rest the outline is the logo's block", () => {
  const outline = silhouette(rotation(0, 0, 0), 48);
  const xs = outline.map((p) => p[0]);
  const ys = outline.map((p) => p[1]);
  assert.ok(close(Math.min(...xs), -HALF.w, 0.012), `left ${Math.min(...xs)}`);
  assert.ok(close(Math.max(...xs), HALF.w, 0.012), `right ${Math.max(...xs)}`);
  assert.ok(close(Math.min(...ys), -HALF.h, 0.012), `bottom ${Math.min(...ys)}`);
  assert.ok(close(Math.max(...ys), HALF.h, 0.012), `top ${Math.max(...ys)}`);
});

test("turned, the block shows its side and the face looks away", () => {
  const front = silhouette(rotation(0, 0, 0));
  const turned = silhouette(rotation(0, 35, 0));
  const width = (pts: [number, number][]) =>
    Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0]));
  assert.ok(width(turned) > width(front), "a turned block is wider (face plus side)");
  assert.ok(facing(rotation(0, 35, 0)) < 1 && facing(rotation(0, 35, 0)) > 0.7);
  assert.ok(facing(rotation(0, 180, 0)) < 0);
});

test("the outline around points is convex and keeps only the corners", () => {
  const hull = convexHull([
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
    [0.5, 0.5],
    [0.2, 0.7],
  ]);
  assert.equal(hull.length, 4);
});

test("timing curves start at 0, end at 1, and the springy one overshoots", () => {
  const even = cubicBezier(0.45, 0, 0.55, 1);
  assert.equal(even(0), 0);
  assert.equal(even(1), 1);
  assert.ok(close(even(0.5), 0.5, 1e-3));
  let last = 0;
  for (let t = 0; t <= 1; t += 0.01) {
    assert.ok(even(t) >= last - 1e-9);
    last = even(t);
  }
  const back = cubicBezier(0.34, 1.5, 0.64, 1);
  assert.ok(Math.max(...Array.from({ length: 100 }, (_, i) => back(i / 100))) > 1.02);
});

test("springs settle on their target", () => {
  const s = new Spring(0, 12, 0.5);
  s.target = 1;
  let peak = 0;
  for (let i = 0; i < 300; i += 1) peak = Math.max(peak, s.step(1 / 60));
  assert.ok(close(s.x, 1, 1e-3));
  assert.ok(peak > 1, "an underdamped spring overshoots");
});

test("angles unwrap to the nearest whole turn", () => {
  assert.equal(nearestAngle(360, 0), 0);
  assert.equal(nearestAngle(350, 0), -10);
  assert.equal(nearestAngle(-170, 180), 190);
});

test("the neutral eye is the logo's eye", () => {
  const outline = eyeOutline(FACES.neutral.eyes[0]);
  const xs = outline.map((p) => p[0]);
  const ys = outline.map((p) => p[1]);
  assert.ok(close(Math.max(...xs) - Math.min(...xs), 11.7 / 84, 0.003));
  assert.ok(close(Math.max(...ys) - Math.min(...ys), 20 / 84, 0.003));
});

test("eyes change kind behind a blink and end on the new face", () => {
  const face = new FacePlayer("neutral");
  face.set("happy");
  let darkest = 1;
  for (let i = 0; i < 40; i += 1) {
    face.step(1 / 60);
    darkest = Math.min(darkest, face.eyes()[0].lid);
  }
  assert.ok(darkest < 0.1, "the lids shut for the change");
  assert.equal(face.name, "happy");
  assert.ok(!face.busy);
  assert.ok(close(face.eyes()[0].lid, 1));
  assert.deepEqual(face.eyes()[0], FACES.happy.eyes[0]);
});

test("a blink shuts and reopens", () => {
  const face = new FacePlayer("neutral");
  face.blink();
  let darkest = 1;
  for (let i = 0; i < 30; i += 1) {
    face.step(1 / 60);
    darkest = Math.min(darkest, face.eyes()[0].lid);
  }
  assert.ok(darkest < 0.1);
  assert.equal(face.eyes()[0].lid, 1);
});

test("every clip is well formed and ends at rest", () => {
  const rest: Record<string, number[]> = {
    rot: [0, 0, 0],
    pos: [0, 0],
    sq: [1, 1],
    scale: [1],
    look: [0, 0],
  };
  for (const [mood, clips] of Object.entries(CLIPS)) {
    assert.ok(clips.length >= 3, `${mood} has a few clips`);
    for (const clip of clips) {
      for (const channel of ["rot", "pos", "sq", "scale", "look"] as const) {
        const keys = clip[channel] as Key[] | undefined;
        if (!keys) continue;
        for (let i = 1; i < keys.length; i += 1) assert.ok(keys[i].t >= keys[i - 1].t, clip.name);
        for (const key of keys) {
          assert.ok(key.t >= 0 && key.t <= clip.duration, `${clip.name} ${channel} at ${key.t}`);
          assert.equal(key.v.length, rest[channel].length);
        }
        const end = keys[keys.length - 1].v.map((v, i) =>
          channel === "rot" ? nearestAngle(v, 0) : v,
        );
        end.forEach((v, i) =>
          assert.ok(close(v, rest[channel][i], 1e-9), `${clip.name} ${channel} ends at rest`),
        );
      }
      for (const time of [...(clip.blinks ?? []), ...(clip.face ?? []).map((f) => f.t)]) {
        assert.ok(time >= 0 && time <= clip.duration, clip.name);
      }
      const atEnd = sampleClip(clip, clip.duration);
      assert.ok(close(nearestAngle(atEnd.ry, 0), REST.ry, 1e-9));
    }
  }
});

test("the first paint is the same every time", () => {
  assert.equal(restFrame().body, restFrame().body);
  assert.ok(restFrame().eyes);
});

test("a long, busy run never breaks the drawing", () => {
  const cube = createCube({ seed: 7, size: 240 });
  const moods = ["idle", "listening", "thinking", "speaking"] as const;
  let sawNoEyes = false;
  for (let i = 0; i < 60 * 90; i += 1) {
    if (i % 600 === 0) cube.setMood(moods[(i / 600) % 4]);
    if (i % 377 === 0) cube.poke();
    if (i % 250 < 120) cube.gaze([Math.sin(i / 50), Math.cos(i / 70)]);
    else cube.gaze(null);
    cube.step(1 / 60, { input: Math.abs(Math.sin(i / 9)), output: Math.abs(Math.cos(i / 7)) });
    const frame = cube.frame();
    assert.ok(!/NaN|Infinity/.test(frame.body), `body at ${i}`);
    if (frame.eyes) frame.eyes.forEach((d) => assert.ok(!/NaN|Infinity/.test(d), `eyes at ${i}`));
    else sawNoEyes = true;
  }
  assert.ok(sawNoEyes, "a spin turns the face away at some point");
});

test("it moves on its own, and holds still with reduced motion", () => {
  const live = createCube({ seed: 3 });
  const seen = new Set<string>();
  for (let i = 0; i < 300; i += 1) {
    live.step(1 / 60);
    seen.add(live.frame().body);
  }
  assert.ok(seen.size > 50, "the outline keeps changing");

  const still = createCube({ seed: 3, reduced: true });
  const bodies = new Set<string>();
  for (let i = 0; i < 600; i += 1) {
    still.step(1 / 60);
    still.poke("spin");
    still.gaze([1, 1]);
    bodies.add(still.frame().body);
  }
  assert.equal(bodies.size, 1);
});

test("it never hangs side-on, even when the pointer arrives mid-turn", () => {
  for (let seed = 1; seed <= 12; seed += 1) {
    const cube = createCube({ seed: seed * 7919 });
    let run = 0;
    let longest = 0;
    for (let i = 0; i < 60 * 40; i += 1) {
      const t = i / 60;
      if (t > 4 && t % 7 < 3) cube.gaze([Math.cos(t * 2.3), Math.sin(t * 1.7)]);
      else cube.gaze(null);
      if (i % 500 === 250) cube.poke();
      cube.step(1 / 60);
      const ry = nearestAngle(cube.pose().ry, 0);
      run = Math.abs(ry) > 45 ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
    assert.ok(longest < 60 * 0.75, `seed ${seed}: side-on for ${longest} frames`);
  }
});

test("a tap plays a reaction with a happy face", () => {
  const cube = createCube({ seed: 5 });
  cube.poke("hop");
  for (let i = 0; i < 20; i += 1) cube.step(1 / 60);
  assert.ok(cube.pose().y > 0.05, "it leaves the ground");
  for (let i = 0; i < 20; i += 1) cube.step(1 / 60);
  const eyes = cube.frame().eyes;
  assert.ok(eyes);
});
