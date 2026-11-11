import assert from "node:assert/strict";
import test from "node:test";

async function soundFixture(id, state = "running") {
  const nodes = [],
    params = [];
  const parameter = () => ({
    value: 0,
    setValueAtTime(value, at) {
      params.push({ value, at });
    },
    linearRampToValueAtTime(value, at) {
      params.push({ value, at });
    },
    exponentialRampToValueAtTime(value, at) {
      params.push({ value, at });
    },
    setTargetAtTime(value, at, tau) {
      params.push({ value, at, tau });
    },
    cancelScheduledValues() {},
  });
  let resume;
  class Audio {
    currentTime = 1;
    state = state;
    destination = {};
    createOscillator() {
      const node = {
        type: "sine",
        frequency: parameter(),
        starts: [],
        stops: [],
        connect(to) {
          return to;
        },
        disconnect() {},
        start(at) {
          this.starts.push(at);
        },
        stop(at) {
          this.stops.push(at);
        },
      };
      nodes.push(node);
      return node;
    }
    createGain() {
      return {
        gain: parameter(),
        connect(to) {
          return to;
        },
        disconnect() {},
      };
    }
    createBiquadFilter() {
      return {
        frequency: parameter(),
        Q: parameter(),
        connect(to) {
          return to;
        },
        disconnect() {},
      };
    }
    resume() {
      return new Promise((done) => {
        resume = () => {
          this.state = "running";
          done();
        };
      });
    }
  }
  const storage = new Map();
  globalThis.window = {
    AudioContext: Audio,
    localStorage: {
      getItem: (key) => storage.get(key),
      setItem: (key, value) => storage.set(key, value),
    },
  };
  const sound = await import(`./tech-sound.ts?fixture=${id}`);
  return { sound, nodes, params, wake: () => resume?.() };
}

test("a hold reuses two sine oscillators and stays within a low, quiet register", async () => {
  const { sound, nodes, params } = await soundFixture("hold");
  for (let frame = 1; frame <= 100; frame++) sound.holdTone(frame / 100);
  assert.equal(nodes.length, 2);
  assert.ok(nodes.every((node) => node.type === "sine"));
  const targets = params.filter((item) => item.tau);
  assert.ok(targets.every(({ value }) => value >= 0 && value < 400));
  assert.ok(targets.filter(({ value }) => value < 1).every(({ value }) => value <= 0.02));
  sound.endHoldTone();
  assert.ok(nodes.every((node) => node.stops.length === 1 && node.stops[0] <= 1.2));
  sound.endHoldTone();
  assert.ok(nodes.every((node) => node.stops.length === 1));
});

test("mute terminates an active hold and cannot restart it on subsequent frames", async () => {
  const { sound, nodes } = await soundFixture("mute");
  sound.holdTone(0.5);
  sound.setSoundOn(false);
  sound.holdTone(0.8);
  sound.holdDoneSound();
  assert.equal(nodes.length, 2);
  assert.ok(nodes.every((node) => node.stops.length === 1));
});

test("a pending audio wake cannot play a confirmation after mute", async () => {
  const { sound, nodes, wake } = await soundFixture("wake", "suspended");
  sound.holdDoneSound();
  sound.setSoundOn(false);
  wake();
  await Promise.resolve();
  assert.equal(nodes.length, 0);
});

test("invalid fill cancels instead of passing invalid values to Web Audio", async () => {
  const { sound, nodes, params } = await soundFixture("invalid");
  sound.holdTone(0.5);
  sound.holdTone(Number.NaN);
  assert.ok(nodes.every((node) => node.stops.length === 1));
  assert.ok(params.every(({ value }) => Number.isFinite(value)));
});
