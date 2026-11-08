import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useLanguageRegistry } from "@/hooks/useLearningLanguage";
import { guardRedirect } from "@/lib/guard-redirect";
import { BookObject, CATEGORY_ICON } from "@/components/books/BookObject";
import {
  BOOK_LEVELS,
  CATEGORY_COLORS,
  CATEGORY_COLOR_KEYS,
  CATEGORY_ICONS,
  type Book,
  type BookCategory,
  type CategoryColor,
} from "@/lib/books";
import {
  deleteBook,
  deleteCategory,
  LIBRARY_QUERY_KEY,
  loadLibrary,
  saveBook,
  saveBookOrder,
  saveCategory,
  saveCategoryOrder,
  setBookFlags,
  type BookInput,
  type CategoryInput,
} from "@/lib/books-data";

export const Route = createFileRoute("/admin/books")({
  head: () => ({
    meta: [{ title: "Library — Administration Site" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminBooks,
});

const field =
  "w-full rounded-lg border-[1.5px] border-[var(--pp-ink)] bg-white px-3 py-2 text-[16px] outline-none focus-visible:border-[var(--pp-accent)]";
const label = "grid gap-1 text-[14px] font-semibold";
const MAX_COVER = 5 * 1024 * 1024;
const MAX_PDF = 50 * 1024 * 1024;

const EMPTY_CATEGORY: CategoryInput = { name_ar: "", name_en: "", color: "rose", icon: "heart" };

function AdminBooks() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const library = useQuery({
    queryKey: LIBRARY_QUERY_KEY,
    queryFn: loadLibrary,
    enabled: isAdmin,
  });
  const [editing, setEditing] = useState<Book | "new" | null>(null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!loading && !isAdmin) guardRedirect(navigate);
  }, [loading, isAdmin, navigate]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY });
  async function run(key: string, task: () => Promise<unknown>, done?: string) {
    setBusy(key);
    try {
      await task();
      await refresh();
      if (done) toast.success(done);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "ما زبط الحفظ.");
    } finally {
      setBusy("");
    }
  }

  if (loading || !isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  const data = library.data;
  const categories = data?.categories ?? [];
  const books = data?.books ?? [];

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-white pb-24 text-[var(--pp-ink)]"
      style={{ fontFamily: "var(--font-grotesk)" }}
    >
      <header className="border-b border-[var(--pp-line)] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-xs font-semibold text-[var(--pp-accent-text)]">لوحة الإدارة</p>
            <h1 className="text-[26px] font-semibold leading-tight">المكتبة</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/books"
              className="flex min-h-11 items-center rounded-lg border border-[var(--pp-line)] px-4 text-sm font-semibold"
            >
              شوف المكتبة
            </Link>
            <Link
              to="/admin"
              className="flex min-h-11 items-center gap-1 rounded-lg border border-[var(--pp-line)] px-4 text-sm font-semibold"
            >
              الإدارة <ArrowLeft size={15} />
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-10 px-5 pt-6">
        {library.isLoading && (
          <div className="grid place-items-center py-16">
            <Loader2 className="animate-spin" />
          </div>
        )}
        {library.isError && (
          <p className="rounded-xl bg-[#fbe9ed] p-4 text-[15px] font-semibold text-[#8c1a31]">
            ما انفتحت بيانات المكتبة: {(library.error as Error).message}
          </p>
        )}
        {data && !data.ready && (
          <div className="flex items-start gap-3 rounded-2xl border-[1.5px] border-[#f5b942] bg-[#fff8e8] p-4 text-[15px] font-semibold text-[#8a5200]">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <p>
              جداول المكتبة مش موجودة لسا. طبّق تحديث قاعدة البيانات ‏20261108120000
              (‏books_library) بـ Lovable Cloud، وبعدين حدّث الصفحة.
            </p>
          </div>
        )}

        {data?.ready && (
          <>
            <Categories categories={categories} books={books} busy={busy} run={run} />

            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-[20px] font-semibold">الكتب ({books.length})</h2>
                  <p className="text-[14px] text-[var(--pp-muted)]">
                    الكتاب بيظهر بالمكتبة لما يكون «منشور». كتاب الأسبوع واحد بس.
                  </p>
                </div>
                <button
                  type="button"
                  className="rita-btn rita-btn-primary gap-2"
                  onClick={() => setEditing("new")}
                  disabled={categories.length === 0}
                  title={categories.length === 0 ? "أضف تصنيف أول" : undefined}
                >
                  <Plus size={17} /> أضف كتاب
                </button>
              </div>
              {categories.length === 0 && (
                <p className="rounded-xl bg-[var(--pp-grey)] p-4 text-[15px]">
                  أضف تصنيف واحد على الأقل (فوق) قبل ما تضيف كتب.
                </p>
              )}
              <BookList
                categories={categories}
                books={books}
                busy={busy}
                run={run}
                onEdit={(book) => setEditing(book)}
              />
            </section>
          </>
        )}
      </div>

      {editing && (
        <BookEditor
          book={editing === "new" ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await refresh();
            setEditing(null);
          }}
        />
      )}
    </main>
  );
}

