// Arranging the library: the book of the week (one, with an optional period), the shelves the
// admin fills by hand (shown, hidden, or only during a period, in their own order), and a preview
// of the library at any moment.
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ExternalLink, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  fromLocalInput,
  inPeriod,
  toLocalInput,
  type Book,
  type BookCategory,
  type BookShelf,
} from "@/lib/books";
import {
  deleteShelf,
  saveShelf,
  saveShelfBooks,
  saveShelfOrder,
  setFeatured,
  type EditorialRule,
  type ShelfInput,
} from "@/lib/books-data";
import { EditorialRules, previewSearch } from "./EditorialRules";
import {
  Badge,
  field,
  GOLD_TONE,
  GREY_TONE,
  IconButton,
  label,
  muted,
  Notice,
  periodText,
  sectionTitle,
  type Run,
} from "./admin-ui";

export function ArrangeTab({
  books,
  shelves,
  categories,
  editorial,
  featuredId,
  phase1,
  phase2,
  busy,
  run,
}: {
  books: Book[];
  shelves: BookShelf[];
  categories: BookCategory[];
  editorial: EditorialRule[];
  featuredId: string | null;
  phase1: boolean;
  phase2: boolean;
  busy: string;
  run: Run;
}) {
  return (
    <div className="space-y-12">
      <FeaturedBook books={books} featuredId={featuredId} phase1={phase1} busy={busy} run={run} />
      {phase1 && <Shelves books={books} shelves={shelves} busy={busy} run={run} />}
      {phase2 ? (
        <EditorialRules
          rules={editorial}
          books={books}
          categories={categories}
          busy={busy}
          run={run}
        />
      ) : (
        phase1 && (
          <Notice tone="info">
            التثبيت والاستبعاد بيشتغلوا بعد تحديث قاعدة البيانات ‏20261110120000 (‏books_discovery).
          </Notice>
        )
      )}
      {phase1 && <Preview phase2={phase2} />}
    </div>
  );
}

