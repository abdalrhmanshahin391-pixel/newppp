// Turns a guide (data) into one HTML document for printing: page size, fonts, header, tables with
// coloured pill headings, the cards and the Arabic note. Pure and string-based, so it runs on the
// server and in node tests. Every piece of text is escaped here; a guide cannot carry HTML.
// The look follows docs in DESIGN.md ("Guides"): ink titles, the site blue for headings and the
// taught term, soft tinted cards, and the Uzyra mark with the name at the top right.
import { BRAND_NAME, UZYRA_MARK_PATHS, UZYRA_MARK_VIEWBOX } from "../brand.ts";
import {
  parseMarkup,
  plainText,
  type GuideContent,
  type Run,
  type Section,
  type Tone,
} from "./guide-content.ts";

/** Page size in points: the same shape as the reference booklet (close to A5). */
export const PAGE_WIDTH_PT = 439;
export const PAGE_HEIGHT_PT = 621;

export type GuideHtmlOptions = {
  /** Shown in the footer until the owner approves the guide. */
  draft?: boolean;
  /** Where the font files are, ending with a slash. Relative to the HTML file by default. */
  fontBase?: string;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** "-ing" and "+s" must never break across two lines. */
function keepTogether(escaped: string): string {
  return escaped
    .replace(/(^|[\s(])([-+][A-Za-z]{1,6})(?=$|[\s.,;:!?)])/g, '$1<span class="nb">$2</span>')
    .replace(/([+→]) (?=<span class="nb">)/g, "$1&nbsp;");
}

const LATIN_RUN =
  /[-+]?[A-Za-z0-9][A-Za-z0-9'’+/-]*(?:\s+(?:[/+-]\s+)?[A-Za-z0-9][A-Za-z0-9'’+/-]*)*/g;

/** Latin words inside an Arabic note keep their own direction, so "he / she / it" stays in order. */
function isolateLatin(escaped: string): string {
  return escaped.replace(LATIN_RUN, '<bdi dir="ltr">$&</bdi>');
}

function runsHtml(runs: Run[], arabic = false): string {
  return runs
    .map((run) => {
      let html = escapeHtml(run.text);
      html = arabic ? isolateLatin(html) : keepTogether(html);
      if (run.term) html = `<span class="term">${html}</span>`;
      if (run.strong) html = `<b>${html}</b>`;
      if (run.italic) html = `<i>${html}</i>`;
      return html;
    })
    .join("");
}

const inline = (input: string) => runsHtml(parseMarkup(input));

function tone(value: Tone): string {
  return `tone-${value}`;
}