type Run = (key: string, task: () => Promise<unknown>, done?: string) => Promise<void>;

function ColorAndIcon({
  value,
  onChange,
}: {
  value: Pick<CategoryInput, "color" | "icon">;
  onChange: (next: Pick<CategoryInput, "color" | "icon">) => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="اللون">
        {CATEGORY_COLOR_KEYS.map((color) => (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={value.color === color}
            aria-label={color}
            onClick={() => onChange({ ...value, color })}
            className="grid h-9 w-9 place-items-center rounded-full"
            style={{
              background: CATEGORY_COLORS[color].soft,
              boxShadow:
                value.color === color
                  ? `0 0 0 2px #fff, 0 0 0 4px ${CATEGORY_COLORS[color].c}`
                  : undefined,
            }}
          >
            <span
              className="h-4 w-4 rounded-full"
              style={{ background: CATEGORY_COLORS[color].c }}
            />
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="الأيقونة">
        {CATEGORY_ICONS.map((icon) => {
          const Icon = CATEGORY_ICON[icon];
          return (
            <button
              key={icon}
              type="button"
              role="radio"
              aria-checked={value.icon === icon}
              aria-label={icon}
              onClick={() => onChange({ ...value, icon })}
              className="grid h-10 w-10 place-items-center rounded-xl border-[1.5px]"
              style={{
                borderColor:
                  value.icon === icon ? CATEGORY_COLORS[value.color].c : "var(--pp-line)",
                color: CATEGORY_COLORS[value.color].c,
                background: value.icon === icon ? CATEGORY_COLORS[value.color].soft : "#fff",
              }}
            >
              <Icon size={18} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Categories({
  categories,
  books,
  busy,
  run,
}: {
  categories: BookCategory[];
  books: Book[];
  busy: string;
  run: Run;
}) {
  const [form, setForm] = useState<CategoryInput>(EMPTY_CATEGORY);
  const [edit, setEdit] = useState<{ id: string; value: CategoryInput } | null>(null);
  const count = (id: string) => books.filter((b) => b.category_id === id).length;

  function move(index: number, by: number) {
    const ids = categories.map((c) => c.id);
    const to = index + by;
    if (to < 0 || to >= ids.length) return;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    void run("order", () => saveCategoryOrder(ids));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.name_ar.trim() || !form.name_en.trim()) {
      toast.error("اكتب اسم التصنيف بالعربي والإنجليزي.");
      return;
    }
    void run(
      "add-cat",
      async () => {
        await saveCategory(form, undefined, categories.length);
        setForm(EMPTY_CATEGORY);
      },
      "انضاف التصنيف",
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-[20px] font-semibold">التصنيفات ({categories.length})</h2>
        <p className="text-[14px] text-[var(--pp-muted)]">
          كل تصنيف رف بالمكتبة، بنفس هالترتيب. اللون والأيقونة بيظهروا عند الرف.
        </p>
      </div>
      {categories.length > 0 && (
        <ul className="divide-y divide-[var(--pp-line)] rounded-2xl border border-[var(--pp-line)]">
          {categories.map((category, index) => {
            const tone = CATEGORY_COLORS[category.color];
            const Icon = CATEGORY_ICON[category.icon];
            const open = edit?.id === category.id;
            return (
              <li key={category.id} className="p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]"
                    style={{ background: tone.soft, color: tone.c }}
                  >
                    <Icon size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">{category.name_ar}</span>
                    <span className="block text-[13px] text-[var(--pp-muted)]" dir="ltr">
                      {category.name_en} · {count(category.id)} كتب
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <IconButton
                      label="لفوق"
                      disabled={index === 0 || Boolean(busy)}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp size={16} />
                    </IconButton>
                    <IconButton
                      label="لتحت"
                      disabled={index === categories.length - 1 || Boolean(busy)}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown size={16} />
                    </IconButton>
                    <IconButton
                      label="عدّل"
                      onClick={() =>
                        setEdit(
                          open
                            ? null
                            : {
                                id: category.id,
                                value: {
                                  name_ar: category.name_ar,
                                  name_en: category.name_en,
                                  color: category.color,
                                  icon: category.icon,
                                },
                              },
                        )
                      }
                    >
                      <Pencil size={16} />
                    </IconButton>
                    <IconButton
                      label="احذف"
                      danger
                      disabled={Boolean(busy)}
                      onClick={() => {
                        const n = count(category.id);
                        if (
                          !window.confirm(
                            n
                              ? `أكيد بدك تحذف «${category.name_ar}»؟ كتبه (${n}) بتضل، بس بدون تصنيف.`
                              : `أكيد بدك تحذف «${category.name_ar}»؟`,
                          )
                        )
                          return;
                        void run(
                          `del-${category.id}`,
                          () => deleteCategory(category.id),
                          "انحذف التصنيف",
                        );
                      }}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </span>
                </div>
                {open && edit && (
                  <div className="mt-3 grid gap-3 rounded-xl bg-[var(--pp-grey)] p-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className={label}>
                        الاسم بالعربي
                        <input
                          className={field}
                          value={edit.value.name_ar}
                          maxLength={60}
                          onChange={(e) =>
                            setEdit({ ...edit, value: { ...edit.value, name_ar: e.target.value } })
                          }
                        />
                      </label>
                      <label className={label}>
                        الاسم بالإنجليزي
                        <input
                          className={field}
                          dir="ltr"
                          value={edit.value.name_en}
                          maxLength={60}
                          onChange={(e) =>
                            setEdit({ ...edit, value: { ...edit.value, name_en: e.target.value } })
                          }
                        />
                      </label>
                    </div>
                    <ColorAndIcon
                      value={edit.value}
                      onChange={(next) => setEdit({ ...edit, value: { ...edit.value, ...next } })}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rita-btn rita-btn-primary rita-btn-sm"
                        disabled={
                          Boolean(busy) || !edit.value.name_ar.trim() || !edit.value.name_en.trim()
                        }
                        onClick={() =>
                          void run(
                            `edit-${category.id}`,
                            async () => {
                              await saveCategory(edit.value, category.id);
                              setEdit(null);
                            },
                            "انحفظ التصنيف",
                          )
                        }
                      >
                        احفظ
                      </button>
                      <button
                        type="button"
                        className="rita-btn rita-btn-secondary rita-btn-sm"
                        onClick={() => setEdit(null)}
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <form onSubmit={submit} className="grid gap-3 rounded-2xl bg-[var(--pp-grey)] p-4">
        <p className="text-[15px] font-semibold">تصنيف جديد</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>
            الاسم بالعربي
            <input
              className={field}
              value={form.name_ar}
              maxLength={60}
              placeholder="روايات رومانسية"
              onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
            />
          </label>
          <label className={label}>
            الاسم بالإنجليزي
            <input
              className={field}
              dir="ltr"
              value={form.name_en}
              maxLength={60}
              placeholder="Romance"
              onChange={(e) => setForm({ ...form, name_en: e.target.value })}
            />
          </label>
        </div>
        <ColorAndIcon value={form} onChange={(next) => setForm({ ...form, ...next })} />
        <div>
          <button
            type="submit"
            className="rita-btn rita-btn-primary rita-btn-sm gap-2"
            disabled={busy === "add-cat"}
          >
            {busy === "add-cat" ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Plus size={15} />
            )}
            أضف التصنيف
          </button>
        </div>
      </form>
    </section>
  );
}

function BookList({
  categories,
  books,
  busy,
  run,
  onEdit,
}: {
  categories: BookCategory[];
  books: Book[];
  busy: string;
  run: Run;
  onEdit: (book: Book) => void;
}) {
  const groups = useMemo(() => {
    const known = new Set(categories.map((c) => c.id));
    const list = [...categories].map((c) => ({
      key: c.id,
      title: c.name_ar,
      category: c as BookCategory | null,
      books: books.filter((b) => b.category_id === c.id).sort((a, b) => a.sort - b.sort),
    }));
    const loose = books.filter((b) => !b.category_id || !known.has(b.category_id));
    if (loose.length)
      list.push({ key: "loose", title: "بدون تصنيف", category: null, books: loose });
    return list.filter((g) => g.books.length);
  }, [categories, books]);

  if (!books.length)
    return <p className="rounded-xl bg-[var(--pp-grey)] p-4 text-[15px]">لسا ما في كتب.</p>;

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.key}>
          <h3 className="mb-2 text-[15px] font-semibold text-[var(--pp-muted)]">{group.title}</h3>
          <ul className="divide-y divide-[var(--pp-line)] rounded-2xl border border-[var(--pp-line)]">
            {group.books.map((book, index) => {
              const move = (by: number) => {
                const ids = group.books.map((b) => b.id);
                const to = index + by;
                if (to < 0 || to >= ids.length) return;
                [ids[index], ids[to]] = [ids[to], ids[index]];
                void run("order", () => saveBookOrder(ids));
              };
              return (
                <li key={book.id} className="flex flex-wrap items-center gap-4 p-3">
                  <span className="shrink-0">
                    <BookObject book={book} color={group.category?.color} size="sm" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold" dir="auto">
                      {book.title}
                    </span>
                    <span className="block text-[13px] text-[var(--pp-muted)]" dir="auto">
                      {[book.author, book.level, book.pages ? `${book.pages} صفحة` : ""]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1.5 text-[12px] font-semibold">
                      <span
                        className={`rounded-md px-2 py-0.5 ${book.published ? "bg-[#e6f4ea] text-[#1d6b3a]" : "bg-[var(--pp-grey)] text-[var(--pp-muted)]"}`}
                      >
                        {book.published ? "منشور" : "مسودة"}
                      </span>
                      {book.featured && (
                        <span className="rounded-md bg-[#fff6df] px-2 py-0.5 text-[#8a5200]">
                          كتاب الأسبوع
                        </span>
                      )}
                      {!book.file_path && (
                        <span className="rounded-md bg-[#fbe9ed] px-2 py-0.5 text-[#8c1a31]">
                          بدون ملف PDF
                        </span>
                      )}
                      {!book.cover_path && (
                        <span className="rounded-md bg-[var(--pp-grey)] px-2 py-0.5 text-[var(--pp-muted)]">
                          بدون غلاف
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <IconButton
                      label="لفوق"
                      disabled={index === 0 || Boolean(busy)}
                      onClick={() => move(-1)}
                    >
                      <ArrowUp size={16} />
                    </IconButton>
                    <IconButton
                      label="لتحت"
                      disabled={index === group.books.length - 1 || Boolean(busy)}
                      onClick={() => move(1)}
                    >
                      <ArrowDown size={16} />
                    </IconButton>
                    <IconButton
                      label={book.published ? "خبّيه" : "انشره"}
                      disabled={Boolean(busy)}
                      onClick={() =>
                        void run(
                          `pub-${book.id}`,
                          () => setBookFlags(book, { published: !book.published }),
                          book.published ? "صار مسودة" : "انتشر الكتاب",
                        )
                      }
                    >
                      {book.published ? <EyeOff size={16} /> : <Eye size={16} />}
                    </IconButton>
                    <IconButton
                      label={book.featured ? "شيله من كتاب الأسبوع" : "خلّيه كتاب الأسبوع"}
                      disabled={Boolean(busy)}
                      active={book.featured}
                      onClick={() =>
                        void run(`feat-${book.id}`, () =>
                          setBookFlags(book, { featured: !book.featured }),
                        )
                      }
                    >
                      <Star size={16} fill={book.featured ? "currentColor" : "none"} />
                    </IconButton>
                    <IconButton label="عدّل" onClick={() => onEdit(book)}>
                      <Pencil size={16} />
                    </IconButton>
                    <IconButton
                      label="احذف"
                      danger
                      disabled={Boolean(busy)}
                      onClick={() => {
                        if (!window.confirm(`أكيد بدك تحذف «${book.title}» مع غلافه وملفه؟`))
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
        </div>
      ))}
    </div>
  );
}

function BookEditor({
  book,
  categories,
  onClose,
  onSaved,
}: {
  book: Book | null;
  categories: BookCategory[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const registry = useLanguageRegistry();
  const [value, setValue] = useState<BookInput>(() => ({
    title: book?.title ?? "",
    author: book?.author ?? "",
    description: book?.description ?? "",
    category_id: book?.category_id ?? categories[0]?.id ?? null,
    level: book?.level ?? "B1",
    language: book?.language ?? "en",
    pages: book?.pages ?? null,
    year: book?.year ?? null,
    published: book?.published ?? true,
    featured: book?.featured ?? false,
  }));
  const [cover, setCover] = useState<File | null>(null);
  const [pdf, setPdf] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(book?.cover_url ?? null);
  const [saving, setSaving] = useState(false);
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

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!value.title.trim()) return setError("اكتب عنوان الكتاب.");
    if (value.pages !== null && !(value.pages >= 1 && value.pages <= 5000))
      return setError("عدد الصفحات لازم يكون بين 1 و 5000.");
    if (cover && cover.size > MAX_COVER) return setError("صورة الغلاف أكبر من 5 ميغا.");
    if (cover && !/^image\/(jpeg|png|webp)$/.test(cover.type))
      return setError("الغلاف لازم يكون صورة JPG أو PNG أو WebP.");
    if (pdf && pdf.size > MAX_PDF) return setError("ملف الكتاب أكبر من 50 ميغا.");
    if (pdf && pdf.type !== "application/pdf") return setError("ملف الكتاب لازم يكون PDF.");
    setSaving(true);
    try {
      await saveBook(value, { cover, pdf }, book ?? undefined);
      toast.success(book ? "انحفظ الكتاب" : "انضاف الكتاب");
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ما انحفظ الكتاب.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[rgb(18_17_23/0.45)] p-3"
      onClick={() => !saving && onClose()}
    >
      <form
        onSubmit={submit}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={book ? "عدّل الكتاب" : "كتاب جديد"}
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[22px] bg-white p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[20px] font-semibold">{book ? "عدّل الكتاب" : "كتاب جديد"}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="سكّر"
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-[var(--pp-grey)]"
          >
            <X size={18} />
          </button>
        </div>
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_180px]">
          <div className="grid gap-3">
            <label className={label}>
              العنوان
              <input
                className={field}
                dir="auto"
                required
                maxLength={200}
                value={value.title}
                onChange={(e) => setValue({ ...value, title: e.target.value })}
              />
            </label>
            <label className={label}>
              الكاتب
              <input
                className={field}
                dir="auto"
                maxLength={160}
                value={value.author}
                onChange={(e) => setValue({ ...value, author: e.target.value })}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={label}>
                التصنيف
                <select
                  className={`${field} rita-select`}
                  value={value.category_id ?? ""}
                  onChange={(e) => setValue({ ...value, category_id: e.target.value || null })}
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
                  onChange={(e) => setValue({ ...value, level: e.target.value as Book["level"] })}
                >
                  {BOOK_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>
              <label className={label}>
                لغة الكتاب
                <select
                  className={`${field} rita-select`}
                  value={value.language}
                  onChange={(e) => setValue({ ...value, language: e.target.value })}
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
              <div className="grid grid-cols-2 gap-3">
                <label className={label}>
                  الصفحات
                  <input
                    className={field}
                    inputMode="numeric"
                    dir="ltr"
                    value={value.pages ?? ""}
                    onChange={(e) => setValue({ ...value, pages: number(e.target.value) })}
                  />
                </label>
                <label className={label}>
                  سنة النشر
                  <input
                    className={field}
                    inputMode="numeric"
                    dir="ltr"
                    value={value.year ?? ""}
                    onChange={(e) => setValue({ ...value, year: number(e.target.value) })}
                  />
                </label>
              </div>
            </div>
            <label className={label}>
              وصف قصير
              <textarea
                className={`${field} min-h-[96px]`}
                dir="auto"
                maxLength={1200}
                value={value.description}
                onChange={(e) => setValue({ ...value, description: e.target.value })}
              />
            </label>
            <div className="grid gap-3">
              <label className={label}>
                صورة الغلاف (JPG / PNG / WebP، لحد 5 ميغا)
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="text-[14px]"
                  onChange={(e) => setCover(e.target.files?.[0] ?? null)}
                />
              </label>
              <label className={label}>
                ملف الكتاب PDF (لحد 50 ميغا){book?.file_path ? " · موجود" : ""}
                <input
                  type="file"
                  accept="application/pdf"
                  className="text-[14px]"
                  onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-5 text-[15px] font-semibold">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={value.published}
                  onChange={(e) => setValue({ ...value, published: e.target.checked })}
                />
                منشور بالمكتبة
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={value.featured}
                  onChange={(e) => setValue({ ...value, featured: e.target.checked })}
                />
                كتاب الأسبوع
              </label>
            </div>
          </div>
          <div className="grid content-start justify-items-center gap-2 rounded-2xl bg-[var(--pp-grey)] p-4">
            <p className="text-[13px] font-semibold text-[var(--pp-muted)]">هيك بيطلع</p>
            <BookObject
              book={{
                title: value.title || "عنوان الكتاب",
                author: value.author,
                level: value.level,
                cover_url: preview,
              }}
              color={category?.color as CategoryColor | undefined}
            />
          </div>
        </div>
        {error && (
          <p className="mt-4 rounded-lg bg-[#fbe9ed] p-3 text-[14px] font-semibold text-[#8c1a31]">
            {error}
          </p>
        )}
        <div className="mt-5 flex gap-2">
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

function IconButton({
  label: text,
  onClick,
  disabled,
  danger,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={text}
      title={text}
      className={`grid h-10 w-10 place-items-center rounded-lg border border-[var(--pp-line)] transition-colors hover:bg-[var(--pp-grey)] disabled:opacity-40 ${danger ? "text-[#b3213f]" : active ? "text-[#b8860b]" : ""}`}
    >
      {children}
    </button>
  );
}
