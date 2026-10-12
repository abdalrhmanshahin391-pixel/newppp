import assert from "node:assert/strict";
import test from "node:test";
import { OrbDynamics, type OrbMode } from "./orb-dynamics.ts";

const DT = 1 / 60;

function run(dynamics: OrbDynamics, seconds: number, input: number, output: number, mode: OrbMode) {
  let frame = dynamics.step(DT, { input, output, mode });
  for (let i = 1; i < Math.round(seconds / DT); i += 1) {
    frame = dynamics.step(DT, { input, output, mode });
  }
  return frame;
}

test("a listening orb with no sound rests at full size", () => {
  const dynamics = new OrbDynamics();
  const frame = run(dynamics, 3, 0, 0, "listening");
  assert.ok(frame.radius > 0.99, `radius was ${frame.radius}`);
});

test("the orb contracts while the learner talks", () => {
  const dynamics = new OrbDynamics();
  const frame = run(dynamics, 1.5, 0.5, 0, "listening");
  assert.ok(frame.radius < 0.85, `radius was ${frame.radius}`);
  assert.equal(frame.voiced, true);
});

test("recovery is proportional to the pause: word gap < comma < end of sentence", () => {
  const talk = () => {
    const dynamics = new OrbDynamics();
    run(dynamics, 1.5, 0.5, 0, "listening");
    return dynamics;
  };
  const minimum = run(talk(), 0.02, 0.5, 0, "listening").radius;
  const wordGap = run(talk(), 0.15, 0, 0, "listening").radius;
  const comma = run(talk(), 0.45, 0, 0, "listening").radius;
  const sentence = run(talk(), 1.4, 0, 0, "listening").radius;

  assert.ok(wordGap > minimum, "a word gap should open the orb a little");
  assert.ok(wordGap - minimum < 0.075, `a word gap should open it only slightly (${wordGap - minimum})`);
  assert.ok(comma > wordGap + 0.025, "a comma should open it more than a word gap");
  assert.ok(sentence > comma + 0.025, "the end of a sentence should open it the most");
  assert.ok(sentence > 0.95, `after a full pause the orb should be nearly full size (${sentence})`);
});

test("a quiet microphone still moves the orb (automatic gain)", () => {
  const dynamics = new OrbDynamics();
  const frame = run(dynamics, 1.5, 0.05, 0, "listening");
  assert.ok(frame.radius < 0.9, `radius was ${frame.radius}`);
});

test("room noise below the gate does not move the orb", () => {
  const dynamics = new OrbDynamics();
  const frame = run(dynamics, 2, 0.008, 0, "listening");
  assert.ok(frame.radius > 0.99);
  assert.equal(frame.voiced, false);
});

test("while Rita speaks the orb is full size and the clouds move fast", () => {
  const speaking = new OrbDynamics();
  const idle = new OrbDynamics();
  const a = run(speaking, 1.5, 0, 0.5, "speaking");
  const b = run(idle, 1.5, 0, 0, "idle");
  assert.ok(a.radius >= 1.0, `radius was ${a.radius}`);
  assert.ok(a.flowSpeed > 1.0, `flow was ${a.flowSpeed}`);
  assert.ok(a.flowSpeed > b.flowSpeed * 5);
  assert.ok(a.warp > b.warp + 0.3);
});

test("thinking is calm and slightly smaller than full size", () => {
  const dynamics = new OrbDynamics();
  const frame = run(dynamics, 2, 0, 0, "thinking");
  assert.ok(frame.radius < 1 && frame.radius > 0.88, `radius was ${frame.radius}`);
  assert.ok(frame.flowSpeed < 0.25);
});

test("reduced motion damps size modulation and flow", () => {
  const normal = run(new OrbDynamics(), 1.5, 0.5, 0, "listening");
  const calm = new OrbDynamics();
  let frame = calm.step(DT, { input: 0.5, output: 0, mode: "listening", reducedMotion: true });
  for (let i = 1; i < 90; i += 1) {
    frame = calm.step(DT, { input: 0.5, output: 0, mode: "listening", reducedMotion: true });
  }
  assert.ok(1 - frame.radius < (1 - normal.radius) * 0.5);
  assert.ok(frame.flowSpeed < normal.flowSpeed);
});

test("the same inputs always produce the same frames", () => {
  const first = run(new OrbDynamics(), 2, 0.4, 0, "listening");
  const second = run(new OrbDynamics(), 2, 0.4, 0, "listening");
  assert.deepEqual(first, second);
});
