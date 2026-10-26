// The operations that run inside the Edge Function. A run is always looked up by the caller's id,
// so another learner's run id behaves like a run that does not exist.
import assert from "node:assert/strict";
import { test } from "node:test";
import { LessonRunError, answerItem, sendEvent, type Db } from "./rita-lesson-run.core.ts";

const RUN = "11111111-1111-4111-8111-111111111111";
const queries: { column: string; value: unknown }[] = [];

/** A connection whose table has no row for the question asked. Records every filter used. */
function emptyDb(): Db {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = (column: string, value: unknown) => {
    queries.push({ column, value });
    return chain;
  };
  chain.maybeSingle = async () => ({ data: null, error: null });
  return { from: () => chain } as unknown as Db;
}

test("a run id that belongs to nobody (or to someone else) is not found", async () => {
  const deps = { db: emptyDb(), userDb: emptyDb(), userId: "learner-1" };
  await assert.rejects(
    () => sendEvent(deps, { runId: RUN, revision: 1, event: { type: "continue" } as never }),
    (error: unknown) => error instanceof LessonRunError && error.status === 404,
  );
  await assert.rejects(
    () =>
      answerItem(deps, {
        runId: RUN,
        revision: 1,
        itemId: "q1",
        response: { kind: "choice", value: "a" } as never,
        channel: "tap",
      }),
    (error: unknown) => error instanceof LessonRunError && error.code === "run_not_found",
  );
});

test("the lookup is always filtered by the caller's own id", () => {
  assert.ok(queries.some((query) => query.column === "user_id" && query.value === "learner-1"));
  assert.ok(queries.some((query) => query.column === "id" && query.value === RUN));
});
