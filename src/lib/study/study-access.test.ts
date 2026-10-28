// The server's reads that decide a lesson's experience and load a study lesson, against a small fake
// of the database client (the rules themselves are tested against Postgres in supabase/tests).
import assert from "node:assert/strict";
import test from "node:test";
import { SAMPLE_GUIDES } from "../guides/guide-samples.ts";
import { lessonExperiences } from "./study-access.server.ts";
import { loadStudyLesson } from "./study-lesson.server.ts";

type Row = Record<string, unknown>;
type Table = Row[] | { error: { code?: string; message: string } };

/** Just the query shapes these functions use: select, eq, in, maybeSingle, await. */
function fakeDb(tables: Record<string, Table>, options: { admin?: boolean } = {}) {
  return {
    rpc: async (name: string) => ({ data: name === "has_role" ? Boolean(options.admin) : null }),
    from(name: string) {
      const table = tables[name] ?? [];
      const filters: ((row: Row) => boolean)[] = [];
      const result = () => {
        if (!Array.isArray(table)) return { data: null, error: table.error };
        return { data: table.filter((row) => filters.every((keep) => keep(row))), error: null };
      };
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          filters.push((row) => row[column] === value);
          return query;
        },
        in: (column: string, values: unknown[]) => {
          filters.push((row) => values.includes(row[column]));
          return query;
        },
        maybeSingle: async () => {
          const { data, error } = result();
          return { data: data?.[0] ?? null, error };
        },
        then: (resolve: (value: unknown) => unknown) => resolve(result()),
      };
      return query;
    },
  } as never;
}

const LESSON = "00000000-0000-4000-8000-000000000001";
const GUIDE = "00000000-0000-4000-8000-0000000000aa";
const guideRow = (patch: Row = {}) => ({
  id: GUIDE,
  title: "Third person",
  version: 2,
  status: "ready",
  content: SAMPLE_GUIDES[1].content,
  learner_path: "c/g-v2-final.pdf",
  allow_download: true,
  ...patch,
});
const lessonRow = (patch: Row = {}) => ({
  id: LESSON,
  title: "Third person -s",
  title_ar: "الشخص الثالث",
  topic: "",
  objectives: [{ id: "o1", text: "Add -s", text_ar: "" }, null],
  status: "published",
  experience: "study",
  study_guide_id: GUIDE,
  curriculum: { status: "published" },
  ...patch,
});
const flag = (enabled: boolean) => [{ key: "rita_study", enabled }];

test("ST-I08: before the migration is applied every lesson is classic", async () => {
  const db = fakeDb({
    rita_lessons: { error: { code: "42703", message: "column experience does not exist" } },
  });
  assert.deepEqual(await lessonExperiences(db, [LESSON, "x"]), {
    [LESSON]: "classic",
    x: "classic",
  });
});

test("a lesson opens as study only with a final guide and the switch on", async () => {
  const study = await lessonExperiences(
    fakeDb({
      rita_lessons: [lessonRow()],
      rita_lesson_guides: [guideRow()],
      rita_feature_flags: flag(true),
    }),
    [LESSON],
  );
  assert.equal(study[LESSON], "study");
  const off = await lessonExperiences(
    fakeDb({
      rita_lessons: [lessonRow()],
      rita_lesson_guides: [guideRow()],
      rita_feature_flags: flag(false),
    }),
    [LESSON],
  );
  assert.equal(off[LESSON], "classic");
  // The learner cannot read the guide (not linked for learners yet): classic.
  const hidden = await lessonExperiences(
    fakeDb({ rita_lessons: [lessonRow()], rita_lesson_guides: [], rita_feature_flags: flag(true) }),
    [LESSON],
  );
  assert.equal(hidden[LESSON], "classic");
  const draftOnly = await lessonExperiences(
    fakeDb({
      rita_lessons: [lessonRow()],
      rita_lesson_guides: [guideRow({ learner_path: null })],
      rita_feature_flags: flag(true),
    }),
    [LESSON],
  );
  assert.equal(draftOnly[LESSON], "classic");
});

test("loading the study page: study, classic, or not available", async () => {
  const tables = {
    rita_lessons: [lessonRow()],
    rita_lesson_guides: [guideRow()],
    rita_feature_flags: flag(true),
  };
  const ok = await loadStudyLesson(fakeDb(tables), "u", LESSON);
  assert.ok(ok.ok);
  assert.equal(ok.data.guide.version, 2);
  assert.deepEqual(ok.data.lesson.objectives, [{ id: "o1", text: "Add -s", text_ar: "" }]);
  assert.equal(ok.data.preview, false);

  assert.deepEqual(await loadStudyLesson(fakeDb(tables), "u", "not-a-uuid"), {
    ok: false,
    reason: "unavailable",
  });
  assert.deepEqual(
    await loadStudyLesson(
      fakeDb({ ...tables, rita_lessons: [lessonRow({ experience: "classic" })] }),
      "u",
      LESSON,
    ),
    { ok: false, reason: "classic" },
  );
  assert.deepEqual(
    await loadStudyLesson(fakeDb({ ...tables, rita_feature_flags: flag(false) }), "u", LESSON),
    { ok: false, reason: "classic" },
  );
  assert.deepEqual(
    await loadStudyLesson(
      fakeDb({ ...tables, rita_lesson_guides: [guideRow({ content: { title: "broken" } })] }),
      "u",
      LESSON,
    ),
    { ok: false, reason: "classic" },
  );
});

test("preview is for admins only, and opens a draft lesson while the switch is off", async () => {
  const draft = {
    rita_lessons: [lessonRow({ status: "draft" })],
    rita_lesson_guides: [guideRow()],
    rita_feature_flags: flag(false),
  };
  assert.deepEqual(await loadStudyLesson(fakeDb(draft), "u", LESSON), {
    ok: false,
    reason: "unavailable",
  });
  assert.deepEqual(await loadStudyLesson(fakeDb(draft), "u", LESSON, true), {
    ok: false,
    reason: "unavailable",
  });
  const asAdmin = await loadStudyLesson(fakeDb(draft, { admin: true }), "a", LESSON, true);
  assert.ok(asAdmin.ok && asAdmin.data.preview);
  const archived = {
    ...draft,
    rita_lessons: [lessonRow({ status: "archived" })],
  };
  assert.deepEqual(await loadStudyLesson(fakeDb(archived, { admin: true }), "a", LESSON, true), {
    ok: false,
    reason: "unavailable",
  });
});
