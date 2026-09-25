import { useMemo } from "react";

/**
 * Organised reader for AI-written study guides.
 *
 * The writer often glues headings into the middle of a paragraph
 * ("## Key findings * Height: 109 cm ..."), so this parser splits on
 * headings and bullet markers wherever they appear, then renders each
 * "##" section as its own tinted card with clear separation.
 */

type Tone = { kicker: string; rule: string; chip: string; dot: string };

const TONES: Tone[] = [
  { kicker: "#3f7a29", rule: "#d6ead0", chip: "#eef7ea", dot: "#58a700" },
  { kicker: "#4a3877", rule: "#ded5f1", chip: "#f5f1fd", dot: "#6f57b8" },
  { kicker: "#7a4b16", rule: "#f0dcc0", chip: "#fdf5ea", dot: "#c98a34" },
  { kicker: "#75283a", rule: "#f0d3d9", chip: "#fdf0f3", dot: "#bb5a72" },
  { kicker: "#1f4c6d", rule: "#cfe1ef", chip: "#eff7fd", dot: "#4a8ab5" },
];

const INK = "#231f1a";
const BODY = "#3d3833";
const MUTED = "#6b6357";

type Node =
  | { kind: "heading"; text: string }
  | { kind: "para"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] };

type Section = { heading: string | null; nodes: Node[] };

/* ---------- parsing ---------- */

/** Force headings and bullet markers onto their own lines. */
function normalise(raw: string) {
  let t = raw.replace(/\r\n/g, "\n");
  // "text ## Heading" -> newline before the heading
  t = t.replace(/([^\n])\s(#{1,6}\s)/g, "$1\n\n$2");
  // heading run-on: "## Heading Body text" is handled later by splitting the heading line
  // " * item" or " - item" mid-paragraph -> own line
  t = t.replace(/([^\n])\s([*-])\s+(?=\S)/g, "$1\n$2 ");
  return t;
}

/** A heading line often carries its body behind it — cut it at the first bold term or sentence. */
const SENTENCE_START =
  /^(This|That|These|Those|The|A|An|In|It|Its|We|When|Here|Also|Patients?|There|His|Her|He|She|After|Before|On)$/;

function splitHeadingLine(line: string): { heading: string; rest: string } {
  const body = line.replace(/^#{1,6}\s*/, "");
  const bulletAt = body.search(/\s[*-]\s/);
  let cut = bulletAt > 0 ? bulletAt : -1;

  const boldAt = body.indexOf("**");
  if (boldAt > 0 && (cut === -1 || boldAt < cut)) cut = boldAt;

  // A heading is usually 2-6 words; the body then opens with a sentence starter.
  const words = body.split(/\s+/);
  for (let i = 2; i < Math.min(words.length, 9); i += 1) {
    if (SENTENCE_START.test(words[i]!.replace(/[^A-Za-z]/g, ""))) {
      const at = body.indexOf(words[i]!, words.slice(0, i).join(" ").length);
      if (at > 0 && (cut === -1 || at < cut)) cut = at;
      break;
    }
  }
  if (cut === -1 && words.length > 8) cut = body.indexOf(words[8]!);

  if (cut > 0) return { heading: body.slice(0, cut).trim().replace(/[:—-]$/, ""), rest: body.slice(cut).trim() };
  return { heading: body.trim(), rest: "" };
}


function parseTable(lines: string[]) {
  const rows = lines
    .filter((l) => !/^\s*\|[-:\s|]+\|\s*$/.test(l))
    .map((l) =>
      l
        .replace(/^\s*\|/, "")
        .replace(/\|\s*$/, "")
        .split("|")
        .map((c) => c.trim()),
    );
  const [head, ...body] = rows;
  return { head: head ?? [], rows: body };
}

export function parseGuide(raw: string): Section[] {
  const text = normalise(raw);
  const sections: Section[] = [];
  let current: Section = { heading: null, nodes: [] };
  const push = (n: Node) => current.nodes.push(n);

  const lines = text.split("\n");
  let i = 0;
  let paraBuf: string[] = [];
  let bulletBuf: string[] = [];

  const flushPara = () => {
    const t = paraBuf.join(" ").trim();
    if (t) push({ kind: "para", text: t });
    paraBuf = [];
  };
  const flushBullets = () => {
    if (bulletBuf.length) push({ kind: "bullets", items: bulletBuf.slice() });
    bulletBuf = [];
  };
  const flushAll = () => {
    flushBullets();
    flushPara();
  };

  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (!trimmed) {
      flushAll();
      i += 1;
      continue;
    }

    if (/^#{1,6}\s/.test(trimmed)) {
      flushAll();
      if (current.heading || current.nodes.length) sections.push(current);
      const { heading, rest } = splitHeadingLine(trimmed);
      current = { heading, nodes: [] };
      if (rest) lines.splice(i + 1, 0, rest);
      i += 1;
      continue;
    }

    if (trimmed.startsWith("|")) {
      flushAll();
      const block: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith("|")) {
        block.push(lines[i]!);
        i += 1;
      }
      const { head, rows } = parseTable(block);
      push({ kind: "table", head, rows });
      continue;
    }

    if (/^\s*([-*•]|\d+[.)])\s+/.test(line)) {
      flushPara();
      bulletBuf.push(trimmed.replace(/^\s*([-*•]|\d+[.)])\s*/, ""));
      i += 1;
      continue;
    }

    flushBullets();
    paraBuf.push(trimmed);
    i += 1;
  }

  flushAll();
  if (current.heading || current.nodes.length) sections.push(current);
  return sections;
}