/** Column shares from how much each column has to hold, never narrower than 16%. */
function widths(columns: string[][]): string[] {
  const weights = columns.map((cells) => {
    const longest = Math.max(...cells.map((cell) => plainText(cell).length), 6);
    return Math.min(Math.max(longest, 9), 34);
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const shares = weights.map((weight) => Math.max(16, (weight / total) * 100));
  const scale = 100 / shares.reduce((sum, share) => sum + share, 0);
  return shares.map((share) => `${(share * scale).toFixed(1)}%`);
}

function tableHtml(section: Extract<Section, { kind: "table" }>): string {
  const columns = section.columns.map((column, index) => [
    column.label,
    ...section.rows.map((row) => row[index] ?? ""),
  ]);
  const cols = widths(columns)
    .map((width) => `<col style="width:${width}">`)
    .join("");
  const head = section.columns
    .map(
      (column) =>
        `<th><span class="pill ${tone(column.tone)}">${escapeHtml(column.label)}</span></th>`,
    )
    .join("");
  const body = section.rows
    .map(
      (row) =>
        `<tr>${row
          .map((value, index) =>
            section.row_headers && index === 0
              ? `<td class="rowlab">${inline(value)}</td>`
              : `<td>${inline(value)}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");
  return `<section class="block"><h2 class="sec">${escapeHtml(section.heading)}</h2><table class="grid"><colgroup>${cols}</colgroup><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></section>`;
}

function matrixHtml(section: Extract<Section, { kind: "matrix" }>): string {
  const head = `<th></th>${section.columns
    .map((column) => `<th><span class="pill tone-blue solid">${escapeHtml(column)}</span></th>`)
    .join("")}`;
  const body = section.rows
    .map(
      (row) =>
        `<tr><th class="rowhead"><span class="pill tone-green solid tall">${escapeHtml(row.label)}</span></th>${row.cells
          .map((value) => `<td>${inline(value)}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  return `<section class="block"><h2 class="sec">${escapeHtml(section.heading)}</h2><table class="grid matrix"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></section>`;
}

function usageHtml(section: Extract<Section, { kind: "usage" }>): string {
  const items = section.items
    .map((item) => {
      const label = item.label ? `${escapeHtml(item.label)}: ` : "";
      return `<p>${label}<span class="ex">${inline(item.example)}</span></p>`;
    })
    .join("");
  return `<section class="card usage block"><h3>${escapeHtml(section.heading)}</h3>${items}</section>`;
}

function rulesHtml(section: Extract<Section, { kind: "rules" }>): string {
  const items = section.items
    .map(
      (item) =>
        `<li><div class="rule">${inline(item.rule)}</div>${item.examples
          .map((example) => `<div class="ex">${inline(example)}</div>`)
          .join("")}</li>`,
    )
    .join("");
  return `<section class="block"><h2 class="sec">${escapeHtml(section.heading)}</h2><ul class="rules">${items}</ul></section>`;
}

function sectionHtml(section: Section): string {
  switch (section.kind) {
    case "table":
      return tableHtml(section);
    case "matrix":
      return matrixHtml(section);
    case "usage":
      return usageHtml(section);
    case "rules":
      return rulesHtml(section);
  }
}

const markSvg = `<svg class="mark" viewBox="${UZYRA_MARK_VIEWBOX}" fill="currentColor" aria-hidden="true">${UZYRA_MARK_PATHS.map((d) => `<path d="${d}"/>`).join("")}</svg>`;

/** The name's last letter: an A drawn without its crossbar, the same as the site's wordmark. */
const wordmarkA = `<svg class="a" viewBox="0 0 10 9" focusable="false"><path d="M1.1 9 L5 1 L8.9 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="miter" stroke-miterlimit="6"/></svg>`;

const fontFace = (family: string, weight: number, file: string, base: string, style = "normal") =>
  `@font-face{font-family:"${family}";font-weight:${weight};font-style:${style};src:url("${base}${file}") format("woff2")}`;

function css(base: string, footer: string): string {
  const fonts = [
    fontFace("Figtree", 400, "figtree-latin-400-normal.woff2", base),
    fontFace("Figtree", 600, "figtree-latin-600-normal.woff2", base),
    fontFace("Figtree", 700, "figtree-latin-700-normal.woff2", base),
    fontFace("Figtree", 400, "figtree-latin-400-italic.woff2", base, "italic"),
    fontFace("Figtree", 600, "figtree-latin-600-italic.woff2", base, "italic"),
    fontFace("Inter Tight", 600, "inter-tight-latin-600-normal.woff2", base),
    fontFace("Inter Tight", 700, "inter-tight-latin-700-normal.woff2", base),
    fontFace("Outfit", 600, "outfit-latin-600-normal.woff2", base),
    fontFace("Noto Sans Arabic", 400, "noto-sans-arabic-arabic-400-normal.woff2", base),
    fontFace("Noto Sans Arabic", 700, "noto-sans-arabic-arabic-700-normal.woff2", base),
  ].join("");
  return `${fonts}
@page{size:${PAGE_WIDTH_PT}pt ${PAGE_HEIGHT_PT}pt;margin:34pt 34pt 46pt;
@bottom-left{content:"${footer}";font:400 7pt Figtree,sans-serif;letter-spacing:.04em;color:#8a8999}
@bottom-right{content:counter(page);font:400 7pt Figtree,sans-serif;color:#8a8999}}
:root{--ink:#121117;--body:#34333f;--muted:#5c5b6b;--line:#dcdce5;--blue:#2b6df0;--blue-soft:#eaf1ff;--grey:#f4f4f8}
*{box-sizing:border-box}
html{font-size:11pt}
body{margin:0;font-family:Figtree,Arial,sans-serif;color:var(--ink);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.head{display:flex;align-items:center;justify-content:space-between;gap:12pt;padding-bottom:10.5pt;border-bottom:1.1pt solid var(--line)}
.head h1{margin:0;max-width:250pt;font:700 22.5pt/1.05 "Inter Tight",Arial,sans-serif;letter-spacing:-.01em;text-transform:uppercase}
.brand{display:inline-flex;align-items:center;gap:7pt;flex:none;font:600 12pt/1 Outfit,Arial,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:var(--ink)}
.mark{height:19.5pt;width:auto}
.brand .a{display:inline-block;width:.74em;height:.67em;margin-inline-start:-.03em;overflow:visible}
.intro{margin:16.5pt 3pt 0;font-size:10.9pt;line-height:1.55;color:var(--body)}
.term{color:var(--blue);font-weight:700;font-style:italic}
.nb{white-space:nowrap}
.block{break-inside:auto}
h2.sec{margin:16.5pt 0 7.5pt;text-align:center;font:700 14.25pt/1 "Inter Tight",Arial,sans-serif;color:var(--blue);break-after:avoid}
table.grid{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed}
table.grid thead{display:table-header-group}
table.grid tr{break-inside:avoid}
table.grid th{padding:0 2.25pt 4.5pt;font-weight:400}
.pill{display:flex;align-items:center;justify-content:center;min-height:25.5pt;padding:3pt 4.5pt;border-radius:9pt;text-align:center;font:700 9.4pt/1.1 "Inter Tight",Arial,sans-serif;letter-spacing:.02em;text-transform:uppercase}
.pill.tall{min-height:34pt}
.tone-neutral{background:#eeeef2;color:#5c5b6b}
.tone-positive{background:#e2f5e0;color:#2a7d37}
.tone-negative{background:#fbe1e1;color:#b73a30}
.tone-question{background:#dcebff;color:#1b62c9}
.tone-blue{background:#dcebff;color:#1b62c9}
.tone-green{background:#e2f5e0;color:#2a7d37}
.solid.tone-blue{background:var(--blue);color:#fff}
.solid.tone-green{background:#2a7d37;color:#fff}
table.grid td{border:.75pt solid var(--line);padding:6.75pt 6pt;text-align:center;font-size:9.75pt;line-height:1.35;vertical-align:middle;overflow-wrap:anywhere}
table.grid td.rowlab{text-align:left;font-weight:700;background:#fafafd}
table.matrix th.rowhead{width:15%;padding:2pt 2.25pt}
table.matrix td{font-size:9.4pt;padding:9pt 4.5pt}
.card{margin-top:12pt;border-radius:12pt;padding:10.5pt 13.5pt;break-inside:avoid}
.usage{background:var(--blue-soft)}
.card h3{margin:0 0 5pt;font:700 12.75pt/1 "Inter Tight",Arial,sans-serif;color:var(--blue)}
.card p{margin:4.5pt 0;font-size:10.1pt;line-height:1.5;color:var(--body)}
.ex{font-style:italic}
.ex b{font-weight:700;color:var(--ink)}
.callout{background:var(--grey);font-size:10.1pt;line-height:1.55;color:var(--body)}
ul.rules{margin:0;padding:0;list-style:none}
ul.rules li{padding:7pt 3pt;border-bottom:.75pt solid var(--line);break-inside:avoid}
ul.rules .rule{font-weight:700;font-size:10.1pt;line-height:1.45}
ul.rules .ex{font-size:10pt;color:var(--body);margin-top:2pt}
.ar{position:relative;margin-top:9pt;border:1.1pt solid var(--line);border-radius:12pt;padding:8.25pt 12pt;direction:rtl;text-align:right;font:400 10.1pt/1.8 "Noto Sans Arabic",Arial,sans-serif;color:var(--body);break-inside:avoid}
.ar b{font-weight:700;color:var(--ink)}
.ar .tag{position:absolute;left:9pt;top:-6pt;padding:0 4.5pt;background:#fff;font:600 7pt/1 Figtree,sans-serif;letter-spacing:.14em;color:var(--muted);direction:ltr}`;
}

export function renderGuideHtml(content: GuideContent, options: GuideHtmlOptions = {}): string {
  const base = options.fontBase ?? "fonts/";
  const footer = `${BRAND_NAME} · Grammar guide${options.draft === false ? "" : " · draft for review"}`;
  const callout = content.callout
    ? `<aside class="card callout">${inline(content.callout)}</aside>`
    : "";
  const arabic = content.arabic_note
    ? `<aside class="ar" dir="rtl" lang="ar"><span class="tag">AR</span>${runsHtml(parseMarkup(content.arabic_note), true)}</aside>`
    : "";
  return `<!doctype html>
<html lang="en" dir="ltr"><head><meta charset="utf-8"><title>${escapeHtml(content.title)}</title><style>${css(base, escapeCssString(footer))}</style></head><body>
<header class="head"><h1>${keepTogether(escapeHtml(content.title))}</h1><div class="brand" role="img" aria-label="${BRAND_NAME}">${markSvg}<span aria-hidden="true">UZYR${wordmarkA}</span></div></header>
<p class="intro">${inline(content.intro)}</p>
${content.sections.map(sectionHtml).join("\n")}
${callout}
${arabic}
</body></html>`;
}

function escapeCssString(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[\r\n]/g, " ");
}
