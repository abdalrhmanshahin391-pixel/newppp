// Where a book is on its way to learners, and what the admin should do next. The admin screen
// shows four steps (read, lessons, review, publish) and one "next" button per book; these rules
// decide both. Pure, so they are unit tested with node.
import { suggestNextTopics, type TopicSuggestion } from "./rita-slides.ts";

export const BOOK_STEPS = ["read", "lessons", "review", "publish"] as const;
export type BookStep = (typeof BOOK_STEPS)[number];

export const STEP_LABEL: Record<BookStep, string> = {
  read: "قراءة الكتاب",
  lessons: "الدروس",
  review: "المراجعة",
  publish: "النشر",
};

/** What the exercises of one lesson look like to the admin (from adminExercisesSummary). */
export type ExercisesState = {
  status: "none" | "draft" | "published";
  warnings: number;
  problems: number;
};

export type BookLike = {
  status: "draft" | "published" | "archived";
  page_count: number;
  read_cursor: number;
};

export type LessonLike = {
  id: string;
  status: "draft" | "published" | "archived";
  topic: string;
  title: string;
  source_from_page: number;
  source_to_page: number;
};

export type LessonReadiness =
  "published" | "ready" | "warnings" | "problems" | "no_exercises" | "archived";

/**
 * A lesson's state in the review list. "ready": exercises written with nothing flagged.
 * "warnings": the second review flagged something to look at (it can still be published).
 * "problems": the code checks fail, so its exercises cannot be published. "no_exercises": only the
 * spoken lesson exists.
 */
export function lessonReadiness(
  lesson: LessonLike,
  exercises: ExercisesState | undefined,
): LessonReadiness {
  if (lesson.status === "archived") return "archived";
  if (exercises && exercises.problems > 0) return "problems";
  if (lesson.status === "published" && (!exercises || exercises.status !== "draft"))
    return "published";
  if (!exercises || exercises.status === "none") return "no_exercises";
  if (exercises.warnings > 0) return "warnings";
  return "ready";
}

export const READINESS_LABEL: Record<LessonReadiness, string> = {
  published: "منشور",
  ready: "جاهز",
  warnings: "فيه ملاحظات",
  problems: "فيه مشكلة",
  no_exercises: "بدون تمارين",
  archived: "مؤرشف",
};

export type BookProgress = {
  pagesRead: number;
  pageCount: number;
  missingPages: number;
  readDone: boolean;
  lessons: number;
  readyLessons: number;
  publishedLessons: number;
  /** The step to open, and the words on the book's one button. */
  next: { step: BookStep; label: string };
  /** For the four dots: which steps are done. */
  done: Record<BookStep, boolean>;
};

export function bookProgress(input: {
  book: BookLike;
  lessons: LessonLike[];
  missingPages: number;
  exercises: Record<string, ExercisesState>;
  /** Topics read but not yet turned into lessons. */
  openSuggestions: number;
}): BookProgress {
  const { book } = input;
  const live = input.lessons.filter((lesson) => lesson.status !== "archived");
  const readiness = live.map((lesson) => lessonReadiness(lesson, input.exercises[lesson.id]));
  const publishedLessons = readiness.filter((state) => state === "published").length;
  const readyLessons = readiness.filter(
    (state) => state === "ready" || state === "warnings",
  ).length;
  const readDone = book.page_count > 0 && book.read_cursor >= book.page_count;
  const lessonsDone = live.length > 0 && input.openSuggestions === 0 && readDone;
  const reviewDone =
    live.length > 0 && readiness.every((state) => state === "published" || state === "ready");
  const publishDone =
    book.status === "published" && live.length > 0 && publishedLessons === live.length;

  let next: BookProgress["next"];
  if (!readDone) {
    next = { step: "read", label: book.read_cursor > 0 ? "كمّل القراءة" : "اقرأ الكتاب" };
  } else if (live.length === 0 || input.openSuggestions > 0) {
    next = { step: "lessons", label: live.length ? "كمّل الدروس" : "اصنع الدروس" };
  } else if (readiness.some((state) => state !== "published" && state !== "ready")) {
    next = { step: "review", label: "راجع الدروس" };
  } else if (!publishDone) {
    next = { step: "publish", label: "انشر للطلاب" };
  } else {
    next = { step: "review", label: "افتح الكتاب" };
  }
  return {
    pagesRead: Math.min(book.read_cursor, book.page_count),
    pageCount: book.page_count,
    missingPages: input.missingPages,
    readDone,
    lessons: live.length,
    readyLessons,
    publishedLessons,
    next,
    done: { read: readDone, lessons: lessonsDone, review: reviewDone, publish: publishDone },
  };
}

/** Lessons the book's reading summaries suggest that do not exist yet, in page order. */
export function lessonPlan(input: {
  suggestions: TopicSuggestion[];
  lessons: (LessonLike & { status: string })[];
  readCursor: number;
}): TopicSuggestion[] {
  return suggestNextTopics({
    suggestions: input.suggestions,
    lessons: input.lessons,
    readCursor: input.readCursor,
    limit: 40,
  }).sort((a, b) => a.from_page - b.from_page || a.to_page - b.to_page);
}

/** Lessons the "publish everything ready" button will publish (and which it leaves alone). */
export function publishPlan(
  lessons: LessonLike[],
  exercises: Record<string, ExercisesState>,
): { publish: string[]; withExercises: string[]; spokenOnly: string[]; blocked: string[] } {
  const publish: string[] = [];
  const withExercises: string[] = [];
  const spokenOnly: string[] = [];
  const blocked: string[] = [];
  for (const lesson of lessons) {
    const state = lessonReadiness(lesson, exercises[lesson.id]);
    if (state === "archived" || state === "published") continue;
    if (state === "problems") {
      blocked.push(lesson.id);
      continue;
    }
    publish.push(lesson.id);
    if (state === "no_exercises") spokenOnly.push(lesson.id);
    else withExercises.push(lesson.id);
  }
  return { publish, withExercises, spokenOnly, blocked };
}
