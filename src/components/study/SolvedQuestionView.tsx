import { Check, Flag, Trash2, X } from "lucide-react";

export type SolvedOption = { letter: string; body: string; is_correct: boolean; why?: string };

export type SolvedQuestion = {
  id: string;
  position: number;
  stem: string;
  options: SolvedOption[];
  concept: string;
  explanation: string;
  summary_table: string;
  difficulty: string;
  flagged: boolean;
};

/** Splits the markdown explanation into its three titled sections. */
function sections(md: string) {
  const out: { title: string; lines: string[] }[] = [];
  let current: { title: string; lines: string[] } | null = null;
  for (const rawLine of String(md || "").split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const heading = /^\*\*(.+?)\*\*:?$/.exec(line);
    if (heading) {
      current = { title: heading[1], lines: [] };
      out.push(current);
      continue;
    }
    if (!current) {
      current = { title: "Concept", lines: [] };
      out.push(current);
    }
    current.lines.push(line.replace(/^[-*]\s*/, ""));
  }
  return out;
}

function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className="font-black">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

function tableRows(md: string): string[][] {
  return String(md || "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|") && !/^\|[\s:|-]+\|$/.test(l))
    .map((l) =>
      l
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => c.trim()),
    );
}

const TONE: Record<string, string> = {
  easy: "#6ab887",
  medium: "#e0a35c",
  hard: "#d1795e",
};

export function SolvedQuestionView({
  question,
  total,
  onFlag,
  onDelete,
}: {
  question: SolvedQuestion;
  total: number;
  onFlag?: () => void;
  onDelete?: () => void;
}) {
  const blocks = sections(question.explanation);
  const rows = tableRows(question.summary_table);
  const head = rows[0];
  const body = rows.slice(1);

  return (
    <article className="overflow-hidden rounded-3xl border border-black/[0.06] bg-white">
      <header className="flex items-center gap-3 border-b border-black/[0.06] bg-[#fbf5e9] px-5 py-3.5">
        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#a29a8d]">
          Q{question.position} / {total}
        </span>
        {question.concept && (
          <span
            className="rounded-full px-3 py-1 text-[11px] font-black text-white"
            style={{ background: TONE[question.difficulty] ?? "#6ab887" }}
          >
            {question.concept}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {onFlag && (
            <button
              type="button"
              onClick={onFlag}
              aria-label="Flag question"
              className={`grid h-9 w-9 place-items-center rounded-xl transition-colors ${
                question.flagged ? "bg-[#f7e2d8] text-[#d1795e]" : "text-[#a29a8d] hover:bg-black/[0.05]"
              }`}
            >
              <Flag size={15} />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              aria-label="Delete question"
              className="grid h-9 w-9 place-items-center rounded-xl text-[#a29a8d] transition-colors hover:bg-black/[0.05] hover:text-[#d1795e]"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </header>

      <div className="px-5 py-5 sm:px-7">
        <h2 className="text-[19px] font-black leading-snug text-[#23201d]">{question.stem}</h2>

        <ul className="mt-4 flex flex-col gap-2">
          {question.options.map((o) => (
            <li
              key={o.letter}
              className={`flex items-start gap-3 rounded-2xl px-4 py-3 text-[14.5px] font-bold ${
                o.is_correct
                  ? "bg-[#eaf6ee] text-[#215237] ring-1 ring-[#6ab887]"
                  : "bg-[#faf6ee] text-[#57524a]"
              }`}
            >
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-black ${
                  o.is_correct ? "bg-[#6ab887] text-white" : "bg-white text-[#a29a8d]"
                }`}
              >
                {o.is_correct ? <Check size={13} strokeWidth={3.5} /> : o.letter}
              </span>
              {o.body}
            </li>
          ))}
        </ul>

        {blocks.length > 0 && (
          <div className="mt-6 rounded-2xl bg-[#fbf5e9] p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#b3aa9c]">
              Explanation
            </p>
            {blocks.map((b, i) => (
              <section key={i} className="mt-4 first:mt-3">
                <p className="text-[14px] font-black text-[#23201d]">{b.title}</p>
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {b.lines.map((line, j) => (
                    <li key={j} className="text-[13.5px] font-medium leading-relaxed text-[#57524a]">
                      {inline(line)}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        {body.length > 0 && head && (
          <div className="mt-5 overflow-hidden rounded-2xl border border-black/[0.06]">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#23201d] text-white">
                  {head.map((h, i) => (
                    <th key={i} className="px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.14em]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((r, i) => (
                  <tr key={i} className="border-t border-black/[0.06]">
                    {r.map((c, j) => (
                      <td key={j} className="px-4 py-3 align-top text-[13.5px] font-semibold text-[#57524a]">
                        {c === "✓" ? (
                          <Check size={16} className="text-[#3f9a63]" strokeWidth={3} />
                        ) : c === "✗" || c === "x" ? (
                          <X size={16} className="text-[#d1795e]" strokeWidth={3} />
                        ) : (
                          c
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </article>
  );
}
