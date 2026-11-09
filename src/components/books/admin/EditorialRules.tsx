// Pins and exclusions (phase 2): on the discover page or inside one category, a book can be put
// first (pins, in their order) or hidden, optionally only for a period. An exclusion always wins;
// search and «كل الكتب» are never changed by these rules.
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Pin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fromLocalInput, inPeriod, type Book, type BookCategory } from "@/lib/books";
import {
  deleteRule,
  saveRule,
  saveRuleOrder,
  type EditorialRule,
  type RuleInput,
} from "@/lib/books-data";
import {
  Badge,
  Choice,
  field,
  GREY_TONE,
  IconButton,
  label,
  muted,
  periodText,
  sectionTitle,
  WARN_TONE,
  type Run,
} from "./admin-ui";

export function EditorialRules({
  rules,
  books,
  categories,
  busy,
  run,
}: {
  rules: EditorialRule[];
  books: Book[];
  categories: BookCategory[];
  busy: string;
  run: Run;
}) {
  const [context, setContext] = useState("discover");
  const [kind, setKind] = useState<"pin" | "exclude">("pin");
  const [bookId, setBookId] = useState("");
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const byId = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);
  const now = new Date();
  const places: [string, string][] = [
    ["discover", "صفحة «اكتشف»"],
    ...categories.map((c) => [c.id, `تصنيف: ${c.name_ar}`] as [string, string]),
  ];
  const placeName = (key: string) => places.find(([k]) => k === key)?.[1] ?? "تصنيف محذوف";
  const here = rules.filter((r) => r.context === context);
  const pins = here.filter((r) => r.kind === "pin").sort((a, b) => a.position - b.position);
  const hidden = here.filter((r) => r.kind === "exclude");
  const used = new Set(here.map((r) => r.book_id));
  const choices = books.filter(
    (b) =>
      b.status === "published" &&
      !used.has(b.id) &&
      (context === "discover" ||
        b.category_id === context ||
        b.secondary_category_ids.includes(context)),
  );

  function add() {
    if (!bookId) return toast.error("اختار كتاب.");
    const starts_at = fromLocalInput(from);
    const ends_at = fromLocalInput(until);
    if (starts_at && ends_at && ends_at <= starts_at)
      return toast.error("نهاية المدة لازم تكون بعد بدايتها.");
    const input: RuleInput = {
      book_id: bookId,
      context,
      kind,
      position: kind === "pin" ? pins.length : 0,
      starts_at,
      ends_at,
    };
    void run(
      "rule-add",
      async () => {
        await saveRule(input);
        setBookId("");
        setFrom("");
        setUntil("");
      },
      kind === "pin" ? "انثبّت الكتاب" : "انخفى الكتاب",
    );
  }

  function move(index: number, by: number) {
    const ids = pins.map((r) => r.id);
    const to = index + by;
    if (to < 0 || to >= ids.length) return;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    void run("rule-order", () => saveRuleOrder(ids));
  }

  const row = (rule: EditorialRule, index: number, list: EditorialRule[]) => {
    const book = byId.get(rule.book_id);
    const live = inPeriod(rule.starts_at, rule.ends_at, now);
    return (
      <li key={rule.id} className="flex flex-wrap items-center gap-2 p-3">
        {rule.kind === "pin" && (
          <span className="w-6 text-center text-[13px] text-[var(--pp-muted)]">{index + 1}</span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold" dir="auto">
            {book?.title ?? "كتاب محذوف"}
          </span>
          <span className="flex flex-wrap items-center gap-1.5 text-[13px] text-[var(--pp-muted)]">
            {periodText(rule.starts_at, rule.ends_at)}
            <Badge tone={live ? "bg-[#e6f4ea] text-[#1d6b3a]" : GREY_TONE}>
              {live ? "شغّال هلأ" : "برا مدته"}
            </Badge>
            {book && book.status !== "published" && <Badge tone={WARN_TONE}>مش منشور</Badge>}
          </span>
        </span>
        {rule.kind === "pin" && (
          <>
            <IconButton
              label="لفوق"
              disabled={index === 0 || Boolean(busy)}
              onClick={() => move(index, -1)}
            >
              <ArrowUp size={16} />
            </IconButton>
            <IconButton
              label="لتحت"
              disabled={index === list.length - 1 || Boolean(busy)}
              onClick={() => move(index, 1)}
            >
              <ArrowDown size={16} />
            </IconButton>
          </>
        )}
        <IconButton
          label="شيل القاعدة"
          danger
          disabled={Boolean(busy)}
          onClick={() =>
            void run(`rule-del-${rule.id}`, () => deleteRule(rule.id), "انشالت القاعدة")
          }
        >
          <Trash2 size={16} />
        </IconButton>
      </li>
    );
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className={sectionTitle}>التثبيت والاستبعاد</h2>
        <p className={muted}>
          ثبّت كتاب بأول «اكتشف» أو بأول تصنيف، أو خبّيه من هناك، لكل الوقت أو لمدة. الإخفاء بيغلب
          التثبيت، والبحث و«كل الكتب» ما بيتأثروا.
        </p>
      </div>
      <label className={`${label} max-w-md`}>
        المكان
        <select
          className={`${field} rita-select`}
          value={context}
          onChange={(e) => setContext(e.target.value)}
        >
          {places.map(([key, name]) => (
            <option key={key} value={key}>
              {name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-[var(--pp-line)]">
          <p className="flex min-h-11 items-center gap-2 border-b border-[var(--pp-line)] px-4 text-[15px] font-semibold">
            <Pin size={15} aria-hidden="true" /> مثبّت أول ({pins.length})
          </p>
          {pins.length ? (
            <ol className="divide-y divide-[var(--pp-line)]">
              {pins.map((r, i) => row(r, i, pins))}
            </ol>
          ) : (
            <p className={`${muted} p-4`}>
              ما في كتب مثبّتة {context === "discover" ? "بـ«اكتشف»" : "بهالتصنيف"}.
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-[var(--pp-line)]">
          <p className="flex min-h-11 items-center border-b border-[var(--pp-line)] px-4 text-[15px] font-semibold">
            مخفي ({hidden.length})
          </p>
          {hidden.length ? (
            <ul className="divide-y divide-[var(--pp-line)]">
              {hidden.map((r, i) => row(r, i, hidden))}
            </ul>
          ) : (
            <p className={`${muted} p-4`}>ما في كتب مخفية هون.</p>
          )}
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl bg-[var(--pp-grey)] p-4">
        <p className="text-[15px] font-semibold">قاعدة جديدة بـ{placeName(context)}</p>
        <Choice
          name="نوع القاعدة"
          value={kind}
          onChange={setKind}
          options={[
            ["pin", "ثبّته أول"],
            ["exclude", "خبّيه من هون"],
          ]}
        />
        <label className={label}>
          الكتاب (من المنشورين{context === "discover" ? "" : " بهالتصنيف"})
          <select
            className={`${field} rita-select`}
            value={bookId}
            onChange={(e) => setBookId(e.target.value)}
          >
            <option value="">اختار…</option>
            {choices.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
        </label>
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
        <div>
          <button
            type="button"
            className="rita-btn rita-btn-primary rita-btn-sm gap-2"
            disabled={Boolean(busy) || !bookId}
            onClick={add}
          >
            <Plus size={15} aria-hidden="true" /> أضف القاعدة
          </button>
        </div>
      </div>
    </section>
  );
}

/** The preview link: the library at a moment, with an optional picks order (seed). */
export function previewSearch(at: string, seed: string): { preview?: string; seed?: string } {
  const iso = fromLocalInput(at);
  if (!iso) return {};
  const clean = seed
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 16);
  return clean ? { preview: iso, seed: clean } : { preview: iso };
}
