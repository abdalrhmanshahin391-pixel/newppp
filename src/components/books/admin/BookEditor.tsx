// The book editor: five sections (identity, classification, files, availability, display), with
// the live book and a readiness list beside them. Publishing waits for the files; the database
// checks the same three rules again (title, category, rights).
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useLanguageRegistry } from "@/hooks/useLearningLanguage";
import { BookObject } from "@/components/books/BookObject";
import {
  BOOK_LEVELS,
  fromLocalInput,
  normalizeIsbn,
  publishIssues,
  publishWarnings,
  toLocalInput,
  type Book,
  type BookCategory,
  type BookShelf,
  type BookStatus,
  type BookTag,
} from "@/lib/books";
import {
  RESUMABLE_FROM,
  saveBook,
  saveShelfBooks,
  setFeatured,
  type BookInput,
  type SaveProgress,
} from "@/lib/books-data";
import { Choice, field, label, muted, STATUS_WORDS } from "./admin-ui";

const MAX_COVER = 5 * 1024 * 1024;
const MAX_PDF = 50 * 1024 * 1024;

const ISSUE_WORDS = { title: "العنوان", category: "التصنيف الأساسي", rights: "مراجعة الحقوق" };
const WARNING_WORDS = {
  cover: "صورة الغلاف",
  pdf: "ملف الكتاب PDF",
  isbn: "رقم ISBN",
  year: "سنة النشر",
  description: "الوصف",
};