function FeaturedBook({
  books,
  featuredId,
  phase1,
  busy,
  run,
}: {
  books: Book[];
  featuredId: string | null;
  phase1: boolean;
  busy: string;
  run: Run;
}) {
  const current = books.find((b) => b.featured) ?? null;
  const published = books.filter((b) => b.status === "published");
  const [bookId, setBookId] = useState(current?.id ?? "");
  const [from, setFrom] = useState(toLocalInput(current?.featured_from ?? null));
  const [until, setUntil] = useState(toLocalInput(current?.featured_until ?? null));
  const showingNow = current && current.id === featuredId;

  function save() {
    if (!bookId) return toast.error("اختار كتاب.");
    const f = fromLocalInput(from);
    const u = fromLocalInput(until);
    if (f && u && u <= f) return toast.error("نهاية المدة لازم تكون بعد بدايتها.");
    void run(
      "featured",
      () => setFeatured(bookId, { from: f, until: u }, phase1),
      "انحفظ كتاب الأسبوع",
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className={sectionTitle}>كتاب الأسبوع</h2>
        <p className={muted}>
          كتاب واحد بس، ولازم يكون منشور. إذا حطيت مدة، بيظهر بس خلالها (حسب ساعة الخادم).
        </p>
      </div>
      <div className="grid gap-3 rounded-2xl border border-[var(--pp-line)] p-4">
        <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
          <Star size={16} className="text-[#b8860b]" fill="currentColor" aria-hidden="true" />
          {current ? (
            <>
              <span dir="auto">{current.title}</span>
              <Badge tone={showingNow ? GOLD_TONE : GREY_TONE}>
                {showingNow ? "ظاهر هلأ" : "مش ظاهر هلأ"}
              </Badge>
              <span className="text-[13px] font-normal text-[var(--pp-muted)]">
                {periodText(current.featured_from, current.featured_until)}
              </span>
            </>
          ) : (
            "ما في كتاب أسبوع هلأ."
          )}
        </p>
        <label className={label}>
          الكتاب (من المنشورين)
          <select
            className={`${field} rita-select`}
            value={bookId}
            onChange={(e) => setBookId(e.target.value)}
          >
            <option value="">اختار…</option>
            {published.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
                {b.author ? ` — ${b.author}` : ""}
              </option>
            ))}
          </select>
        </label>
        {phase1 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>
              من (اختياري)
              <input
                type="datetime-local"
                dir="ltr"
                className={field}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label className={label}>
              لحد (اختياري)
              <input
                type="datetime-local"
                dir="ltr"
                className={field}
                value={until}
                onChange={(e) => setUntil(e.target.value)}
              />
            </label>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rita-btn rita-btn-primary rita-btn-sm"
            disabled={Boolean(busy)}
            onClick={save}
          >
            احفظ كتاب الأسبوع
          </button>
          {current && (
            <button
              type="button"
              className="rita-btn rita-btn-soft rita-btn-sm"
              disabled={Boolean(busy)}
              onClick={() =>
                void run(
                  "featured",
                  async () => {
                    await setFeatured(null, { from: null, until: null }, phase1);
                    setBookId("");
                    setFrom("");
                    setUntil("");
                  },
                  "انشال كتاب الأسبوع",
                )
              }
            >
              شيل كتاب الأسبوع
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

const EMPTY_SHELF: ShelfInput & { book_ids: string[] } = {
  name_ar: "",
  name_en: "",
  visible: true,
  starts_at: null,
  ends_at: null,
  book_ids: [],
};

function Shelves({
  books,
  shelves,
  busy,
  run,
}: {
  books: Book[];
  shelves: BookShelf[];
  busy: string;
  run: Run;
}) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const now = new Date();

  function move(index: number, by: number) {
    const ids = shelves.map((s) => s.id);
    const to = index + by;
    if (to < 0 || to >= ids.length) return;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    void run("order", () => saveShelfOrder(ids));
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className={sectionTitle}>الرفوف اليدوية ({shelves.length})</h2>
          <p className={muted}>
            رفوف بتختار كتبها وترتيبها بإيدك (مثل «اقتراحات الصيف»). بتظهر فوق رفوف التصنيفات، بس
            الكتب المنشورة منها.
          </p>
        </div>
        {editing !== "new" && (
          <button
            type="button"
            className="rita-btn rita-btn-soft gap-2"
            onClick={() => setEditing("new")}
          >
            <Plus size={16} /> رف جديد
          </button>
        )}
      </div>
      {editing === "new" && (
        <ShelfForm
          start={EMPTY_SHELF}
          books={books}
          busy={busy}
          onCancel={() => setEditing(null)}
          onSave={(value) =>
            run(
              "shelf-new",
              async () => {
                const id = await saveShelf(value, undefined, shelves.length);
                await saveShelfBooks(id, value.book_ids);
                setEditing(null);
              },
              "انضاف الرف",
            )
          }
        />
      )}
      {shelves.length > 0 && (
        <ul className="divide-y divide-[var(--pp-line)] rounded-2xl border border-[var(--pp-line)]">
          {shelves.map((shelf, index) => {
            const live = shelf.visible && inPeriod(shelf.starts_at, shelf.ends_at, now);
            const open = editing === shelf.id;
            return (
              <li key={shelf.id} className="p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
                      {shelf.name_ar}
                      <Badge tone={live ? "bg-[#e6f4ea] text-[#1d6b3a]" : GREY_TONE}>
                        {!shelf.visible ? "مخفي" : live ? "ظاهر هلأ" : "برا مدته"}
                      </Badge>
                    </span>
                    <span className="block text-[13px] text-[var(--pp-muted)]">
                      <span dir="ltr">{shelf.name_en}</span> · {shelf.book_ids.length} كتب ·{" "}
                      {periodText(shelf.starts_at, shelf.ends_at)}
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
                      disabled={index === shelves.length - 1 || Boolean(busy)}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown size={16} />
                    </IconButton>
                    <IconButton label="عدّل" onClick={() => setEditing(open ? null : shelf.id)}>
                      <Pencil size={16} />
                    </IconButton>
                    <IconButton
                      label="احذف"
                      danger
                      disabled={Boolean(busy)}
                      onClick={() => {
                        if (
                          !window.confirm(
                            `أكيد بدك تحذف الرف «${shelf.name_ar}»؟ الكتب نفسها بتضل.`,
                          )
                        )
                          return;
                        void run(
                          `del-shelf-${shelf.id}`,
                          () => deleteShelf(shelf.id),
                          "انحذف الرف",
                        );
                      }}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </span>
                </div>
                {open && (
                  <div className="mt-3">
                    <ShelfForm
                      start={shelf}
                      books={books}
                      busy={busy}
                      onCancel={() => setEditing(null)}
                      onSave={(value) =>
                        run(
                          `shelf-${shelf.id}`,
                          async () => {
                            await saveShelf(value, shelf.id);
                            await saveShelfBooks(shelf.id, value.book_ids);
                            setEditing(null);
                          },
                          "انحفظ الرف",
                        )
                      }
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ShelfForm({
  start,
  books,
  busy,
  onCancel,
  onSave,
}: {
  start: ShelfInput & { book_ids: string[] };
  books: Book[];
  busy: string;
  onCancel: () => void;
  onSave: (value: ShelfInput & { book_ids: string[] }) => Promise<boolean>;
}) {
  const [value, setValue] = useState({
    name_ar: start.name_ar,
    name_en: start.name_en,
    visible: start.visible,
    from: toLocalInput(start.starts_at),
    until: toLocalInput(start.ends_at),
    book_ids: start.book_ids,
  });
  const [adding, setAdding] = useState("");
  const byId = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);
  const left = books.filter((b) => b.status !== "archived" && !value.book_ids.includes(b.id));

  function moveBook(index: number, by: number) {
    const ids = [...value.book_ids];
    const to = index + by;
    if (to < 0 || to >= ids.length) return;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    setValue({ ...value, book_ids: ids });
  }

  function submit() {
    if (!value.name_ar.trim() || !value.name_en.trim())
      return toast.error("اكتب اسم الرف بالعربي والإنجليزي.");
    const starts_at = fromLocalInput(value.from);
    const ends_at = fromLocalInput(value.until);
    if (starts_at && ends_at && ends_at <= starts_at)
      return toast.error("نهاية المدة لازم تكون بعد بدايتها.");
    void onSave({
      name_ar: value.name_ar,
      name_en: value.name_en,
      visible: value.visible,
      starts_at,
      ends_at,
      book_ids: value.book_ids,
    });
  }

  return (
    <div className="grid gap-3 rounded-xl bg-[var(--pp-grey)] p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          الاسم بالعربي
          <input
            className={field}
            maxLength={60}
            value={value.name_ar}
            onChange={(e) => setValue({ ...value, name_ar: e.target.value })}
          />
        </label>
        <label className={label}>
          الاسم بالإنجليزي
          <input
            className={field}
            dir="ltr"
            maxLength={60}
            value={value.name_en}
            onChange={(e) => setValue({ ...value, name_en: e.target.value })}
          />
        </label>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-[15px] font-semibold">
        <input
          type="checkbox"
          className="h-5 w-5"
          checked={value.visible}
          onChange={(e) => setValue({ ...value, visible: e.target.checked })}
        />
        ظاهر بالمكتبة
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          من (اختياري)
          <input
            type="datetime-local"
            dir="ltr"
            className={field}
            value={value.from}
            onChange={(e) => setValue({ ...value, from: e.target.value })}
          />
        </label>
        <label className={label}>
          لحد (اختياري)
          <input
            type="datetime-local"
            dir="ltr"
            className={field}
            value={value.until}
            onChange={(e) => setValue({ ...value, until: e.target.value })}
          />
        </label>
      </div>
      <div className="grid gap-2">
        <p className="text-[14px] font-semibold">كتب الرف ({value.book_ids.length})</p>
        {value.book_ids.length > 0 && (
          <ol className="divide-y divide-[var(--pp-line)] rounded-xl border border-[var(--pp-line)] bg-white">
            {value.book_ids.map((id, index) => {
              const book = byId.get(id);
              return (
                <li key={id} className="flex items-center gap-2 p-2">
                  <span className="w-6 text-center text-[13px] text-[var(--pp-muted)]">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold" dir="auto">
                    {book?.title ?? "كتاب محذوف"}
                  </span>
                  {book && book.status !== "published" && <Badge tone={GREY_TONE}>مش منشور</Badge>}
                  <IconButton
                    label="لفوق"
                    disabled={index === 0}
                    onClick={() => moveBook(index, -1)}
                  >
                    <ArrowUp size={15} />
                  </IconButton>
                  <IconButton
                    label="لتحت"
                    disabled={index === value.book_ids.length - 1}
                    onClick={() => moveBook(index, 1)}
                  >
                    <ArrowDown size={15} />
                  </IconButton>
                  <IconButton
                    label="شيله من الرف"
                    onClick={() =>
                      setValue({ ...value, book_ids: value.book_ids.filter((b) => b !== id) })
                    }
                  >
                    <X size={15} />
                  </IconButton>
                </li>
              );
            })}
          </ol>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <label className={`${label} min-w-0 flex-1`}>
            أضف كتاب
            <select
              className={`${field} rita-select`}
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
            >
              <option value="">اختار…</option>
              {left.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="rita-btn rita-btn-soft rita-btn-sm"
            disabled={!adding}
            onClick={() => {
              setValue({ ...value, book_ids: [...value.book_ids, adding] });
              setAdding("");
            }}
          >
            أضف للرف
          </button>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className="rita-btn rita-btn-primary rita-btn-sm"
          disabled={Boolean(busy)}
          onClick={submit}
        >
          احفظ الرف
        </button>
        <button
          type="button"
          className="rita-btn rita-btn-secondary rita-btn-sm"
          onClick={onCancel}
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}

function Preview({ phase2 }: { phase2: boolean }) {
  const [at, setAt] = useState(() => toLocalInput(new Date().toISOString()));
  const [seed, setSeed] = useState("");
  return (
    <section className="space-y-4">
      <div>
        <h2 className={sectionTitle}>معاينة المكتبة</h2>
        <p className={muted}>
          شوف المكتبة مثل ما رح تطلع بوقت معيّن: الرفوف وكتاب الأسبوع{phase2 ? " والتثبيت" : ""} حسب
          مددهم. المعاينة إلك بس.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-[var(--pp-line)] p-4">
        <label className={`${label} min-w-[220px] flex-1`}>
          الوقت
          <input
            type="datetime-local"
            dir="ltr"
            className={field}
            value={at}
            onChange={(e) => setAt(e.target.value)}
          />
        </label>
        {phase2 && (
          <label className={`${label} w-44`}>
            ترتيب المختارات (اختياري)
            <input
              className={field}
              dir="ltr"
              maxLength={16}
              placeholder="abc123"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
            />
          </label>
        )}
        <Link
          to="/books"
          search={previewSearch(at, seed)}
          target="_blank"
          className="rita-btn rita-btn-soft gap-2"
        >
          افتح المعاينة <ExternalLink size={15} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
