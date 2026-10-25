// Helpers shared by the curriculum admin screens: plain-Arabic error messages, the saved PDF of a
// book, and a lesson row in the shape the lesson editor uses.
import { supabase } from "@/integrations/supabase/legacy-client";
import type { LessonDraft } from "@/lib/rita-curriculum";
import type { CurriculumRow, LessonRow } from "@/lib/rita-curriculum.functions";

export const BUCKET = "rita-curricula";

/** Common server errors translated into Arabic guidance. */
const ERROR_HINTS: [RegExp, string][] = [
  [
    /OPENAI_API_KEY|server secrets/i,
    "مفتاح OpenAI غير مضبوط في أسرار الخادم. أضِف OPENAI_API_KEY من إعدادات المشروع ثم أعد المحاولة.",
  ],
  [/took too long/i, "رد الذكاء الاصطناعي أخذ وقت طويل. استنى دقيقة وأعد المحاولة."],
  [
    /did not match the expected format/i,
    "رد الذكاء الاصطناعي ما طابق الشكل المطلوب. أعد المحاولة، وإذا تكرر جرّب مرة ثانية بعد شوي.",
  ],
  [
    /insufficient_quota|exceeded your current quota|billing/i,
    "رصيد OpenAI مش كافي أو الفوترة متوقفة. افحص حساب OpenAI.",
  ],
  [
    /OpenAI 401|Incorrect API key/i,
    "مفتاح OpenAI مرفوض (401). احفظه من جديد بصفحة مفاتيح الذكاء الاصطناعي.",
  ],
  [/OpenAI 403/i, "مفتاح OpenAI ما إله صلاحية على النموذج المطلوب. راجع المشروع أو الصلاحيات."],
  [/429|rate limit/i, "وصلنا حد الاستخدام مؤقتاً. استنى شوي ثم أعد المحاولة."],
  [/Forbidden: admin only/i, "هاد الإجراء للمشرفين بس."],
  [/has not been read yet/i, "ما بنقدر نصنع الدرس قبل ما تنقرأ صفحاته. كمّل قراءة الكتاب أولاً."],
  [/A lesson can use at most 10 pages/i, "الدرس الواحد بياخد 10 صفحات كحد أقصى."],
  [/rita_lesson_slides/i, "السلايدات بدها تحديث قاعدة البيانات (migration 20261017120000)."],
  [
    /20261025100000|rita_lesson_contents/i,
    "التمارين بدها تحديث قاعدة البيانات (migration 20261025100000_rita_lessons_v2).",
  ],
  [
    /Could not find the function|does not exist/i,
    "هالميزة بدها تحديث قاعدة البيانات (migration 20261015120000).",
  ],
];

export function errorText(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  // Keep the actionable page list from the server, not just the generic hint.
  const missingPages = message.match(/no text yet: ([0-9,\s]+)/i);
  if (missingPages) {
    return `الصفحات ${missingPages[1].trim()} لسا بلا نص. كمّل القراءة، أو علّمها فارغة من «تفاصيل الصفحات».`;
  }
  for (const [pattern, hint] of ERROR_HINTS) {
    if (pattern.test(message)) return hint;
  }
  return message || "صار خطأ";
}

/**
 * The server's own words for an error, when the Arabic hint above would hide them: the reason a
 * reply was refused, a status code. Empty when the hint already says everything.
 */
export function errorDetail(error: unknown) {
  const message = (error instanceof Error ? error.message : String(error ?? "")).trim();
  if (!message || message === errorText(error)) return "";
  return message.slice(0, 400);
}

/** The book's PDF: the one just uploaded in this tab, or the saved copy. */
export async function pdfFileFor(book: CurriculumRow, cache: Map<string, File>) {
  const cached = cache.get(book.id);
  if (cached) return cached;
  if (!book.pdf_path) throw new Error("ما في ملف PDF محفوظ لهالكتاب.");
  const { data, error } = await supabase.storage.from(BUCKET).download(book.pdf_path);
  if (error || !data) throw new Error("ما قدرنا ننزّل ملف الكتاب.");
  const file = new File([data], `${book.id}.pdf`, { type: "application/pdf" });
  cache.set(book.id, file);
  return file;
}

/** A lesson row back in the shape the AI and the lesson editor use. */
export function lessonToDraft(lesson: LessonRow): LessonDraft {
  const plan = lesson.plan as LessonDraft["plan"] & { summary?: string };
  return {
    title: lesson.title,
    title_ar: lesson.title_ar,
    topic: lesson.topic,
    source_from_page: lesson.source_from_page,
    source_to_page: lesson.source_to_page,
    summary: plan.summary ?? "",
    objectives: lesson.objectives,
    plan: { phases: plan.phases ?? [], teacher_notes: plan.teacher_notes ?? "" },
    vocabulary: lesson.vocabulary,
    image_prompt: lesson.image_prompt ?? "",
  };
}

export function pagesLabel(from: number, to: number) {
  return to !== from ? `ص${from}–${to}` : `ص${from}`;
}
