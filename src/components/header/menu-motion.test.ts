import assert from "node:assert/strict";
import test from "node:test";
import {
  highlightBox,
  MOTION,
  neighbourMenu,
  nextItem,
  orderByPosition,
  originSide,
  paneSlot,
  panelLeft,
  slideOffset,
} from "./menu-motion.ts";

const group = { left: 600, top: 0, width: 400, height: 60 };

test("content leaves the way its trigger lies from the active one", () => {
  assert.equal(paneSlot(1, 1), "active");
  assert.equal(paneSlot(0, 1), "before");
  assert.equal(paneSlot(2, 1), "after");
  assert.equal(slideOffset("active"), 0);
  assert.equal(slideOffset("before"), -MOTION.distance);
  assert.equal(slideOffset("after"), MOTION.distance);
});

test("the panel hangs from its trigger's end edge, or its start edge", () => {
  const trigger = { left: 900, top: 8, width: 44, height: 44 };
  // End edge: the panel's right edge under the trigger's right edge.
  assert.equal(
    panelLeft({ align: "end", rtl: false, trigger, group, panelWidth: 288, viewportWidth: 1280 }),
    900 + 44 - 288 - 600,
  );
  // Start edge: the panel's left edge under the trigger's left edge.
  assert.equal(
    panelLeft({ align: "start", rtl: false, trigger, group, panelWidth: 220, viewportWidth: 1280 }),
    900 - 600,
  );
});

test("right-to-left pages swap which edge is the start", () => {
  const trigger = { left: 100, top: 8, width: 44, height: 44 };
  const rtlGroup = { left: 20, top: 0, width: 300, height: 60 };
  // In RTL the end edge is the left one: the panel's left edge sits under the trigger's left edge.
  assert.equal(
    panelLeft({
      align: "end",
      rtl: true,
      trigger,
      group: rtlGroup,
      panelWidth: 288,
      viewportWidth: 1280,
    }),
    100 - 20,
  );
  assert.equal(originSide("end", true), "left");
  assert.equal(originSide("end", false), "right");
  assert.equal(originSide("start", false), "left");
  assert.equal(originSide("start", true), "right");
});

test("the panel stays on the screen", () => {
  const nearRight = { left: 1250, top: 8, width: 44, height: 44 };
  const left = panelLeft({
    align: "start",
    rtl: false,
    trigger: nearRight,
    group,
    panelWidth: 320,
    viewportWidth: 1280,
  });
  assert.equal(left + group.left + 320, 1280 - 8);
  const nearLeft = { left: -30, top: 8, width: 44, height: 44 };
  assert.equal(
    panelLeft({
      align: "start",
      rtl: false,
      trigger: nearLeft,
      group,
      panelWidth: 220,
      viewportWidth: 1280,
    }),
    8 - group.left,
  );
  // Wider than the screen: it starts at the margin rather than going off the left.
  assert.equal(
    panelLeft({
      align: "end",
      rtl: false,
      trigger: nearLeft,
      group,
      panelWidth: 900,
      viewportWidth: 600,
    }),
    8 - group.left,
  );
});

test("the highlight is measured from the surface", () => {
  assert.deepEqual(
    highlightBox(
      { left: 130, top: 90, width: 200, height: 36 },
      { left: 100, top: 70, width: 220, height: 200 },
    ),
    { left: 30, top: 20, width: 200, height: 36 },
  );
});

test("the highlight allows for the panel still being a little small", () => {
  const box = highlightBox(
    { left: 130, top: 90, width: 192, height: 36 },
    { left: 100, top: 70, width: 211.2, height: 192 },
    0.96,
  );
  assert.ok(Math.abs(box.left - 31.25) < 1e-9);
  assert.ok(Math.abs(box.top - 20.8333333) < 1e-6);
  assert.ok(Math.abs(box.width - 200) < 1e-9);
  assert.ok(Math.abs(box.height - 37.5) < 1e-9);
});

test("arrow keys move through the items and wrap", () => {
  assert.equal(nextItem(-1, 4, "ArrowDown"), 0);
  assert.equal(nextItem(3, 4, "ArrowDown"), 0);
  assert.equal(nextItem(-1, 4, "ArrowUp"), 3);
  assert.equal(nextItem(0, 4, "ArrowUp"), 3);
  assert.equal(nextItem(2, 4, "ArrowUp"), 1);
  assert.equal(nextItem(2, 4, "Home"), 0);
  assert.equal(nextItem(0, 4, "End"), 3);
  assert.equal(nextItem(0, 0, "ArrowDown"), -1);
});

test("left and right arrows switch between menus in screen order", () => {
  const ids = orderByPosition([
    { id: "account", left: 900 },
    { id: "credits", left: 700 },
    { id: "language", left: 800 },
  ]);
  assert.deepEqual(ids, ["credits", "language", "account"]);
  assert.equal(neighbourMenu(ids, "credits", "ArrowRight"), "language");
  assert.equal(neighbourMenu(ids, "account", "ArrowRight"), "credits");
  assert.equal(neighbourMenu(ids, "credits", "ArrowLeft"), "account");
  assert.equal(neighbourMenu(["only"], "only", "ArrowRight"), null);
  assert.equal(neighbourMenu(ids, "missing", "ArrowRight"), null);
});
