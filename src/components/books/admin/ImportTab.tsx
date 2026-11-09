// Import and quality: book details from a CSV file (columns matched to fields, a dry run first,
// then the real run under one operation id so a retry never imports twice; new books start as
// drafts, covers and PDFs are added by hand later), the recent imports, what books are missing,
// and the list of old files that could not be removed yet.
import { useMemo, useRef, useState } from "react";
import { FileUp, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  guessMapping,
  IMPORT_FIELD_LABELS,
  IMPORT_FIELDS,
  importMessage,
  MAX_IMPORT_ROWS,
  parseCsv,
  rowsFromTable,
  type ImportField,
  type ImportMapping,
} from "@/lib/books-import";
import { qualityReport, type Book } from "@/lib/books";
import {
  cleanFileTrash,
  runImport,
  type AdminLibrary,
  type ImportResult,
  type ImportRowResult,
} from "@/lib/books-data";
import {
  Badge,
  Choice,
  field,
  GREY_TONE,
  label,
  muted,
  sectionTitle,
  WARN_TONE,
  type Run,
} from "./admin-ui";
import { ReadingQuality } from "./ReaderPrepare";

type OnDuplicate = "skip" | "update" | "create";

const ACTION_WORDS: Record<ImportRowResult["action"], string> = {
  create: "جديد",
  update: "تحديث",
  skip: "بينترك",
  error: "غلط",
};
const ACTION_TONE: Record<ImportRowResult["action"], string> = {
  create: "bg-[#e6f4ea] text-[#1d6b3a]",
  update: "bg-[#e0f0fa] text-[#0b4f79]",
  skip: GREY_TONE,
  error: WARN_TONE,
};

export function ImportTab({
  library,
  busy,
  run,
  onEdit,
}: {
  library: AdminLibrary;
  busy: string;
  run: Run;
  onEdit: (book: Book) => void;
}) {
  return (
    <div className="space-y-12">
      <Importer library={library} run={run} />
      <Quality books={library.books} onEdit={onEdit} />
      <ReadingQuality books={library.books} onEdit={onEdit} />
      <Trash library={library} busy={busy} run={run} />
    </div>
  );
}

