import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, ArrowDown, ArrowUp, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/legacy-client";
import { useAuth } from "@/hooks/useAuth";
import { LANGUAGES_QUERY_KEY, useLanguageRegistry } from "@/hooks/useLearningLanguage";
import { guardRedirect } from "@/lib/guard-redirect";
import {
  sortLanguages,
  validateNewLanguage,
  type LearningLanguage,
  type NewLanguageInput,
} from "@/lib/learning-language";

export const Route = createFileRoute("/admin/languages")({
  head: () => ({
    meta: [
      { title: "Learning languages — Administration Site" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLanguages,
});

const field =
  "w-full rounded-lg border-2 border-[var(--pp-ink)] bg-white px-3 py-2 text-[16px] outline-none focus-visible:border-[var(--pp-accent)]";

const EMPTY: NewLanguageInput = {
  code: "",
  name_en: "",
  name_native: "",
  name_ar: "",
  direction: "ltr",
  speech_code: "",
};

type Counts = Record<string, { learners: number | null; books: number | null }>;

async function loadCounts(codes: string[]): Promise<Counts> {
  const entries = await Promise.all(
    codes.map(async (code) => {
      const [learners, books] = await Promise.all([
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("learning_language", code),
        supabase
          .from("rita_curricula")
          .select("id", { count: "exact", head: true })
          .eq("target_language", code),
      ]);
      return [
        code,
        {
          learners: learners.error ? null : (learners.count ?? 0),
          books: books.error ? null : (books.count ?? 0),
        },
      ] as const;
    }),
  );
  return Object.fromEntries(entries);
}

function AdminLanguages() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const registry = useLanguageRegistry();
  const [form, setForm] = useState<NewLanguageInput>(EMPTY);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyCode, setBusyCode] = useState("");

  useEffect(() => {
    if (!loading && !isAdmin) guardRedirect(navigate);
  }, [loading, isAdmin, navigate]);

  const codes = registry.all.map((l) => l.code).join(",");
  const counts = useQuery({
    queryKey: ["learning-language-counts", codes],
    queryFn: () => loadCounts(registry.all.map((l) => l.code)),
    enabled: isAdmin && registry.fromDb,
    staleTime: 30_000,
    retry: false,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: LANGUAGES_QUERY_KEY });

  async function patch(code: string, changes: Partial<LearningLanguage>, done?: string) {
    setBusyCode(code);
    const { error } = await supabase.from("learning_languages").update(changes).eq("code", code);
    setBusyCode("");
    if (error) {
      toast.error(`تعذّر الحفظ: ${error.message}`);
      return;
    }
    await refresh();
    if (done) toast.success(done);
  }

  async function toggleEnabled(language: LearningLanguage) {
    const enabledCount = registry.all.filter((l) => l.enabled).length;
    if (language.enabled && enabledCount <= 1) {
      toast.error("لازم تبقى لغة واحدة مفعّلة على الأقل.");
      return;
    }
    if (
      language.enabled &&
      !window.confirm(
        `تعطيل ${language.name_ar}؟ الطلاب اللي اختاروها رح يُطلب منهم اختيار لغة ثانية، ومحتواهم يبقى محفوظ.`,
      )
    ) {
      return;
    }
    await patch(language.code, { enabled: !language.enabled });
  }

  async function move(language: LearningLanguage, direction: -1 | 1) {
    const order = sortLanguages(registry.all);
    const from = order.findIndex((l) => l.code === language.code);
    const to = from + direction;
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    [next[from], next[to]] = [next[to]!, next[from]!];
    setBusyCode(language.code);
    // Renumber the whole (short) list so every language has its own position.
    const results = await Promise.all(
      next.map((item, i) =>
        item.sort === (i + 1) * 10
          ? null
          : supabase
              .from("learning_languages")
              .update({ sort: (i + 1) * 10 })
              .eq("code", item.code),
      ),
    );
    setBusyCode("");
    const failed = results.find((r) => r?.error);
    if (failed?.error) toast.error(`تعذّر الترتيب: ${failed.error.message}`);
    await refresh();
  }

  async function add(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    const result = validateNewLanguage(
      form,
      registry.all.map((l) => l.code),
    );
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setSaving(true);
    const sort = Math.max(0, ...registry.all.map((l) => l.sort)) + 10;
    const { error } = await supabase
      .from("learning_languages")
      .insert({ ...result.value, sort, voice_enabled: false, enabled: true });
    setSaving(false);
    if (error) {
      setFormError(error.message);
      return;
    }
    setForm(EMPTY);
    await refresh();
    toast.success(`أُضيفت ${result.value.name_ar}. صارت متاحة للطلاب الآن.`);
  }

  if (loading || !isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  const list = sortLanguages(registry.all);

  return (
    <main
      dir="rtl"
      className="edith-premium min-h-screen bg-white pb-24 text-[var(--pp-ink)]"
      style={{ fontFamily: "var(--font-grotesk), 'Noto Sans Arabic', sans-serif" }}
    >
      <header className="border-b border-[var(--pp-line)] bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <div>
            <p className="text-xs font-semibold text-[var(--pp-accent-text)]">لوحة الإدارة</p>
            <h1 className="text-[28px] font-bold leading-8">لغات التعلّم</h1>
          </div>
          <Link
            to="/admin"
            className="flex min-h-11 items-center gap-1 rounded-lg border border-[var(--pp-line)] px-4 text-sm font-bold"
          >
            الإدارة <ArrowLeft size={15} />
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-6 px-5 pt-6">
        <p className="max-w-[60ch] text-[15px] leading-[1.6] text-[#4b4a5c]">
          كل لغة هنا مساحة منفصلة: بطاقاتها ودروسها ومحادثاتها. اللغة الجديدة بتظهر للطلاب فوراً
          بدون محتوى، وبتبني محتواها بأدوات المناهج والمجموعات الموجودة. محادثة ريتا الصوتية ما
          بتنفتح للغة إلا بعد ما تجرّبها وتشغّل «الصوت».
        </p>

        {!registry.fromDb && (
          <div className="flex items-start gap-3 rounded-2xl border-2 border-[#f5b942] bg-[#f4f4f8] p-4 text-sm font-bold text-[#8a5200]">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <p>
              جدول اللغات غير موجود بعد. طبّق migration ‏20261020180000 (‏learning_languages) في
              Lovable Cloud ثم حدّث الصفحة. حتى ذلك الحين تظهر الإنجليزية والألمانية فقط ولا يمكن
              تعديلها.
            </p>
          </div>
        )}

        <section aria-label="اللغات الحالية" className="grid gap-3">
          {registry.isLoading && (
            <div role="status" className="h-24 animate-pulse rounded-2xl bg-[var(--pp-grey)]" />
          )}
          {list.map((language, index) => {
            const busy = busyCode === language.code;
            const count = counts.data?.[language.code];
            return (
              <article
                key={language.code}
                className={`rounded-2xl border-2 p-4 ${
                  language.enabled
                    ? "border-[var(--pp-ink)] bg-white"
                    : "border-[var(--pp-line)] bg-[var(--pp-grey)]"
                }`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    dir="ltr"
                    className="rounded-md bg-[var(--pp-grey)] px-2 py-0.5 text-[12px] font-bold uppercase text-[var(--pp-muted)]"
                  >
                    {language.code}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p lang={language.code} dir="auto" className="truncate text-[20px] font-bold">
                      {language.name_native}
                    </p>
                    <p className="text-[14px] text-[var(--pp-muted)]">
                      {language.name_ar} · {language.name_en} · {language.direction.toUpperCase()} ·
                      كود الصوت <span dir="ltr">{language.speech_code}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="حرّك للأعلى"
                      disabled={!registry.fromDb || busy || index === 0}
                      onClick={() => void move(language, -1)}
                      className="grid size-11 place-items-center rounded-lg border-2 border-[var(--pp-ink)] disabled:opacity-40"
                    >
                      <ArrowUp size={18} />
                    </button>
                    <button
                      type="button"
                      aria-label="حرّك للأسفل"
                      disabled={!registry.fromDb || busy || index === list.length - 1}
                      onClick={() => void move(language, 1)}
                      className="grid size-11 place-items-center rounded-lg border-2 border-[var(--pp-ink)] disabled:opacity-40"
                    >
                      <ArrowDown size={18} />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[var(--pp-line)] pt-3 text-[15px]">
                  <label className="flex min-h-11 items-center gap-2 font-semibold">
                    <input
                      type="checkbox"
                      className="size-5 accent-[var(--pp-accent)]"
                      checked={language.enabled}
                      disabled={!registry.fromDb || busy}
                      onChange={() => void toggleEnabled(language)}
                    />
                    ظاهرة للطلاب
                  </label>
                  <label className="flex min-h-11 items-center gap-2 font-semibold">
                    <input
                      type="checkbox"
                      className="size-5 accent-[var(--pp-accent)]"
                      checked={language.voice_enabled}
                      disabled={!registry.fromDb || busy}
                      onChange={() =>
                        void patch(language.code, { voice_enabled: !language.voice_enabled })
                      }
                    />
                    محادثة ريتا الصوتية
                  </label>
                  <span className="text-[14px] text-[var(--pp-muted)]">
                    {count
                      ? `${count.learners ?? "—"} متعلّم · ${count.books ?? "—"} كتاب منهج`
                      : counts.isLoading
                        ? "…"
                        : ""}
                  </span>
                  {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                </div>
              </article>
            );
          })}
        </section>

        <section aria-labelledby="add-language" className="rounded-2xl bg-[var(--pp-grey)] p-5">
          <h2 id="add-language" className="text-[20px] font-bold">
            إضافة لغة جديدة
          </h2>
          <form onSubmit={add} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold">
              الكود (مثل fr أو es أو pt-br)
              <input
                dir="ltr"
                className={field}
                value={form.code}
                maxLength={12}
                autoCapitalize="none"
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              كود الصوت (اختياري، الافتراضي نفس الكود)
              <input
                dir="ltr"
                className={field}
                value={form.speech_code ?? ""}
                maxLength={12}
                autoCapitalize="none"
                onChange={(e) => setForm({ ...form, speech_code: e.target.value })}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              الاسم بالإنجليزي
              <input
                dir="ltr"
                className={field}
                value={form.name_en}
                maxLength={60}
                onChange={(e) => setForm({ ...form, name_en: e.target.value })}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              الاسم بالعربي
              <input
                className={field}
                value={form.name_ar}
                maxLength={60}
                onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              الاسم باللغة نفسها (مثل Français)
              <input
                dir="auto"
                className={field}
                value={form.name_native}
                maxLength={60}
                onChange={(e) => setForm({ ...form, name_native: e.target.value })}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              اتجاه الكتابة
              <select
                className="rita-select"
                value={form.direction}
                onChange={(e) =>
                  setForm({ ...form, direction: e.target.value === "rtl" ? "rtl" : "ltr" })
                }
              >
                <option value="ltr">من اليسار لليمين</option>
                <option value="rtl">من اليمين لليسار</option>
              </select>
            </label>
            <div className="sm:col-span-2">
              {formError && (
                <p role="alert" className="mb-3 text-sm font-bold text-[#b3213f]">
                  {formError}
                </p>
              )}
              <button
                type="submit"
                disabled={!registry.fromDb || saving}
                className="rita-btn rita-btn-primary gap-2 disabled:opacity-40"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                أضف اللغة
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
