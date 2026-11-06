// Uzyra's written sheet. A long answer is spoken as one short sentence, and the details are written
// after the line [[SHEET]] (the voice worker never speaks that part; see voice-agent/rita_sheet.py).
// The page shows the sheet as a tidy page under her words, in the style of the study guide. The
// sheet uses a few simple lines:
//   # Title
//   | head | head |      then | cell | cell |  per row
//   - a point
//   = an example, with the key word in **bold**
//   ! a watch-out line
// Anything else is a plain line. Nothing here throws: a sheet the model wrote badly still shows.

const MARKER = /\[\[\s*sheet\s*\]\]/i;
export const SHEET_MARKER = "[[SHEET]]";

/** The spoken part and the sheet ("" when the reply has none). */
export function splitSheet(text: string): { speech: string; sheet: string } {
  const match = MARKER.exec(text);
  if (!match) {
    // While the reply streams, a half-written marker at the very end is not shown.
    const partial = /\[(?:\[\s*s?h?e?e?t?\s*\]?)?$/i.exec(text);
    return { speech: partial ? text.slice(0, partial.index) : text, sheet: "" };
  }
  return {
    speech: text.slice(0, match.index),
    sheet: text.slice(match.index + match[0].length).trim(),
  };
}

/** The reply text with its sheet, as it is kept and saved. */
export function joinSheet(speech: string, sheet: string): string {
  const said = speech.trim();
  return sheet.trim() ? `${said}\n${SHEET_MARKER}\n${sheet.trim()}` : said;
}

export type SheetBlock =
  | { kind: "title"; text: string }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "points"; items: string[] }
  | { kind: "example"; text: string }
  | { kind: "watch"; text: string }
  | { kind: "line"; text: string };

const MAX_LINES = 30;
const MAX_COLUMNS = 4;

function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim())
    .slice(0, MAX_COLUMNS);
}

const isDivider = (line: string) => /^\|?[\s:|-]+\|?$/.test(line.trim()) && line.includes("-");

/** The sheet's lines turned into blocks; neighbouring table rows and points join up. */
export function parseSheet(sheet: string): SheetBlock[] {
  const blocks: SheetBlock[] = [];
  const lines = sheet
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_LINES);
  for (const line of lines) {
    const last = blocks[blocks.length - 1];
    if (line.startsWith("|")) {
      if (isDivider(line)) continue;
      const row = cells(line);
      if (!row.some(Boolean)) continue;
      if (last?.kind === "table") last.rows.push(row);
      else blocks.push({ kind: "table", head: row, rows: [] });
      continue;
    }
    const mark = line[0];
    const rest = line.replace(/^(#{1,3}|[-*•=!])\s*/, "").trim();
    if (!rest) continue;
    if (line.startsWith("#")) blocks.push({ kind: "title", text: rest });
    else if (mark === "-" || mark === "*" || mark === "•") {
      if (last?.kind === "points") last.items.push(rest);
      else blocks.push({ kind: "points", items: [rest] });
    } else if (mark === "=") blocks.push({ kind: "example", text: rest });
    else if (mark === "!")
      blocks.push({ kind: "watch", text: rest.replace(/^(watch out|انتبه|احذر)\s*[:：]\s*/i, "") });
    else blocks.push({ kind: "line", text: line });
  }
  // A table needs a head and at least one row; a lone row reads better as a line.
  return blocks.map((block) =>
    block.kind === "table" && block.rows.length === 0
      ? { kind: "line", text: block.head.filter(Boolean).join(" · ") }
      : block,
  );
}

/** Splits **bold** out of a line. */
export function boldParts(text: string): { text: string; bold: boolean }[] {
  const out: { text: string; bold: boolean }[] = [];
  const pattern = /\*\*([^*]+)\*\*/g;
  let at = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > at) out.push({ text: text.slice(at, match.index), bold: false });
    out.push({ text: match[1]!, bold: true });
    at = match.index + match[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at), bold: false });
  return out.map((part) => ({ ...part, text: part.text.replace(/\*\*/g, "") }));
}