export function BookEditor({
  book,
  categories,
  tags,
  shelves,
  featuredId,
  phase1,
  onClose,
  onSaved,
}: {
  book: Book | null;
  categories: BookCategory[];
  tags: BookTag[];
  shelves: BookShelf[];
  featuredId: string | null;
  phase1: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const registry = useLanguageRegistry();
  const [value, setValue] = useState<BookInput>(() => ({
    title: book?.title ?? "",
    alt_title: book?.alt_title ?? "",
    author: book?.author ?? "",
    isbn: book?.isbn ?? null,
    description: book?.description ?? "",
    category_id: book?.category_id ?? categories[0]?.id ?? null,
    secondary_category_ids: book?.secondary_category_ids ?? [],
    tag_ids: book?.tag_ids ?? [],
    level: book?.level ?? "B1",
    language: book?.language ?? "en",
    pages: book?.pages ?? null,
    year: book?.year ?? null,
    status: book?.status ?? "draft",
    rights_checked: book?.rights_checked ?? false,
  }));
  const [isbnText, setIsbnText] = useState(book?.isbn ?? "");
  const wasFeatured = Boolean(book?.featured);
  const [featured, setFeaturedOn] = useState(wasFeatured);
  const [featuredFrom, setFeaturedFrom] = useState(toLocalInput(book?.featured_from ?? null));
  const [featuredUntil, setFeaturedUntil] = useState(toLocalInput(book?.featured_until ?? null));
  const startShelves = useMemo(
    () => shelves.filter((s) => book && s.book_ids.includes(book.id)).map((s) => s.id),
    [shelves, book],
  );
  const [onShelves, setOnShelves] = useState<string[]>(startShelves);
  const [cover, setCover] = useState<File | null>(null);
  const [pdf, setPdf] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(book?.cover_url ?? null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<SaveProgress>({});
  const [error, setError] = useState("");

  useEffect(() => {
    if (!cover) return;
    const url = URL.createObjectURL(cover);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && !saving && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const category = categories.find((c) => c.id === value.category_id) ?? null;
  const number = (text: string) => (text.trim() === "" ? null : Math.round(Number(text)));
  const set = (patch: Partial<BookInput>) => setValue((v) => ({ ...v, ...patch }));
  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const isbn = normalizeIsbn(isbnText);
  const issues = publishIssues(value).filter((k) => phase1 || k !== "rights");
  const warnings = publishWarnings({
    cover_path: cover ? "new" : (book?.cover_path ?? null),
    file_path: pdf ? "new" : (book?.file_path ?? null),
    isbn: isbn === "invalid" ? null : isbn,
    year: value.year,
    description: value.description,
  });
  const ready = issues.length === 0;
  const statusOptions: [BookStatus, string][] = phase1
    ? [
        ["draft", STATUS_WORDS.draft],
        ["published", STATUS_WORDS.published],
        ["archived", STATUS_WORDS.archived],
      ]
    : [
        ["draft", STATUS_WORDS.draft],
        ["published", STATUS_WORDS.published],
      ];

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!value.title.trim()) return setError("اكتب عنوان الكتاب.");
    if (value.pages !== null && !(value.pages >= 1 && value.pages <= 5000))
      return setError("عدد الصفحات لازم يكون بين 1 و 5000.");
    if (value.year !== null && !(value.year >= -3000 && value.year <= 2100))
      return setError("سنة النشر مش منطقية.");
    if (isbn === "invalid") return setError("شكل الـ ISBN غلط (10 أو 13 رقم).");
    if (phase1 && value.status === "published" && !ready)
      return setError(`ما بينشر قبل: ${issues.map((k) => ISSUE_WORDS[k]).join("، ")}.`);
    if (cover && cover.size > MAX_COVER) return setError("صورة الغلاف أكبر من 5 ميغا.");
    if (cover && !/^image\/(jpeg|png|webp)$/.test(cover.type))
      return setError("الغلاف لازم يكون صورة JPG أو PNG أو WebP.");
    if (pdf && pdf.size > MAX_PDF) return setError("ملف الكتاب أكبر من 50 ميغا.");
    if (pdf && pdf.type !== "application/pdf") return setError("ملف الكتاب لازم يكون PDF.");
    const from = fromLocalInput(featuredFrom);
    const until = fromLocalInput(featuredUntil);
    if (featured && from && until && until <= from)
      return setError("نهاية مدة كتاب الأسبوع لازم تكون بعد بدايتها.");
    if (featured && value.status !== "published") return setError("كتاب الأسبوع لازم يكون منشور.");

    setSaving(true);
    setProgress({});
    try {
      const id = await saveBook(
        { ...value, isbn: isbn === "invalid" ? null : isbn },
        { cover, pdf },
        book ?? undefined,
        phase1,
        setProgress,
      );
      const periodChanged =
        featured &&
        (from !== (book?.featured_from ?? null) || until !== (book?.featured_until ?? null));
      if (featured && (!wasFeatured || periodChanged || featuredId !== id))
        await setFeatured(id, { from, until }, phase1);
      else if (!featured && wasFeatured)
        await setFeatured(null, { from: null, until: null }, phase1);
      if (phase1) {
        for (const shelf of shelves) {
          const had = shelf.book_ids.includes(id);
          const wants = onShelves.includes(shelf.id);
          if (had === wants) continue;
          await saveShelfBooks(
            shelf.id,
            wants ? [...shelf.book_ids, id] : shelf.book_ids.filter((b) => b !== id),
          );
        }
      }
      toast.success(book ? "انحفظ الكتاب" : "انضاف الكتاب");
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ما انحفظ الكتاب.");
    } finally {
      setSaving(false);
    }
  }

  const section = "grid gap-3 border-t border-[var(--pp-line)] pt-5 first:border-t-0 first:pt-0";
  const h = "mb-1 text-[16px] font-semibold";
  const bigFile = (file: File | null) => Boolean(file && file.size > RESUMABLE_FROM);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-[rgb(18_17_23/0.45)] sm:place-items-center sm:p-3"
      onClick={() => !saving && onClose()}
    >
      <form
        onSubmit={submit}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={book ? "عدّل الكتاب" : "كتاب جديد"}
        dir="rtl"
        className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-t-[22px] bg-white p-5 shadow-2xl sm:rounded-[22px]"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[20px] font-semibold">{book ? "عدّل الكتاب" : "كتاب جديد"}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="سكّر"
            className="grid h-11 w-11 place-items-center rounded-full hover:bg-[var(--pp-grey)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_220px]">
          <div className="grid content-start gap-5">
            {/* 1. Identity */}
            <fieldset className={section}>
              <legend className={h}>١. هوية الكتاب</legend>
              <label className={label}>
                العنوان
                <input
                  className={field}
                  dir="auto"
                  required
                  maxLength={200}
                  value={value.title}
                  onChange={(e) => set({ title: e.target.value })}
                />
              </label>
              {phase1 && (
                <label className={label}>
                  عنوان بديل (ترجمة أو العنوان الأصلي)
                  <input
                    className={field}
                    dir="auto"
                    maxLength={200}
                    value={value.alt_title}
                    onChange={(e) => set({ alt_title: e.target.value })}
                  />
                </label>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={label}>
                  الكاتب
                  <input
                    className={field}
                    dir="auto"
                    maxLength={160}
                    value={value.author}
                    onChange={(e) => set({ author: e.target.value })}
                  />
                </label>
                {phase1 && (
                  <label className={label}>
                    ISBN
                    <input
                      className={field}
                      dir="ltr"
                      inputMode="numeric"
                      value={isbnText}
                      aria-invalid={isbn === "invalid"}
                      onChange={(e) => setIsbnText(e.target.value)}
                    />
                    {isbn === "invalid" && (
                      <span className="text-[13px] text-[#8c1a31]">لازم يكون 10 أو 13 رقم.</span>
                    )}
                  </label>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <label className={`${label} col-span-2 sm:col-span-1`}>
                  لغة الكتاب
                  <select
                    className={`${field} rita-select`}
                    value={value.language}
                    onChange={(e) => set({ language: e.target.value })}
                  >
                    {registry.all.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.name_ar} · {l.name_native}
                      </option>
                    ))}
                    {!registry.all.some((l) => l.code === value.language) && (
                      <option value={value.language}>{value.language}</option>
                    )}
                  </select>
                </label>
                <label className={label}>
                  الصفحات
                  <input
                    className={field}
                    inputMode="numeric"
                    dir="ltr"
                    value={value.pages ?? ""}
                    onChange={(e) => set({ pages: number(e.target.value) })}
                  />
                </label>
                <label className={label}>
                  سنة النشر
                  <input
                    className={field}
                    inputMode="numeric"
                    dir="ltr"
                    value={value.year ?? ""}
                    onChange={(e) => set({ year: number(e.target.value) })}
                  />
                </label>
              </div>
              <label className={label}>
                وصف قصير
                <textarea
                  className={`${field} min-h-[96px]`}
                  dir="auto"
                  maxLength={1200}
                  value={value.description}
                  onChange={(e) => set({ description: e.target.value })}
                />
              </label>
            </fieldset>

            {/* 2. Classification */}
            <fieldset className={section}>
              <legend className={h}>٢. التصنيف</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={label}>
                  التصنيف الأساسي (رفّه بالمكتبة)
                  <select
                    className={`${field} rita-select`}
                    value={value.category_id ?? ""}
                    onChange={(e) => set({ category_id: e.target.value || null })}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name_ar}
                      </option>
                    ))}
                    <option value="">بدون تصنيف</option>
                  </select>
                </label>
                <label className={label}>
                  المستوى
                  <select
                    className={`${field} rita-select`}
                    value={value.level}
                    onChange={(e) => set({ level: e.target.value as Book["level"] })}
                  >
                    {BOOK_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {phase1 && categories.length > 1 && (
                <div className="grid gap-2">
                  <p className="text-[14px] font-semibold">تصنيفات ثانية (للبحث والفلترة)</p>
                  <div className="flex flex-wrap gap-2">
                    {categories
                      .filter((c) => c.id !== value.category_id)
                      .map((c) => (
                        <ToggleChip
                          key={c.id}
                          on={value.secondary_category_ids.includes(c.id)}
                          onClick={() =>
                            set({
                              secondary_category_ids: toggle(value.secondary_category_ids, c.id),
                            })
                          }
                        >
                          {c.name_ar}
                        </ToggleChip>
                      ))}
                  </div>
                </div>
              )}
              {phase1 && (
                <div className="grid gap-2">
                  <p className="text-[14px] font-semibold">الوسوم</p>
                  {tags.length ? (
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <ToggleChip
                          key={tag.id}
                          on={value.tag_ids.includes(tag.id)}
                          onClick={() => set({ tag_ids: toggle(value.tag_ids, tag.id) })}
                        >
                          {tag.name_ar}
                        </ToggleChip>
                      ))}
                    </div>
                  ) : (
                    <p className={muted}>لسا ما في وسوم. أضفها من تبويب «التصنيف».</p>
                  )}
                </div>
              )}
            </fieldset>

            {/* 3. Files */}
            <fieldset className={section}>
              <legend className={h}>٣. الملفات</legend>
              <FilePick
                id="bk-cover"
                title="صورة الغلاف"
                hint="JPG / PNG / WebP، لحد 5 ميغا"
                accept="image/jpeg,image/png,image/webp"
                has={Boolean(book?.cover_path)}
                file={cover}
                onPick={setCover}
              />
              <Progress share={progress.cover} />
              <FilePick
                id="bk-pdf"
                title="ملف الكتاب"
                hint="PDF، لحد 50 ميغا"
                accept="application/pdf"
                has={Boolean(book?.file_path)}
                file={pdf}
                onPick={setPdf}
              />
              <Progress share={progress.pdf} />
              {(bigFile(cover) || bigFile(pdf)) && (
                <p className={muted}>
                  الملف كبير: بينرفع على أجزاء، وإذا انقطع النت بيكمل من وين وقف.
                </p>
              )}
              {book && (cover || pdf) && (
                <p className={muted}>الملف القديم بينشال بس بعد ما ينحفظ الجديد.</p>
              )}
            </fieldset>

            {/* 4. Availability */}
            <fieldset className={section}>
              <legend className={h}>٤. الإتاحة</legend>
              <Choice
                name="حالة الكتاب"
                value={value.status}
                options={statusOptions}
                onChange={(status) => set({ status })}
              />
              <p className={muted}>المسودة والمؤرشف ما بيظهروا للقرّاء. المنشور بيظهر بالمكتبة.</p>
              {phase1 && (
                <label className="flex min-h-11 items-center gap-3 text-[15px] font-semibold">
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={value.rights_checked}
                    onChange={(e) => set({ rights_checked: e.target.checked })}
                  />
                  راجعت حقوق الكتاب (مسموح ننشره)
                </label>
              )}
            </fieldset>

            {/* 5. Display */}
            <fieldset className={section}>
              <legend className={h}>٥. أماكن العرض</legend>
              <label className="flex min-h-11 items-center gap-3 text-[15px] font-semibold">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={featured}
                  onChange={(e) => setFeaturedOn(e.target.checked)}
                />
                كتاب الأسبوع (واحد بس بالمكتبة)
              </label>
              {featured && phase1 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={label}>
                    من (اختياري)
                    <input
                      type="datetime-local"
                      className={field}
                      dir="ltr"
                      value={featuredFrom}
                      onChange={(e) => setFeaturedFrom(e.target.value)}
                    />
                  </label>
                  <label className={label}>
                    لحد (اختياري)
                    <input
                      type="datetime-local"
                      className={field}
                      dir="ltr"
                      value={featuredUntil}
                      onChange={(e) => setFeaturedUntil(e.target.value)}
                    />
                  </label>
                </div>
              )}
              {featured && featuredId && featuredId !== book?.id && (
                <p className={muted}>في كتاب أسبوع ثاني هلأ: بيتشال وبيصير هاد مكانه.</p>
              )}
              {phase1 && shelves.length > 0 && (
                <div className="grid gap-2">
                  <p className="text-[14px] font-semibold">على الرفوف اليدوية</p>
                  <div className="flex flex-wrap gap-2">
                    {shelves.map((shelf) => (
                      <ToggleChip
                        key={shelf.id}
                        on={onShelves.includes(shelf.id)}
                        onClick={() => setOnShelves(toggle(onShelves, shelf.id))}
                      >
                        {shelf.name_ar}
                      </ToggleChip>
                    ))}
                  </div>
                </div>
              )}
            </fieldset>
          </div>

          <aside className="grid content-start gap-4 md:sticky md:top-0">
            <div className="grid justify-items-center gap-2 rounded-2xl bg-[var(--pp-grey)] p-4">
              <p className="text-[13px] font-semibold text-[var(--pp-muted)]">هيك بيطلع</p>
              <BookObject
                book={{
                  title: value.title || "عنوان الكتاب",
                  author: value.author,
                  level: value.level,
                  cover_url: preview,
                }}
                color={category?.color}
              />
            </div>
            <div
              className="grid gap-2 rounded-2xl border border-[var(--pp-line)] p-4"
              aria-live="polite"
            >
              <p className="text-[15px] font-semibold">
                {ready ? "جاهز للنشر" : "لسا مش جاهز للنشر"}
              </p>
              <ul className="grid gap-1.5 text-[14px]">
                {(["title", "category", "rights"] as const)
                  .filter((k) => phase1 || k !== "rights")
                  .map((k) => {
                    const ok = !issues.includes(k);
                    return (
                      <li key={k} className="flex items-center gap-2">
                        <span
                          className={`grid h-5 w-5 place-items-center rounded-full text-white ${ok ? "bg-[#1d6b3a]" : "bg-[#b3213f]"}`}
                          aria-hidden="true"
                        >
                          {ok ? <Check size={12} /> : <X size={12} />}
                        </span>
                        {ISSUE_WORDS[k]}
                        <span className="sr-only">{ok ? "تمام" : "ناقص"}</span>
                      </li>
                    );
                  })}
              </ul>
              {warnings.length > 0 && (
                <>
                  <p className="mt-2 text-[13px] font-semibold text-[var(--pp-muted)]">
                    منيح تضيفهم (ما بيمنعوا النشر):
                  </p>
                  <ul className="grid gap-1 text-[13px] text-[var(--pp-muted)]">
                    {warnings
                      .filter((w) => phase1 || w !== "isbn")
                      .map((w) => (
                        <li key={w}>· {WARNING_WORDS[w]}</li>
                      ))}
                  </ul>
                </>
              )}
            </div>
          </aside>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-[#fbe9ed] p-3 text-[14px] font-semibold text-[#8c1a31]"
          >
            {error}
          </p>
        )}
        <div className="sticky bottom-0 -mx-5 mt-5 flex gap-2 border-t border-[var(--pp-line)] bg-white px-5 pb-1 pt-3">
          <button type="submit" className="rita-btn rita-btn-primary gap-2" disabled={saving}>
            {saving && <Loader2 size={16} className="animate-spin" />}
            {book ? "احفظ" : "أضف الكتاب"}
          </button>
          <button
            type="button"
            className="rita-btn rita-btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}

