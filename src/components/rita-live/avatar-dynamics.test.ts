import assert from "node:assert/strict";
import test from "node:test";
import { AvatarDynamics, type AvatarMode, type AvatarPose } from "./avatar-dynamics.ts";

const DT = 1 / 60;

function run(
  d: AvatarDynamics,
  seconds: number,
  mode: AvatarMode,
  output: number | ((t: number) => number),
  reducedMotion = false,
  each?: (pose: AvatarPose, t: number) => void,
) {
  let pose = d.step(DT, { input: 0, output: 0, mode, reducedMotion });
  const frames = Math.round(seconds / DT);
  for (let i = 1; i < frames; i += 1) {
    const t = i * DT;
    const level = typeof output === "number" ? output : output(t);
    pose = d.step(DT, { input: 0, output: level, mode, reducedMotion });
    each?.(pose, t);
  }
  return pose;
}

/** Speech-like level: 4 syllables per second, phrases of `phrase` seconds then a pause. */
const speech =
  (phrase = 2.2, pause = 0.6) =>
  (t: number) => {
    const inPhrase = t % (phrase + pause) < phrase;
    return inPhrase ? 0.12 + 0.3 * Math.max(0, Math.sin(t * 2 * Math.PI * 4)) : 0;
  };

test("the mouth stays closed when Rita is not speaking", () => {
  const d = new AvatarDynamics(3);
  const pose = run(d, 3, "listening", 0.5);
  assert.ok(pose.mouth.open < 0.02, `open was ${pose.mouth.open}`);
});

test("the mouth opens with Rita's voice and closes again in a pause", () => {
  const d = new AvatarDynamics(3);
  let maxOpen = 0;
  run(d, 2, "speaking", speech(10, 0), false, (p) => (maxOpen = Math.max(maxOpen, p.mouth.open)));
  assert.ok(maxOpen > 0.4, `max open was ${maxOpen}`);
  // A real pause: level reported as silence but still in speaking mode for a short moment.
  const closed = run(d, 0.2, "speaking", 0);
  assert.ok(closed.mouth.open < maxOpen * 0.5, `open after pause was ${closed.mouth.open}`);
});

test("mouth weights never leave 0..1", () => {
  const d = new AvatarDynamics(9);
  run(
    d,
    8,
    "speaking",
    (t) => (Math.sin(t * 37) > 0 ? 1 : 0),
    false,
    (p) => {
      for (const v of [
        p.mouth.open,
        p.mouth.wide,
        p.mouth.round,
        p.blink,
        p.left.open,
        p.right.open,
      ]) {
        assert.ok(v >= 0 && v <= 1, `value out of range: ${v}`);
      }
    },
  );
});

test("the mouth keeps moving when the playback level is missing while speaking", () => {
  const d = new AvatarDynamics(5);
  let maxOpen = 0;
  let minOpen = 1;
  run(d, 3, "speaking", 0, false, (p, t) => {
    if (t > 1) {
      maxOpen = Math.max(maxOpen, p.mouth.open);
      minOpen = Math.min(minOpen, p.mouth.open);
    }
  });
  assert.ok(maxOpen - minOpen > 0.15, `synthetic mouth range was ${maxOpen - minOpen}`);
});

test("gestures change only at phrase pauses and never repeat back to back", () => {
  const d = new AvatarDynamics(11);
  const changes: { t: number; level: number; gesture: string }[] = [];
  let last = "";
  const level = speech(2.4, 0.7);
  run(d, 30, "speaking", level, false, (p, t) => {
    if (p.gesture !== last) {
      changes.push({ t, level: level(t), gesture: p.gesture });
      last = p.gesture;
    }
  });
  assert.ok(changes.length >= 5, `only ${changes.length} gesture changes`);
  for (let i = 1; i < changes.length; i += 1) {
    assert.notEqual(changes[i].gesture, changes[i - 1].gesture);
    assert.equal(changes[i].level, 0, `gesture changed mid-phrase at ${changes[i].t.toFixed(2)}s`);
  }
});

test("a gesture is held at least the minimum time", () => {
  const d = new AvatarDynamics(13);
  let last = "";
  let since = 0;
  const holds: number[] = [];
  run(d, 30, "speaking", speech(0.6, 0.5), false, (p) => {
    since += DT;
    if (p.gesture !== last) {
      if (last) holds.push(since);
      since = 0;
      last = p.gesture;
    }
  });
  assert.ok(holds.length > 2);
  assert.ok(Math.min(...holds) >= 1.6 - 1e-6, `shortest hold ${Math.min(...holds)}`);
});

test("long unbroken speech still moves on to another gesture", () => {
  const d = new AvatarDynamics(17);
  const seen = new Set<string>();
  run(d, 20, "speaking", speech(100, 0), false, (p) => seen.add(p.gesture));
  assert.ok(seen.size >= 2, `gestures seen: ${[...seen].join(",")}`);
});

test("an interruption returns the body to a listening pose within half a second", () => {
  const d = new AvatarDynamics(19);
  run(d, 4, "speaking", speech());
  const pose = run(d, 0.6, "listening", 0);
  assert.equal(pose.gesture, "handOnChest");
  // Right hand travels to the chest; it should be most of the way there.
  assert.ok(pose.right.target[1] > 0.05, `right hand y ${pose.right.target[1]}`);
  assert.ok(pose.mouth.open < 0.05, `mouth ${pose.mouth.open}`);
});

test("reduced motion keeps the mouth but no big gestures, sway or ponytail swing", () => {
  const d = new AvatarDynamics(23);
  const seen = new Set<string>();
  let maxOpen = 0;
  let maxPony = 0;
  let maxSway = 0;
  run(d, 20, "speaking", speech(), true, (p) => {
    seen.add(p.gesture);
    maxOpen = Math.max(maxOpen, p.mouth.open);
    maxPony = Math.max(maxPony, ...p.pony2.map(Math.abs));
    maxSway = Math.max(maxSway, Math.abs(p.hips[1]), Math.abs(p.hips[2]));
  });
  assert.ok(maxOpen > 0.3, "mouth still moves");
  assert.deepEqual([...seen], ["handOnChest"]);
  assert.ok(maxPony < 0.03, `pony ${maxPony}`);
  assert.ok(maxSway < 1e-6, `sway ${maxSway}`);
});

test("motion stays within modest limits", () => {
  const d = new AvatarDynamics(29);
  let maxHead = 0;
  let maxChest = 0;
  run(
    d,
    30,
    "speaking",
    (t) => (Math.sin(t * 25) > 0 ? 1 : 0.2),
    false,
    (p) => {
      maxHead = Math.max(maxHead, ...p.head.map(Math.abs), ...p.neck.map(Math.abs));
      maxChest = Math.max(maxChest, ...p.chest.map(Math.abs));
    },
  );
  assert.ok(maxHead < 0.25, `head ${maxHead}`);
  assert.ok(maxChest < 0.12, `chest ${maxChest}`);
});

test("the same seed produces the same motion", () => {
  const a = run(new AvatarDynamics(31), 6, "speaking", speech());
  const b = run(new AvatarDynamics(31), 6, "speaking", speech());
  assert.deepEqual(a, b);
});

test("eyes blink now and then", () => {
  const d = new AvatarDynamics(37);
  let blinks = 0;
  let closed = false;
  run(d, 20, "idle", 0, false, (p) => {
    if (p.blink > 0.9 && !closed) blinks += 1;
    closed = p.blink > 0.9;
  });
  assert.ok(blinks >= 3 && blinks <= 12, `blinks ${blinks}`);
});