function Importer({ library, run }: { library: AdminLibrary; run: Run }) {
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [table, setTable] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [onDuplicate, setOnDuplicate] = useState<OnDuplicate>("skip");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [checked, setChecked] = useState("");
  const [working, setWorking] = useState<"" | "dry" | "real">("");
  const [onlyProblems, setOnlyProblems] = useState(false);
  // One id per set of choices: retrying the same real run returns the first result.
  const [operation, setOperation] = useState(() => crypto.randomUUID());

  const headers = table[0] ?? [];
  const rows = useMemo(() => rowsFromTable(table, mapping), [table, mapping]);
  const signature = JSON.stringify([fileName, rows, onDuplicate]);
  const tooMany = rows.length > MAX_IMPORT_ROWS;
  const canRun = rows.length > 0 && mapping.title !== undefined && !tooMany;
  const dryDone = result?.dry_run && checked === signature;

  function reset(next: Partial<{ mapping: ImportMapping; onDuplicate: OnDuplicate }>) {
    if (next.mapping) setMapping(next.mapping);
    if (next.onDuplicate) setOnDuplicate(next.onDuplicate);
    setResult(null);
    setChecked("");
    setOperation(crypto.randomUUID());
  }

  async function readFile(file: File) {
    const text = await file.text();
    const parsed = parseCsv(text);
    setFileName(file.name);
    setTable(parsed);
    reset({ mapping: guessMapping(parsed[0] ?? []) });
    if (parsed.length < 2) toast.error("الملف فاضي أو فيه سطر العناوين بس.");
  }

  async function go(dry: boolean) {
    if (!canRun) return;
    setWorking(dry ? "dry" : "real");
    await run(dry ? "import-dry" : "import", async () => {
      const out = await runImport(operation, rows, onDuplicate, dry, fileName);
      setResult(out);
      setChecked(signature);
      if (!dry) {
        toast.success(
          out.replayed
            ? "هالاستيراد انعمل من قبل: هاي نتيجته (ما انضاف إشي مرة ثانية)."
            : `انضاف ${out.create} واتحدّث ${out.update} (كلهم مسودات).`,
        );
      }
    });
    setWorking("");
  }

  const shown = (result?.rows ?? []).filter(
    (r) => !onlyProblems || r.action === "error" || (r.warnings ?? []).length > 0,
  );

  return (
    <section className="space-y-4">
      <div>
        <h2 className={sectionTitle}>استيراد من ملف CSV</h2>
        <p className={muted}>
          بيانات الكتب بس (العنوان، الكاتب، ISBN، السنة، الصفحات، المستوى، اللغة، التصنيف، الوسوم،
          الوصف). الكتب الجديدة بتنضاف مسودات، والغلاف والـ PDF بتضيفهم بإيدك بعدين. لحد{" "}
          {MAX_IMPORT_ROWS} صف بالمرة.
        </p>
      </div>

      <div className="grid gap-4 rounded-2xl border border-[var(--pp-line)] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={input}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="sr-only"
            id="bk-import-file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void readFile(file);
              e.target.value = "";
            }}
          />
          <label htmlFor="bk-import-file" className="rita-btn rita-btn-soft cursor-pointer gap-2">
            <FileUp size={16} aria-hidden="true" /> اختار ملف CSV
          </label>
          {fileName && (
            <span className="text-[14px] font-semibold" dir="auto">
              {fileName} · {rows.length} صف
            </span>
          )}
        </div>
        {tooMany && (
          <p className="rounded-lg bg-[#fbe9ed] p-3 text-[14px] font-semibold text-[#8c1a31]">
            الملف فيه {rows.length} صف. قسّمه لملفات لحد {MAX_IMPORT_ROWS} صف.
          </p>
        )}

        {headers.length > 0 && (
          <>
            <div className="grid gap-2">
              <p className="text-[15px] font-semibold">وين كل معلومة بالملف؟</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {IMPORT_FIELDS.map((f: ImportField) => (
                  <label key={f} className={label}>
                    {IMPORT_FIELD_LABELS[f].ar}
                    {f === "title" ? " (لازم)" : ""}
                    <select
                      className={`${field} rita-select`}
                      value={mapping[f] ?? ""}
                      onChange={(e) => {
                        const next = { ...mapping };
                        if (e.target.value === "") delete next[f];
                        else next[f] = Number(e.target.value);
                        reset({ mapping: next });
                      }}
                    >
                      <option value="">— مش موجود —</option>
                      {headers.map((h, i) => (
                        <option key={`${h}-${i}`} value={i}>
                          {h || `عمود ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <p className="text-[15px] font-semibold">
                إذا الكتاب موجود من قبل (نفس ISBN، أو نفس العنوان والكاتب)
              </p>
              <Choice
                name="الكتب المكررة"
                value={onDuplicate}
                onChange={(v) => reset({ onDuplicate: v })}
                options={[
                  ["skip", "اتركه زي ما هو"],
                  ["update", "حدّث بياناته"],
                  ["create", "أضفه كنسخة جديدة"],
                ]}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rita-btn rita-btn-soft gap-2"
                disabled={!canRun || Boolean(working)}
                onClick={() => void go(true)}
              >
                {working === "dry" && <Loader2 size={15} className="animate-spin" />}
                جرّب بدون حفظ
              </button>
              <button
                type="button"
                className="rita-btn rita-btn-primary gap-2"
                disabled={!canRun || !dryDone || Boolean(working)}
                title={!dryDone ? "جرّب بدون حفظ أول" : undefined}
                onClick={() => void go(false)}
              >
                {working === "real" && <Loader2 size={15} className="animate-spin" />}
                استورد {result?.dry_run ? `${result.create + result.update} كتاب` : ""}
              </button>
            </div>
            {mapping.title === undefined && <p className={muted}>اختار عمود العنوان أول.</p>}
          </>
        )}

        {result && (
          <div className="grid gap-3" aria-live="polite">
            <p className="text-[15px] font-semibold">
              {result.dry_run
                ? "التجربة (ما انحفظ إشي):"
                : result.replayed
                  ? "نتيجة الاستيراد (من قبل):"
                  : "انستورد:"}{" "}
              {result.create} جديد · {result.update} تحديث · {result.skip} بينترك · {result.errors}{" "}
              غلط
            </p>
            <label className="flex min-h-11 items-center gap-2 text-[14px] font-semibold">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={onlyProblems}
                onChange={(e) => setOnlyProblems(e.target.checked)}
              />
              بس الصفوف اللي فيها مشكلة أو تنبيه
            </label>
            <div className="max-h-[420px] overflow-auto rounded-xl border border-[var(--pp-line)]">
              <table className="w-full text-[14px]">
                <thead className="sticky top-0 bg-[var(--pp-grey)] text-start">
                  <tr>
                    <th className="p-2 text-start">صف</th>
                    <th className="p-2 text-start">العنوان</th>
                    <th className="p-2 text-start">شو بصير</th>
                    <th className="p-2 text-start">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--pp-line)]">
                  {shown.map((r) => (
                    <tr key={r.row}>
                      <td className="p-2 align-top" dir="ltr">
                        {r.row + 1}
                      </td>
                      <td className="p-2 align-top font-semibold" dir="auto">
                        {r.title || "—"}
                      </td>
                      <td className="p-2 align-top">
                        <Badge tone={ACTION_TONE[r.action]}>{ACTION_WORDS[r.action]}</Badge>
                      </td>
                      <td className="p-2 align-top text-[13px]">
                        {[...(r.errors ?? []), ...(r.warnings ?? [])]
                          .map(importMessage)
                          .join(" · ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={muted}>رقم الصف حسب الملف (الصف 1 هو العناوين).</p>
          </div>
        )}
      </div>

      {library.imports.length > 0 && (
        <div className="grid gap-2">
          <p className="text-[15px] font-semibold">آخر الاستيرادات</p>
          <ul className="divide-y divide-[var(--pp-line)] rounded-2xl border border-[var(--pp-line)] text-[14px]">
            {library.imports.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-2 p-3">
                <span className="min-w-0 flex-1 font-semibold" dir="auto">
                  {item.file_name || "ملف بدون اسم"}
                </span>
                <span className="text-[var(--pp-muted)]">
                  {new Date(item.created_at).toLocaleString("ar-u-nu-latn", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
                <span>
                  {item.result
                    ? `${item.result.create} جديد · ${item.result.update} تحديث · ${item.result.errors} غلط`
                    : "ما خلص"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Quality({ books, onEdit }: { books: Book[]; onEdit: (book: Book) => void }) {
  const report = useMemo(() => qualityReport(books), [books]);
  const groups: [string, Book[]][] = [
    ["مسودات مش جاهزة للنشر", report.notReady],
    ["بدون ملف PDF", report.noPdf],
    ["بدون غلاف", report.noCover],
    ["بدون ISBN", report.noIsbn],
  ];
  return (
    <section className="space-y-4">
      <div>
        <h2 className={sectionTitle}>الجودة</h2>
        <p className={muted}>شو ناقص الكتب (المؤرشفة مش محسوبة). اضغط على كتاب لتعدّله.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[...groups, ["مكرر محتمل", report.duplicates.flat()] as [string, Book[]]].map(
          ([name, list]) => (
            <div key={name} className="rounded-2xl bg-[var(--pp-grey)] p-4">
              <p className="text-[30px] font-semibold leading-none">{list.length}</p>
              <p className="mt-2 text-[13px] text-[var(--pp-muted)]">{name}</p>
            </div>
          ),
        )}
      </div>
      {groups
        .filter(([, list]) => list.length)
        .map(([name, list]) => (
          <details key={name} className="rounded-2xl border border-[var(--pp-line)]">
            <summary className="min-h-11 cursor-pointer content-center px-4 text-[15px] font-semibold">
              {name} ({list.length})
            </summary>
            <BookLinks books={list} onEdit={onEdit} />
          </details>
        ))}
      {report.duplicates.length > 0 && (
        <details className="rounded-2xl border border-[var(--pp-line)]">
          <summary className="min-h-11 cursor-pointer content-center px-4 text-[15px] font-semibold">
            كتب بنفس العنوان والكاتب ({report.duplicates.length})
          </summary>
          {report.duplicates.map((group) => (
            <BookLinks key={group[0].id} books={group} onEdit={onEdit} />
          ))}
        </details>
      )}
    </section>
  );
}

function BookLinks({ books, onEdit }: { books: Book[]; onEdit: (book: Book) => void }) {
  return (
    <ul className="flex flex-wrap gap-2 border-t border-[var(--pp-line)] p-3">
      {books.map((b) => (
        <li key={b.id}>
          <button
            type="button"
            className="min-h-11 rounded-full border border-[var(--pp-line)] px-4 text-[14px] font-semibold hover:border-[var(--pp-ink)]"
            dir="auto"
            onClick={() => onEdit(b)}
          >
            {b.title}
          </button>
        </li>
      ))}
    </ul>
  );
}

function Trash({ library, busy, run }: { library: AdminLibrary; busy: string; run: Run }) {
  if (!library.trash.length) return null;
  return (
    <section className="space-y-3">
      <h2 className={sectionTitle}>ملفات قديمة لسا ما انشالت ({library.trash.length})</h2>
      <p className={muted}>
        لما بتبدّل غلاف أو PDF، القديم بينشال بعد ما ينحفظ الجديد. إذا ما زبط الحذف وقتها، بيستنى
        هون.
      </p>
      <button
        type="button"
        className="rita-btn rita-btn-soft gap-2"
        disabled={Boolean(busy)}
        onClick={() =>
          void run("trash", async () => {
            const left = await cleanFileTrash(library.trash);
            if (left) toast.warning(`ضل ${left} ملف. جرّب بعدين.`);
            else toast.success("انشالت كل الملفات القديمة.");
          })
        }
      >
        <RotateCcw size={15} aria-hidden="true" /> جرّب تشيلهم هلأ
      </button>
    </section>
  );
}
