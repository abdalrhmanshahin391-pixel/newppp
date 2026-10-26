// Why a learner does or does not get a lesson's exercises, said step by step for the admin.
// The exercise window opens only when all of these hold: the lesson is published, its exercises are
// written, published and free of problems, and the server can read them. When one fails the learner
// quietly gets the spoken lesson, so the admin needs to see which one. Pure: no server or browser
// imports, so it is tested with node.

/** What the server found out about one lesson. */
export type EngineFacts = {
  /** The exercise tables exist (migration 20261025100000 applied). */
  migrationReady: boolean;
  lessonStatus: string;
  contentStatus: "none" | "draft" | "published";
  /** Problems the code checks found in the written exercises. */
  problems: number;
  /** Can the server connection the exercise window needs be opened? */
  serverKey: "ok" | "missing" | "error";
  serverKeyMessage: string;
};

export type CheckStep = {
  id: "migration" | "lesson" | "written" | "published" | "problems" | "server";
  label: string;
  state: "ok" | "fail" | "unknown";
  /** What to do when the step fails. */
  hint: string;
};

export type EngineVerdict = {
  steps: CheckStep[];
  /** What the learner gets right now. */
  verdict: "exercises" | "spoken";
  /** One sentence: the first thing to fix, or that everything is fine. */
  reason: string;
};

export function explainEngine(facts: EngineFacts): EngineVerdict {
  const written = facts.contentStatus !== "none";
  const steps: CheckStep[] = [
    {
      id: "migration",
      label: "قاعدة البيانات جاهزة للتمارين",
      state: facts.migrationReady ? "ok" : "fail",
      hint: "طبّق migration ‏20261025100000_rita_lessons_v2 في Lovable Cloud ثم حدّث الصفحة.",
    },
    {
      id: "lesson",
      label: "الدرس منشور للطلاب",
      state: facts.lessonStatus === "published" ? "ok" : "fail",
      hint: "الدرس لسا مسودة. انشره من أعلى نافذة الدرس.",
    },
    {
      id: "written",
      label: "التمارين مكتوبة",
      state: !facts.migrationReady ? "unknown" : written ? "ok" : "fail",
      hint: "ما في تمارين لهالدرس. اضغط «اصنع التمارين من صفحات الدرس» تحت.",
    },
    {
      id: "published",
      label: "التمارين منشورة",
      state: !written ? "unknown" : facts.contentStatus === "published" ? "ok" : "fail",
      hint: "التمارين مسودة، فالطالب ما بيشوفها. اضغط «نشر للطلاب» تحت.",
    },
    {
      id: "problems",
      label: "التمارين سليمة",
      state: !written ? "unknown" : facts.problems === 0 ? "ok" : "fail",
      hint: `فيها ${facts.problems} مشكلة لازم تتصلح قبل النشر (مكتوبة تحت).`,
    },
    {
      id: "server",
      label: "الخادم بيقدر يقرأ التمارين",
      state: facts.serverKey === "ok" ? "ok" : "fail",
      hint:
        facts.serverKey === "missing"
          ? "خادم الموقع ما عنده مفتاح الوصول الكامل للتمارين، فالطالب بيكمل الدرس صوتي بدون تمارين حتى لو كل شي ثاني تمام. هاد بدو حل من جهة الخادم، قولي وبشتغل عليه."
          : `الخادم ما قدر يفتح التمارين: ${facts.serverKeyMessage || "سبب غير معروف"}`,
    },
  ];
  const firstFail = steps.find((step) => step.state === "fail");
  return {
    steps,
    verdict: firstFail ? "spoken" : "exercises",
    reason: firstFail ? firstFail.hint : "كل شي تمام: الطالب رح يشوف نافذة التمارين مع الدرس.",
  };
}

/** Publishing a lesson also publishes its exercises, when they exist, wait as a draft and are sound. */
export function shouldPublishExercisesWithLesson(view: {
  hasContent: boolean;
  status: "none" | "draft" | "published";
  problems: number;
}): boolean {
  return view.hasContent && view.status === "draft" && view.problems === 0;
}
