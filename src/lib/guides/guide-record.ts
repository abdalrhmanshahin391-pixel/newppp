// The life of one guide row, as plain functions: its states, when a state is stuck, the stored file
// name, and what the admin is told when something fails. Pure, so it is tested with node.
import type { GuideProblem } from "./guide-prompts.ts";

export const GUIDE_STATUSES = ["writing", "written", "rendering", "ready", "failed"] as const;
export type GuideStatus = (typeof GUIDE_STATUSES)[number];

/** What the admin's page needs of a guide (the content itself is not sent to the list). */
export type GuideRow = {
  id: string;
  curriculum_id: string;
  title: string;
  from_page: number;
  to_page: number;
  status: GuideStatus;
  version: number;
  warnings: GuideProblem[];
  storage_path: string | null;
  error_code: string | null;
  error_message: string | null;
  model: string | null;
  created_at: string;
  updated_at: string;
};

/** A guide that has been writing or rendering for this long is treated as lost. */
export const STUCK_AFTER_MS = 5 * 60_000;

export function isBusy(status: GuideStatus): boolean {
  return status === "writing" || status === "rendering";
}

export function isStuck(row: Pick<GuideRow, "status" | "updated_at">, now = Date.now()): boolean {
  if (!isBusy(row.status)) return false;
  const at = Date.parse(row.updated_at);
  return Number.isFinite(at) && now - at > STUCK_AFTER_MS;
}

/** The private path of a guide's PDF: grouped by book, one file per version. */
export function guideStoragePath(curriculumId: string, guideId: string, version: number): string {
  return `${curriculumId}/${guideId}-v${version}.pdf`;
}

/** A file name that is safe on every system, for the download. */
export function guideFileName(title: string, version: number): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `uzyra-guide-${base || "lesson"}-v${version}.pdf`;
}

export const GUIDE_ERROR_CODES = [
  "no_pages",
  "ai_unavailable",
  "ai_bad_format",
  "render_not_configured",
  "render_unreachable",
  "render_failed",
  "upload_failed",
  "stuck",
] as const;
export type GuideErrorCode = (typeof GUIDE_ERROR_CODES)[number];

/** Plain words for the admin (Jordanian Arabic, like the rest of the admin screens). */
export function describeGuideError(code: string | null): string {
  switch (code) {
    case "no_pages":
      return "ما لقيت نص لصفحات هالدرس. اقرأ الصفحات بخطوة «قراءة الكتاب» أولاً.";
    case "ai_unavailable":
      return "ما قدرت أوصل لـOpenAI (المفتاح ناقص أو الخدمة مشغولة). جرّب بعد شوي.";
    case "ai_bad_format":
      return "رد الذكاء الاصطناعي ما طابق الشكل المطلوب. أعد المحاولة.";
    case "render_not_configured":
      return "خدمة الـPDF مش مضبوطة: MODAL_START_TOKEN ناقص أو غلط بأسرار الموقع.";
    case "render_unreachable":
      return "خدمة الـPDF مش شغّالة (Modal). تأكد إنها منشورة وجرّب بعد شوي.";
    case "render_failed":
      return "خدمة الـPDF ردّت بخطأ وهي بترسم الملف. أعد المحاولة.";
    case "upload_failed":
      return "الملف انرسم بس ما انحفظ. تأكد إنو الميجريشن مطبّق وبعدين أعد المحاولة.";
    case "stuck":
      return "العملية علقت أكثر من 5 دقايق. أعد المحاولة.";
    default:
      return "صار خطأ غير معروف. أعد المحاولة.";
  }
}

export function problemCounts(problems: GuideProblem[]): {
  high: number;
  medium: number;
  low: number;
} {
  const counts = { high: 0, medium: 0, low: 0 };
  for (const problem of problems) counts[problem.severity] += 1;
  return counts;
}

/** A short line for the list: pages, review notes. */
export function guideMeta(row: Pick<GuideRow, "from_page" | "to_page" | "warnings">): string {
  const pages =
    row.from_page === row.to_page ? `ص ${row.from_page}` : `ص ${row.from_page}–${row.to_page}`;
  const { high, medium, low } = problemCounts(row.warnings);
  const total = high + medium + low;
  if (!total) return `${pages} · بلا ملاحظات مراجعة`;
  return `${pages} · ${total} ${total === 1 ? "ملاحظة" : "ملاحظات"} مراجعة${high ? ` (${high} مهمة)` : ""}`;
}
