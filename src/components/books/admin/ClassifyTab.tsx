// Classification: categories (each one a shelf in the library, in this order; a category with
// books is deleted only after its books move to another one) and tags (free words for search).
import { useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CATEGORY_ICON } from "@/components/books/BookObject";
import { CATEGORY_COLORS, type Book, type BookCategory, type BookTag } from "@/lib/books";
import {
  deleteCategory,
  deleteTag,
  saveCategory,
  saveCategoryOrder,
  saveTag,
  type CategoryInput,
} from "@/lib/books-data";
import { ColorAndIcon, field, IconButton, label, muted, sectionTitle, type Run } from "./admin-ui";

const EMPTY_CATEGORY: CategoryInput = { name_ar: "", name_en: "", color: "rose", icon: "heart" };

export function ClassifyTab({
  categories,
  tags,
  books,
  phase1,
  busy,
  run,
}: {
  categories: BookCategory[];
  tags: BookTag[];
  books: Book[];
  phase1: boolean;
  busy: string;
  run: Run;
}) {
  return (
    <div className="space-y-12">
      <Categories categories={categories} books={books} phase1={phase1} busy={busy} run={run} />
      {phase1 && <Tags tags={tags} books={books} busy={busy} run={run} />}
    </div>
  );
}

function Categories({
  categories,
  books,
  phase1,
  busy,
  run,
}: {
  categories: BookCategory[];
  books: Book[];
  phase1: boolean;
  busy: string;
  run: Run;
}) {
  const [form, setForm] = useState<CategoryInput>(EMPTY_CATEGORY);
  const [edit, setEdit] = useState<{ id: string; value: CategoryInput } | null>(null);
  const [removing, setRemoving] = useState<{ id: string; moveTo: string } | null>(null);
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

  function remove(category: BookCategory) {
    const n = count(category.id);
    if (!n) {
      if (!window.confirm(`أكيد بدك تحذف «${category.name_ar}»؟`)) return;
      void run(
        `del-${category.id}`,
        () => deleteCategory(category.id, null, phase1),
        "انحذف التصنيف",
      );
      return;
    }
    if (!phase1) {
      if (!window.confirm(`أكيد بدك تحذف «${category.name_ar}»؟ كتبه (${n}) بتضل بدون تصنيف.`))
        return;
      void run(
        `del-${category.id}`,
        () => deleteCategory(category.id, null, phase1),
        "انحذف التصنيف",
      );
      return;
    }
    const other = categories.find((c) => c.id !== category.id);
    if (!other) {
      toast.error("هاد آخر تصنيف وفيه كتب: أضف تصنيف ثاني لتنقلهم عليه.");
      return;
    }
    setRemoving({ id: category.id, moveTo: other?.id ?? "" });
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className={sectionTitle}>التصنيفات ({categories.length})</h2>
        <p className={muted}>
          كل تصنيف رف بالمكتبة، بنفس هالترتيب. اللون بيظهر عند الرف مع شعار يوزرا. ما في تصنيفين
          بنفس الاسم.
        </p>
      </div>
      {categories.length > 0 && (
        <ul className="divide-y divide-[var(--pp-line)] rounded-2xl border border-[var(--pp-line)]">
          {categories.map((category, index) => {
            const tone = CATEGORY_COLORS[category.color];
            const Icon = CATEGORY_ICON[category.icon];
            const open = edit?.id === category.id;
            const n = count(category.id);
            return (
              <li key={category.id} className="p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px]"
                    style={{ background: tone.soft, color: tone.c }}
                  >
                    <Icon size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">{category.name_ar}</span>
                    <span className="block text-[13px] text-[var(--pp-muted)]">
                      <span dir="ltr">{category.name_en}</span> · {n} {n === 1 ? "كتاب" : "كتب"}
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
                      onClick={() => remove(category)}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </span>
                </div>
                {removing?.id === category.id && (
                  <div className="mt-3 grid gap-3 rounded-xl border-[1.5px] border-[#f2b8c4] bg-[#fdf2f4] p-3">
                    <p className="text-[15px] font-semibold text-[#8c1a31]">
                      «{category.name_ar}» فيه {n} {n === 1 ? "كتاب" : "كتب"}. وين ينتقلوا قبل
                      الحذف؟
                    </p>
                    <label className={label}>
                      انقلهم لـ
                      <select
                        className={`${field} rita-select`}
                        value={removing.moveTo}
                        onChange={(e) => setRemoving({ ...removing, moveTo: e.target.value })}
                      >
                        {categories
                          .filter((c) => c.id !== category.id)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name_ar}
                            </option>
                          ))}
                      </select>
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rita-btn rita-btn-sm !border-[#b3213f] !bg-[#b3213f] !text-white"
                        disabled={Boolean(busy) || !removing.moveTo}
                        onClick={() =>
                          void run(
                            `del-${category.id}`,
                            async () => {
                              await deleteCategory(category.id, removing.moveTo || null, phase1);
                              setRemoving(null);
                            },
                            "انحذف التصنيف وانتقلت كتبه",
                          )
                        }
                      >
                        انقلهم واحذف
                      </button>
                      <button
                        type="button"
                        className="rita-btn rita-btn-secondary rita-btn-sm"
                        onClick={() => setRemoving(null)}
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                )}
                {open && edit && (
                  <div className="mt-3 grid gap-3 rounded-xl bg-[var(--pp-grey)] p-3">
                    <NameFields
                      value={edit.value}
                      onChange={(next) => setEdit({ ...edit, value: { ...edit.value, ...next } })}
                    />
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
        <NameFields
          value={form}
          onChange={(next) => setForm({ ...form, ...next })}
          placeholders={["روايات رومانسية", "Romance"]}
        />
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

function NameFields({
  value,
  onChange,
  placeholders,
  max = 60,
}: {
  value: { name_ar: string; name_en: string };
  onChange: (next: { name_ar?: string; name_en?: string }) => void;
  placeholders?: [string, string];
  max?: number;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className={label}>
        الاسم بالعربي
        <input
          className={field}
          value={value.name_ar}
          maxLength={max}
          placeholder={placeholders?.[0]}
          onChange={(e) => onChange({ name_ar: e.target.value })}
        />
      </label>
      <label className={label}>
        الاسم بالإنجليزي
        <input
          className={field}
          dir="ltr"
          value={value.name_en}
          maxLength={max}
          placeholder={placeholders?.[1]}
          onChange={(e) => onChange({ name_en: e.target.value })}
        />
      </label>
    </div>
  );
}

function Tags({
  tags,
  books,
  busy,
  run,
}: {
  tags: BookTag[];
  books: Book[];
  busy: string;
  run: Run;
}) {
  const [form, setForm] = useState({ name_ar: "", name_en: "" });
  const [edit, setEdit] = useState<{ id: string; name_ar: string; name_en: string } | null>(null);
  const count = (id: string) => books.filter((b) => b.tag_ids.includes(id)).length;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.name_ar.trim() || !form.name_en.trim()) {
      toast.error("اكتب الوسم بالعربي والإنجليزي.");
      return;
    }
    void run(
      "add-tag",
      async () => {
        await saveTag(form);
        setForm({ name_ar: "", name_en: "" });
      },
      "انضاف الوسم",
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className={sectionTitle}>الوسوم ({tags.length})</h2>
        <p className={muted}>
          كلمات بتساعد بالبحث (مثل «كلاسيكي» أو «قصص قصيرة»). الكتاب ممكن ياخد أكثر من وسم.
        </p>
      </div>
      {tags.length > 0 && (
        <ul className="divide-y divide-[var(--pp-line)] rounded-2xl border border-[var(--pp-line)]">
          {tags.map((tag) => {
            const n = count(tag.id);
            const open = edit?.id === tag.id;
            return (
              <li key={tag.id} className="p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">{tag.name_ar}</span>
                    <span className="block text-[13px] text-[var(--pp-muted)]">
                      <span dir="ltr">{tag.name_en}</span> · {n} {n === 1 ? "كتاب" : "كتب"}
                    </span>
                  </span>
                  <IconButton label="عدّل" onClick={() => setEdit(open ? null : { ...tag })}>
                    <Pencil size={16} />
                  </IconButton>
                  <IconButton
                    label="احذف"
                    danger
                    disabled={Boolean(busy)}
                    onClick={() => {
                      if (
                        !window.confirm(
                          n
                            ? `أكيد؟ الوسم «${tag.name_ar}» بينشال عن ${n} كتب.`
                            : `أكيد بدك تحذف «${tag.name_ar}»؟`,
                        )
                      )
                        return;
                      void run(`del-tag-${tag.id}`, () => deleteTag(tag.id), "انحذف الوسم");
                    }}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </div>
                {open && edit && (
                  <div className="mt-3 grid gap-3 rounded-xl bg-[var(--pp-grey)] p-3">
                    <NameFields
                      value={edit}
                      max={40}
                      onChange={(next) => setEdit({ ...edit, ...next })}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rita-btn rita-btn-primary rita-btn-sm"
                        disabled={Boolean(busy) || !edit.name_ar.trim() || !edit.name_en.trim()}
                        onClick={() =>
                          void run(
                            `edit-tag-${tag.id}`,
                            async () => {
                              await saveTag(edit, tag.id);
                              setEdit(null);
                            },
                            "انحفظ الوسم",
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
        <p className="text-[15px] font-semibold">وسم جديد</p>
        <NameFields
          value={form}
          max={40}
          placeholders={["كلاسيكي", "Classic"]}
          onChange={(next) => setForm({ ...form, ...next })}
        />
        <div>
          <button
            type="submit"
            className="rita-btn rita-btn-primary rita-btn-sm gap-2"
            disabled={busy === "add-tag"}
          >
            {busy === "add-tag" ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Plus size={15} />
            )}
            أضف الوسم
          </button>
        </div>
      </form>
    </section>
  );
}
