// The admin's books: search and filters (status, category, level, language, what is missing),
// every status shown with its badge, several books chosen for one action, the order inside a
// category, edit and delete.
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BookObject } from "@/components/books/BookObject";
import {
  adminFilterBooks,
  BOOK_LEVELS,
  isAdminFiltering,
  NO_ADMIN_FILTER,
  type AdminBookFilter,
  type Book,
  type BookCategory,
  type BookGap,
  type BookLevel,
  type BookStatus,
  type BookTag,
} from "@/lib/books";
import {
  bulkUpdate,
  deleteBook,
  explainBookError,
  saveBookOrder,
  setBookStatus,
  type BulkAction,
} from "@/lib/books-data";
import {
  Badge,
  field,
  GOLD_TONE,
  GREY_TONE,
  IconButton,
  muted,
  sectionTitle,
  StatusBadge,
  STATUS_WORDS,
  WARN_TONE,
  type Run,
} from "./admin-ui";

export function BooksTab({
  books,
  categories,
  tags,
  featuredId,
  phase1,
  busy,
  run,
  onEdit,
  onNew,
}: {
  books: Book[];
  categories: BookCategory[];
  tags: BookTag[];
  featuredId: string | null;
  phase1: boolean;
  busy: string;
  run: Run;
  onEdit: (book: Book) => void;
  onNew: () => void;
}) {
  const [filter, setFilter] = useState<AdminBookFilter>(NO_ADMIN_FILTER);
  const [chosen, setChosen] = useState<string[]>([]);
  const [bulk, setBulk] = useState<{ action: BulkAction | ""; category: string; tag: string }>({
    action: "",
    category: "",
    tag: "",
  });
  const list = useMemo(
    () => adminFilterBooks(books, categories, filter),
    [books, categories, filter],
  );
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const languages = useMemo(() => [...new Set(books.map((b) => b.language))].sort(), [books]);
  const filtering = isAdminFiltering(filter);
  const set = (patch: Partial<AdminBookFilter>) => setFilter((f) => ({ ...f, ...patch }));
  const visibleIds = list.map((b) => b.id);
  const allChosen = visibleIds.length > 0 && visibleIds.every((id) => chosen.includes(id));
  const counts = useMemo(() => {
    const out: Record<BookStatus, number> = { draft: 0, published: 0, archived: 0 };
    for (const b of books) out[b.status] += 1;
    return out;
  }, [books]);

  function move(book: Book, by: number) {
    const same = list.filter((b) => b.category_id === book.category_id);
    const ids = same.map((b) => b.id);
    const from = ids.indexOf(book.id);
    const to = from + by;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    void run("order", () => saveBookOrder(ids));
  }

  function applyBulk() {
    const action = bulk.action;
    if (!action || !chosen.length) return;
    if (action === "set_category" && !bulk.category) return toast.error("اختار التصنيف.");
    if ((action === "add_tag" || action === "remove_tag") && !bulk.tag)
      return toast.error("اختار الوسم.");
    void run(`bulk`, async () => {
      const result = await bulkUpdate(chosen, action, {
        category: bulk.category || undefined,
        tag: bulk.tag || undefined,
      });
      if (result.skipped.length) {
        const reasons = [...new Set(result.skipped.map((s) => explainBookError(s.reason)))];
        toast.warning(
          `اتعدّل ${result.updated}، وانترك ${result.skipped.length}: ${reasons.join(" · ")}`,
        );
      } else toast.success(`اتعدّل ${result.updated} كتاب`);
      setChosen([]);
    });
  }

  const bulkOptions: [BulkAction, string][] = [
    ["publish", "انشرهم"],
    ["draft", "رجّعهم مسودة"],
    ["archive", "أرشفهم"],
    ["set_category", "غيّر التصنيف الأساسي"],
    ...(tags.length
      ? ([
          ["add_tag", "أضف وسم"],
          ["remove_tag", "شيل وسم"],
        ] as [BulkAction, string][])
      : []),
  ];

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className={sectionTitle}>الكتب ({books.length})</h2>
          <p className={muted}>
            {counts.published} منشور · {counts.draft} مسودة
            {phase1 ? ` · ${counts.archived} مؤرشف` : ""}
          </p>
        </div>
        <button
          type="button"
          className="rita-btn rita-btn-primary gap-2"
          onClick={onNew}
          disabled={categories.length === 0}
          title={categories.length === 0 ? "أضف تصنيف أول" : undefined}
        >
          <Plus size={17} /> أضف كتاب
        </button>
      </div>
      {categories.length === 0 && (
        <p className="rounded-xl bg-[var(--pp-grey)] p-4 text-[15px]">
          أضف تصنيف واحد على الأقل (تبويب «التصنيف») قبل ما تضيف كتب.
        </p>
      )}

      <div className="grid gap-3 rounded-2xl bg-[var(--pp-grey)] p-4">
        <label className="relative block">
          <span className="sr-only">ابحث بالكتب</span>
          <Search
            size={17}
            className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-[var(--pp-muted)] [inset-inline-start:12px]"
            aria-hidden="true"
          />
          <input
            className={`${field} [padding-inline-start:38px]`}
            type="search"
            placeholder="العنوان، الكاتب، العنوان البديل أو ISBN"
            value={filter.q}
            onChange={(e) => set({ q: e.target.value })}
          />
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Select
            label="الحالة"
            value={filter.status}
            onChange={(status) => set({ status: status as AdminBookFilter["status"] })}
            options={[
              ["all", "كل الحالات"],
              ["published", STATUS_WORDS.published],
              ["draft", STATUS_WORDS.draft],
              ...(phase1 ? ([["archived", STATUS_WORDS.archived]] as [string, string][]) : []),
            ]}
          />
          <Select
            label="التصنيف"
            value={filter.cat}
            onChange={(cat) => set({ cat })}
            options={[
              ["all", "كل التصنيفات"],
              ...categories.map((c) => [c.id, c.name_ar] as [string, string]),
              ["none", "بدون تصنيف"],
            ]}
          />
          <Select
            label="المستوى"
            value={filter.level ?? ""}
            onChange={(level) => set({ level: (level || null) as BookLevel | null })}
            options={[["", "كل المستويات"], ...BOOK_LEVELS.map((l) => [l, l] as [string, string])]}
          />
          <Select
            label="اللغة"
            value={filter.lang ?? ""}
            onChange={(lang) => set({ lang: lang || null })}
            options={[
              ["", "كل اللغات"],
              ...languages.map((l) => [l, l.toUpperCase()] as [string, string]),
            ]}
          />
          <Select
            label="ناقصه"
            value={filter.missing ?? ""}
            onChange={(missing) => set({ missing: (missing || null) as BookGap | null })}
            options={[
              ["", "مش مهم"],
              ["cover", "بدون غلاف"],
              ["pdf", "بدون PDF"],
              ...(phase1 ? ([["isbn", "بدون ISBN"]] as [string, string][]) : []),
            ]}
          />
        </div>
        {filtering && (
          <div className="flex items-center justify-between gap-2">
            <p className="text-[14px] font-semibold" aria-live="polite">
              {list.length} من {books.length}
            </p>
            <button
              type="button"
              className="rita-btn rita-btn-quiet rita-btn-sm"
              onClick={() => setFilter(NO_ADMIN_FILTER)}
            >
              امسح الفلترة
            </button>
          </div>
        )}
      </div>

      {phase1 && chosen.length > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-end gap-2 rounded-2xl border-[1.5px] border-[var(--pp-ink)] bg-white p-3 shadow-md">
          <p className="min-h-11 content-center text-[15px] font-semibold">اخترت {chosen.length}</p>
          <Select
            label="شو بدك تعمل؟"
            value={bulk.action}
            onChange={(action) => setBulk({ ...bulk, action: action as BulkAction | "" })}
            options={[["", "اختار…"], ...bulkOptions]}
          />
          {bulk.action === "set_category" && (
            <Select
              label="التصنيف"
              value={bulk.category}
              onChange={(category) => setBulk({ ...bulk, category })}
              options={[
                ["", "اختار…"],
                ...categories.map((c) => [c.id, c.name_ar] as [string, string]),
              ]}
            />
          )}
          {(bulk.action === "add_tag" || bulk.action === "remove_tag") && (
            <Select
              label="الوسم"
              value={bulk.tag}
              onChange={(tag) => setBulk({ ...bulk, tag })}
              options={[["", "اختار…"], ...tags.map((t) => [t.id, t.name_ar] as [string, string])]}
            />
          )}
          <button
            type="button"
            className="rita-btn rita-btn-primary rita-btn-sm"
            disabled={!bulk.action || busy === "bulk"}
            onClick={applyBulk}
          >
            طبّق
          </button>
          <button
            type="button"
            className="rita-btn rita-btn-quiet rita-btn-sm"
            onClick={() => setChosen([])}
          >
            إلغاء الاختيار
          </button>
        </div>
      )}

      {!books.length ? (
        <p className="rounded-xl bg-[var(--pp-grey)] p-4 text-[15px]">لسا ما في كتب.</p>
      ) : !list.length ? (
        <p className="rounded-xl bg-[var(--pp-grey)] p-4 text-[15px]">ما في كتاب بيطابق الفلترة.</p>
      ) : (
        <>
          {phase1 && (
            <label className="flex min-h-11 items-center gap-3 text-[14px] font-semibold">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={allChosen}
                onChange={() =>
                  setChosen(
                    allChosen
                      ? chosen.filter((id) => !visibleIds.includes(id))
                      : [...new Set([...chosen, ...visibleIds])],
                  )
                }
              />
              اختار كل اللي ظاهر ({list.length})
            </label>
          )}
          <ul className="divide-y divide-[var(--pp-line)] rounded-2xl border border-[var(--pp-line)]">
            {list.map((book, index) => {
              const category = book.category_id ? byId.get(book.category_id) : undefined;
              const prev = list[index - 1];
              const next = list[index + 1];
              const first = !prev || prev.category_id !== book.category_id;
              const last = !next || next.category_id !== book.category_id;
              const isChosen = chosen.includes(book.id);
              return (
                <li
                  key={book.id}
                  className={`flex flex-wrap items-center gap-3 p-3 ${isChosen ? "bg-[var(--pp-accent-soft)]" : ""}`}
                >
                  {phase1 && (
                    <input
                      type="checkbox"
                      className="h-5 w-5 shrink-0"
                      aria-label={`اختار «${book.title}»`}
                      checked={isChosen}
                      onChange={() =>
                        setChosen(
                          isChosen ? chosen.filter((id) => id !== book.id) : [...chosen, book.id],
                        )
                      }
                    />
                  )}
                  <span className="shrink-0">
                    <BookObject book={book} color={category?.color} size="sm" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold" dir="auto">
                      {book.title}
                    </span>
                    <span className="block text-[13px] text-[var(--pp-muted)]" dir="auto">
                      {[
                        category?.name_ar ?? "بدون تصنيف",
                        book.author,
                        book.level,
                        book.pages ? `${book.pages} صفحة` : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      <StatusBadge status={book.status} />
                      {book.id === featuredId && <Badge tone={GOLD_TONE}>كتاب الأسبوع</Badge>}
                      {book.featured && book.id !== featuredId && (
                        <Badge tone={GOLD_TONE}>كتاب الأسبوع (بمدة ثانية)</Badge>
                      )}
                      {!book.file_path && <Badge tone={WARN_TONE}>بدون PDF</Badge>}
                      {!book.cover_path && <Badge tone={GREY_TONE}>بدون غلاف</Badge>}
                      {phase1 && !book.rights_checked && (
                        <Badge tone={GREY_TONE}>الحقوق مش مراجعة</Badge>
                      )}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-1">
                    {!filtering && (
                      <>
                        <IconButton
                          label="لفوق"
                          disabled={first || Boolean(busy)}
                          onClick={() => move(book, -1)}
                        >
                          <ArrowUp size={16} />
                        </IconButton>
                        <IconButton
                          label="لتحت"
                          disabled={last || Boolean(busy)}
                          onClick={() => move(book, 1)}
                        >
                          <ArrowDown size={16} />
                        </IconButton>
                      </>
                    )}
                    <IconButton
                      label={book.status === "published" ? "رجّعه مسودة" : "انشره"}
                      disabled={Boolean(busy)}
                      onClick={() =>
                        void run(
                          `pub-${book.id}`,
                          () =>
                            setBookStatus(
                              book,
                              book.status === "published" ? "draft" : "published",
                              phase1,
                            ),
                          book.status === "published" ? "صار مسودة" : "انتشر الكتاب",
                        )
                      }
                    >
                      {book.status === "published" ? <EyeOff size={16} /> : <Eye size={16} />}
                    </IconButton>
                    <IconButton label="عدّل" onClick={() => onEdit(book)}>
                      <Pencil size={16} />
                    </IconButton>
                    <IconButton
                      label="احذف"
                      danger
                      disabled={Boolean(busy)}
                      onClick={() => {
                        if (
                          !window.confirm(
                            `أكيد بدك تحذف «${book.title}» مع غلافه وملفه؟${phase1 ? " (إذا بدك تخبّيه بس، أرشفه.)" : ""}`,
                          )
                        )
                          return;
                        void run(`del-${book.id}`, () => deleteBook(book), "انحذف الكتاب");
                      }}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </span>
                </li>
              );
            })}
          </ul>
          {filtering && <p className={muted}>الترتيب بالأسهم بيرجع لما تمسح الفلترة.</p>}
        </>
      )}
    </section>
  );
}

export function Select({
  label: text,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="grid gap-1 text-[13px] font-semibold">
      {text}
      <select
        className={`${field} rita-select min-h-11`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(([key, name]) => (
          <option key={key} value={key}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
