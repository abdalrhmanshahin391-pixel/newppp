import assert from "node:assert/strict";
import test from "node:test";
import {
  cardScale,
  cubeDots,
  FILM,
  filmAt,
  gathered,
  Glide,
  power2Out,
  power3Out,
  ringDots,
  ringPoint,
  scrollProgress,
  SCROLL,
} from "./intro-film.ts";

const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;

test("the card starts at half size below the fold and is full size by the middle of the screen", () => {
  const vh = 1000;
  assert.equal(scrollProgress(1000, vh, false), 0);
  assert.equal(scrollProgress(1400, vh, false), 0);
  assert.equal(scrollProgress(500, vh, false), 1);
  assert.equal(scrollProgress(-200, vh, false), 1);
  assert.ok(close(scrollProgress(750, vh, false), 0.5));
  assert.equal(cardScale(0, false), SCROLL.desktop.from);
  assert.equal(cardScale(1, false), 1);
  // Eased: more than half the growth happens in the first half of the scroll.
  assert.ok(close(cardScale(0.5, false), 0.5 + 0.5 * 0.75));
});

test("on phones it starts at 92% and is full size once its top is 80% down the screen", () => {
  const vh = 800;
  assert.equal(cardScale(scrollProgress(800, vh, true), true), 0.92);
  assert.equal(scrollProgress(640, vh, true), 1);
  assert.equal(cardScale(1, true), 1);
});

test("the catch-up glides from where it is when the target moves mid-way", () => {
  const g = new Glide(0, SCROLL.catchUp, power3Out);
  g.set(1);
  for (let i = 0; i < 30; i += 1) g.step(1 / 60);
  const mid = g.value;
  assert.ok(mid > 0.5 && mid < 1, `half a second in: ${mid}`);
  g.set(0.2);
  g.step(1 / 600);
  assert.ok(Math.abs(g.value - mid) < 0.01, "no jump when it turns round");
  for (let i = 0; i < 70; i += 1) g.step(1 / 60);
  assert.ok(g.settled);
  assert.ok(close(g.value, 0.2));
  const pill = new Glide(10, 0.35, power2Out);
  pill.set(110);
  for (let i = 0; i < 21; i += 1) pill.step(1 / 60);
  assert.ok(close(pill.value, 110), "the cursor pill lands in 0.35s");
});

test("the film: dots, a big cube, it settles, the cube takes over, then the name", () => {
  const start = filmAt(0);
  assert.equal(start.cube, 0);
  assert.equal(start.first, 0);
  assert.equal(start.ring, 0);
  assert.equal(start.settle, 0);

  const big = filmAt(1.15);
  assert.ok(big.size > 0.44, "grown in the middle");
  assert.equal(big.settle, 0);
  assert.ok(big.glow > 0.5);
  assert.equal(big.dots, 1);

  const placed = filmAt(FILM.settle[1]);
  assert.equal(placed.settle, 1);
  assert.ok(placed.cube > 0 && placed.dots < 1, "the hand-over is under way");

  const named = filmAt(3);
  assert.equal(named.dots, 0);
  assert.equal(named.cube, 1);
  assert.equal(named.first, 1);
  assert.equal(named.second, 1);
  assert.equal(named.ring, 1);
  assert.equal(named.glow, 0);
  // "Uzyra" leads "Ultra".
  const writing = filmAt(2.2);
  assert.ok(writing.first > writing.second);
});

test("the cycle fades the name and the cube, keeps the ring, and starts again", () => {
  const end = filmAt(FILM.out[1] + 0.01);
  assert.equal(end.cube, 0);
  assert.equal(end.first, 0);
  assert.equal(end.ring, 1);
  assert.deepEqual(filmAt(FILM.cycle + 1.15), filmAt(1.15));
  const still = filmAt(FILM.still);
  assert.equal(still.cube, 1);
  assert.equal(still.first, 1);
});

test("every cube dot has flown in by the end of the gather", () => {
  const inside = (x: number, y: number) => x > 10 && x < 90 && y > 15 && y < 85;
  const dots = cubeDots(inside);
  assert.ok(dots.length > 500);
  for (const d of dots) {
    assert.ok(inside(d.x, d.y));
    assert.equal(gathered(0, d.delay), 0);
    assert.equal(gathered(FILM.gather[1], d.delay), 1);
  }
  assert.ok(
    dots.some((d) => gathered(0.2, d.delay) < gathered(0.2, 0)),
    "they arrive at different times",
  );
});

test("the ring is a closed loop that turns and has a near and a far side", () => {
  const dots = ringDots();
  assert.ok(dots.length > 1000);
  let near = 0;
  let far = 1;
  for (const d of dots) {
    const p = ringPoint(d.u, d.v, 0);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    assert.ok(Math.abs(p.y) < 1.2 && Math.abs(p.x) < 1.6, "inside the card");
    near = Math.max(near, p.near);
    far = Math.min(far, p.near);
  }
  assert.ok(near > 0.85 && far < 0.15);
  const a = ringPoint(0, 0, 0);
  const b = ringPoint(0, 0, 4);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 0.1, "it turns with time");
});