/* ---------- rendering ---------- */

function Inline({ text, tone }: { text: string; tone: Tone }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong
            key={i}
            className="rounded-md px-1 py-[1px] font-black"
            style={{ background: tone.chip, color: INK }}
          >
            {p.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function Bullet({ item, tone, index }: { item: string; tone: Tone; index: number }) {
  // pull a leading "**Term**:" or "Term:" out as a label
  const m = item.match(/^\*\*([^*]{2,60})\*\*\s*[:—-]\s*(.+)$/);
  const label = m?.[1];
  const rest = m?.[2] ?? item;
  return (
    <li className="flex gap-3 text-[15px] leading-[1.7]" style={{ color: BODY }}>
      <span
        className="mt-[3px] grid h-5 w-5 shrink-0 place-items-center rounded-md text-[10px] font-black"
        style={{ background: tone.chip, color: tone.kicker }}
      >
        {index + 1}
      </span>
      <span className="min-w-0">
        {label && (
          <span className="mr-1 font-black" style={{ color: tone.kicker }}>
            {label}:
          </span>
        )}
        <Inline text={rest} tone={tone} />
      </span>
    </li>
  );
}

function isExaminer(heading: string | null) {
  return !!heading && /examiner|exam question|what your examiner asks/i.test(heading);
}

function SectionCard({ section, index }: { section: Section; index: number }) {
  const tone = TONES[index % TONES.length]!;
  const examiner = isExaminer(section.heading);

  return (
    <section
      className="rounded-3xl border p-5 md:p-6"
      style={{
        borderColor: examiner ? tone.rule : "rgba(0,0,0,0.07)",
        background: examiner ? tone.chip : "#ffffff",
      }}
    >
      {section.heading && (
        <header className="mb-4">
          <p
            className="mb-1 text-[10px] font-black uppercase tracking-[0.3em]"
            style={{ color: tone.kicker }}
          >
            {examiner ? "Exam focus" : `Section ${String(index + 1).padStart(2, "0")}`}
          </p>
          <h3 className="font-display text-[20px] font-black leading-tight" style={{ color: INK }}>
            {section.heading}
          </h3>
          <div className="mt-3 h-[3px] w-14 rounded-full" style={{ background: tone.dot }} />
        </header>
      )}

      <div className="space-y-4">
        {section.nodes.map((n, i) => {
          if (n.kind === "para")
            return (
              <p key={i} className="text-[15px] leading-[1.75]" style={{ color: BODY }}>
                <Inline text={n.text} tone={tone} />
              </p>
            );
          if (n.kind === "bullets")
            return (
              <ul key={i} className="space-y-2.5">
                {n.items.map((it, j) => (
                  <Bullet key={j} item={it} tone={tone} index={j} />
                ))}
              </ul>
            );
          if (n.kind === "table")
            return (
              <div
                key={i}
                className="overflow-x-auto rounded-2xl border"
                style={{ borderColor: tone.rule }}
              >
                <table className="w-full text-[14px]">
                  <thead>
                    <tr style={{ background: tone.chip }}>
                      {n.head.map((c, j) => (
                        <th
                          key={j}
                          className="px-3 py-2.5 text-left font-black"
                          style={{ color: tone.kicker }}
                        >
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {n.rows.map((r, j) => (
                      <tr key={j} className="border-t" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
                        {r.map((c, k) => (
                          <td key={k} className="px-3 py-2.5 align-top" style={{ color: BODY }}>
                            <Inline text={c} tone={tone} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          return null;
        })}
      </div>
    </section>
  );
}

export function GuideDoc({ text, compact = false }: { text: string; compact?: boolean }) {
  const sections = useMemo(() => parseGuide(text), [text]);
  if (!sections.length)
    return (
      <p className="text-[15px]" style={{ color: MUTED }}>
        Nothing written yet.
      </p>
    );
  return (
    <div className={compact ? "space-y-4" : "space-y-5"}>
      {sections.map((s, i) => (
        <SectionCard key={i} section={s} index={i} />
      ))}
    </div>
  );
}
