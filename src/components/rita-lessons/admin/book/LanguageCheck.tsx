import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useLanguageRegistry } from "@/hooks/useLearningLanguage";
import {
  adminCurriculumLanguageCheck,
  adminSetCurriculumLanguage,
} from "@/lib/rita-curriculum.functions";
import { errorText } from "./book-utils";

type Row = Awaited<ReturnType<typeof adminCurriculumLanguageCheck>>[number];

/**
 * Above the books: every book's language, and a warning when its pages read as another language
 * (its lessons would show to the wrong learners). One tap sets the language the pages suggest.
 * The guess counts common words, so the admin confirms; a book about German written in English
 * can read as English.
 */
export function LanguageCheck({ onChanged }: { onChanged: () => void }) {
  const checkFn = useServerFn(adminCurriculumLanguageCheck);
  const setFn = useServerFn(adminSetCurriculumLanguage);
  const registry = useLanguageRegistry();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      setRows(await checkFn());
    } catch (cause) {
      setError(errorText(cause));
    }
  }, [checkFn]);

  useEffect(() => {
    void load();
  }, [load]);

  const name = (code: string | null) =>
    code ? (registry.all.find((l) => l.code === code)?.name_ar ?? code) : "مش واضح";

  async function fix(row: Row) {
    if (!row.guess) return;
    setBusy(row.id);
    try {
      await setFn({ data: { curriculumId: row.id, language: row.guess } });
      await load();
      onChanged();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy("");
    }
  }

  if (error)
    return (
      <p className="rounded-xl bg-[#fff6e5] p-3 text-[14px] text-[#6b4100]">
        ما قدرنا نفحص لغة الكتب: {error}
      </p>
    );
  if (!rows)
    return (
      <p className="flex items-center gap-2 text-[14px] text-[var(--pp-muted)]">
        <Loader2 size={15} className="animate-spin" aria-hidden="true" /> عم نفحص لغة الكتب…
      </p>
    );

  const wrong = rows.filter((row) => row.mismatch);
  return (
    <section
      aria-label="فحص لغة الكتب"
      data-language-check
      className={`rounded-2xl border p-4 ${wrong.length ? "border-[#e5484d] bg-[#fff5f5]" : "border-[var(--pp-line)] bg-white"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[15px] font-semibold">
          {wrong.length ? (
            <AlertTriangle size={18} className="text-[#c4161c]" aria-hidden="true" />
          ) : (
            <CheckCircle2 size={18} className="text-[#1f9d57]" aria-hidden="true" />
          )}
          {wrong.length
            ? `${wrong.length} ${wrong.length === 1 ? "كتاب لغته" : "كتب لغتها"} مش مطابقة لصفحاته — دروسه بتطلع للمتعلّمين الغلط`
            : "لغة كل الكتب مطابقة لصفحاتها"}
        </p>
        <button
          type="button"
          className="rita-btn rita-btn-quiet rita-btn-sm"
          aria-expanded={open || wrong.length > 0}
          onClick={() => setOpen((value) => !value)}
        >
          {open || wrong.length ? "إخفاء التفاصيل" : "عرض كل الكتب"}
        </button>
      </div>
      {(open || wrong.length > 0) && (
        <ul className="mt-3 divide-y divide-[var(--pp-line)]">
          {(open ? rows : wrong).map((row) => (
            <li
              key={row.id}
              data-book={row.id}
              data-mismatch={row.mismatch || undefined}
              className="flex flex-wrap items-center justify-between gap-2 py-2 text-[14px]"
            >
              <span className="min-w-0">
                <span className="font-semibold" dir="auto">
                  {row.title}
                </span>
                <span className="block text-[13px] text-[var(--pp-muted)]">
                  اللغة المحددة: {name(row.language)} · الصفحات شكلها: {name(row.guess)} (كلمات
                  إنجليزي {row.markers.en}، ألماني {row.markers.de})
                  {row.status !== "published" ? " · مسودة" : ""}
                </span>
              </span>
              {row.mismatch && row.guess && (
                <button
                  type="button"
                  className="rita-btn rita-btn-primary rita-btn-sm"
                  disabled={busy === row.id}
                  onClick={() => void fix(row)}
                >
                  {busy === row.id ? "عم نغيّر…" : `غيّرها لـ${name(row.guess)}`}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[12px] text-[var(--pp-muted)]">
        التخمين من الكلمات الشائعة بأول الصفحات. كتاب بيعلّم الألماني ومكتوب بالإنجليزي ممكن يطلع
        «إنجليزي»: تأكد قبل ما تغيّر.
      </p>
    </section>
  );
}