function ToggleChip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-11 rounded-full border-[1.5px] px-4 text-[14px] font-semibold transition-colors ${
        on
          ? "border-[var(--pp-ink)] bg-[var(--pp-ink)] text-white"
          : "border-[var(--pp-line)] bg-white hover:border-[var(--pp-ink)]"
      }`}
    >
      {children}
    </button>
  );
}

function FilePick({
  id,
  title,
  hint,
  accept,
  has,
  file,
  onPick,
}: {
  id: string;
  title: string;
  hint: string;
  accept: string;
  has: boolean;
  file: File | null;
  onPick: (file: File | null) => void;
}) {
  const size = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} ميغا`;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--pp-line)] p-3">
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold">{title}</span>
        <span className="block text-[13px] text-[var(--pp-muted)]" dir="auto">
          {file ? `${file.name} · ${size(file.size)}` : has ? `موجود · ${hint}` : `ما في · ${hint}`}
        </span>
      </span>
      <input
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
      <label htmlFor={id} className="rita-btn rita-btn-soft rita-btn-sm cursor-pointer">
        {file || has ? "بدّل" : "اختار ملف"}
      </label>
      {file && (
        <button
          type="button"
          className="rita-btn rita-btn-quiet rita-btn-sm"
          onClick={() => onPick(null)}
        >
          تراجع
        </button>
      )}
    </div>
  );
}

function Progress({ share }: { share?: number }) {
  if (share === undefined) return null;
  const pct = Math.round(share * 100);
  return (
    <div className="grid gap-1">
      <div
        className="h-2 overflow-hidden rounded-full bg-[var(--pp-grey)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className="h-full bg-[var(--pp-accent)]" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[12px] text-[var(--pp-muted)]">{pct}%</span>
    </div>
  );
}
