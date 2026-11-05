import { Fragment } from "react";
import { boldParts, parseSheet, type SheetBlock } from "@/lib/rita-sheet";
import { textDirection } from "./chat-text";

/** A line with any Arabic in it reads right to left; an English or German line left to right. */
const lineDir = (text: string) => (/[\u0600-\u06FF]/.test(text) ? "rtl" : "ltr");

// Table heads take the guide's pill colours in turn: grey, green, blue.
const TONES = ["is-neutral", "is-green", "is-blue"];

/**
 * The written part of a long answer, laid out like a page of the study guide: a title, a small
 * table with coloured heads, points, examples with the key word in bold, and a blue watch-out.
 * Rita says one short sentence; this is what she writes under it.
 */
export function RitaSheet({
  sheet,
  onPhrase,
}: {
  sheet: string;
  onPhrase?: (phrase: string) => void;
}) {
  const blocks = parseSheet(sheet);
  if (blocks.length === 0) return null;
  const direction = textDirection(sheet);
  return (
    <div className="rita-sheet" dir={direction} lang={direction === "rtl" ? "ar" : undefined}>
      {blocks.map((block, index) => (
        <SheetPart key={index} block={block} rtl={direction === "rtl"} onPhrase={onPhrase} />
      ))}
    </div>
  );
}

function Rich({ text, onPhrase }: { text: string; onPhrase?: (phrase: string) => void }) {
  return (
    <>
      {boldParts(text).map((part, index) =>
        !part.bold ? (
          <Fragment key={index}>{part.text}</Fragment>
        ) : onPhrase && textDirection(part.text) === "ltr" ? (
          <button
            key={index}
            type="button"
            className="rita-sheet-word"
            onClick={() => onPhrase(part.text)}
            aria-label={`${part.text}: translation and pronunciation`}
          >
            {part.text}
          </button>
        ) : (
          <b key={index}>{part.text}</b>
        ),
      )}
    </>
  );
}

function SheetPart({
  block,
  rtl,
  onPhrase,
}: {
  block: SheetBlock;
  rtl: boolean;
  onPhrase?: (phrase: string) => void;
}) {
  switch (block.kind) {
    case "title":
      return (
        <h3 className="rita-sheet-title" dir={lineDir(block.text)}>
          <Rich text={block.text} />
        </h3>
      );
    case "table": {
      const width = Math.max(block.head.length, ...block.rows.map((row) => row.length));
      const columns = Array.from({ length: width }, (_, i) => i);
      return (
        <div className="rita-sheet-table-wrap">
          <table className="rita-sheet-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c} scope="col">
                    <span
                      className={`rita-sheet-pill ${TONES[c % TONES.length]}`}
                      dir={lineDir(block.head[c] ?? "")}
                    >
                      {block.head[c] ?? ""}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {columns.map((c) => (
                    <td key={c} className={c === 0 ? "is-label" : undefined}>
                      <bdi dir={lineDir(row[c] ?? "")}>
                        <Rich text={row[c] ?? ""} onPhrase={onPhrase} />
                      </bdi>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case "points":
      return (
        <ul className="rita-sheet-points">
          {block.items.map((item, i) => (
            <li key={i} dir={lineDir(item)}>
              <Rich text={item} onPhrase={onPhrase} />
            </li>
          ))}
        </ul>
      );
    case "example":
      return (
        <p className="rita-sheet-example" dir={lineDir(block.text)}>
          <Rich text={block.text} onPhrase={onPhrase} />
        </p>
      );
    case "watch":
      return (
        <aside className="rita-sheet-watch">
          <p className="rita-sheet-watch-title">{rtl ? "انتبه" : "Watch out"}</p>
          <p dir={lineDir(block.text)}>
            <Rich text={block.text} onPhrase={onPhrase} />
          </p>
        </aside>
      );
    default:
      return (
        <p className="rita-sheet-line" dir={lineDir(block.text)}>
          <Rich text={block.text} onPhrase={onPhrase} />
        </p>
      );
  }
}
