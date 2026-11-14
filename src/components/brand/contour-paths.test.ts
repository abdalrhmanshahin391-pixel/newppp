import assert from "node:assert/strict";
import { test } from "node:test";
import { CONTOUR_PATHS, contourAt } from "./contour-paths.ts";

const numbers = (path: string) => path.match(/-?\d*\.?\d+/g)!.map(Number);

test("contours keep their SVG commands, vertical coordinates and bounded horizontal drift", () => {
  for (const [i, path] of CONTOUR_PATHS.entries()) {
    const original = numbers(path);
    assert.deepEqual(numbers(contourAt(path, i, 0)), original);
    for (const time of [0.5, 4, 17, 61, 3600]) {
      const moved = contourAt(path, i, time);
      assert.equal(moved.match(/[A-Za-z]/g)?.join(""), path.match(/[A-Za-z]/g)?.join(""));
      assert.equal(numbers(moved).length, original.length);
      numbers(moved).forEach((value, coordinate) => {
        assert.ok(Number.isFinite(value));
        if (coordinate % 2) assert.equal(value, original[coordinate]);
        else assert.ok(Math.abs(value - original[coordinate]) <= 44.05);
      });
    }
    assert.notEqual(contourAt(path, i, 4), contourAt(path, i, 5));
  }
});
