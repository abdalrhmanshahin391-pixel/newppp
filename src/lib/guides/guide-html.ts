// Turns a guide (data) into one HTML document for printing: page size, fonts, header, tables with
// coloured pill headings, the cards and the Arabic note. Pure and string-based, so it runs on the
// server and in node tests. Every piece of text is escaped here; a guide cannot carry HTML.
// The look follows docs in DESIGN.md ("Guides"): ink titles, the site blue for headings and the
// taught term, soft tinted cards, and the Uzyra mark with the name at the top right.
import { BRAND_NAME, UZYRA_MARK_PATHS, UZYRA_MARK_VIEWBOX } from "../brand.ts";
import { sectionId } from "./guide-blocks.ts";
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
  /**
   * Names every piece of text (data-block / data-seg, see guide-blocks.ts) so a learner's selection
   * maps to the guide. Off for printing: the PDF is the same with or without it.
   */
  anchors?: boolean;
  /**
   * For the study page: the guide as a white sheet on a grey page, a strict content policy and no
   * script. Printing ignores it.
   */
  screen?: boolean;
};

/** Attributes naming a piece of the guide; nothing unless anchors are on and the piece has text. */
type Namer = (block: string | null, seg: string | null, markup?: string) => string;

function namer(on: boolean): Namer {
  if (!on) return () => "";
  return (block, seg, markup) => {
    const parts: string[] = [];
    if (block) parts.push(` data-block="${block}"`);
    if (seg && (markup === undefined || plainText(markup).trim())) parts.push(` data-seg="${seg}"`);
    return parts.join("");
  };
}

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

function tableHtml(section: Extract<Section, { kind: "table" }>, s: string, name: Namer): string {
  const columns = section.columns.map((column, index) => [
    column.label,
    ...section.rows.map((row) => row[index] ?? ""),
  ]);
  const cols = widths(columns)
    .map((width) => `<col style="width:${width}">`)
    .join("");
  const head = section.columns
    .map(
      (column, c) =>
        `<th><span class="pill ${tone(column.tone)}"${name(null, `${s}.hd.c${c + 1}`, column.label)}>${escapeHtml(column.label)}</span></th>`,
    )
    .join("");
  const body = section.rows
    .map(
      (row, r) =>
        `<tr${name(`${s}.r${r + 1}`, null)}>${row
          .map((value, index) =>
            section.row_headers && index === 0
              ? `<td class="rowlab"${name(null, `${s}.r${r + 1}.c${index + 1}`, value)}>${inline(value)}</td>`
              : `<td${name(null, `${s}.r${r + 1}.c${index + 1}`, value)}>${inline(value)}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");
  return `<section class="block"${sectionAttr(s, name)}><h2 class="sec"${name(`${s}.h`, `${s}.h`, section.heading)}>${escapeHtml(section.heading)}</h2><table class="grid"><colgroup>${cols}</colgroup><thead><tr${name(`${s}.hd`, null)}>${head}</tr></thead><tbody>${body}</tbody></table></section>`;
}

function matrixHtml(section: Extract<Section, { kind: "matrix" }>, s: string, name: Namer): string {
  const head = `<th></th>${section.columns
    .map(
      (column, c) =>
        `<th><span class="pill tone-blue solid"${name(null, `${s}.hd.c${c + 1}`, column)}>${escapeHtml(column)}</span></th>`,
    )
    .join("")}`;
  const body = section.rows
    .map(
      (row, r) =>
        `<tr${name(`${s}.r${r + 1}`, null)}><th class="rowhead"><span class="pill tone-green solid tall"${name(null, `${s}.r${r + 1}.l`, row.label)}>${escapeHtml(row.label)}</span></th>${row.cells
          .map(
            (value, c) =>
              `<td${name(null, `${s}.r${r + 1}.c${c + 1}`, value)}>${inline(value)}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");
  return `<section class="block"${sectionAttr(s, name)}><h2 class="sec"${name(`${s}.h`, `${s}.h`, section.heading)}>${escapeHtml(section.heading)}</h2><table class="grid matrix"><thead><tr${name(`${s}.hd`, null)}>${head}</tr></thead><tbody>${body}</tbody></table></section>`;
}

function usageHtml(section: Extract<Section, { kind: "usage" }>, s: string, name: Namer): string {
  const items = section.items
    .map((item, n) => {
      const id = `${s}.i${n + 1}`;
      const labelSeg = name(null, `${id}.l`, item.label);
      const label = !item.label
        ? ""
        : labelSeg
          ? `<span${labelSeg}>${escapeHtml(item.label)}</span>: `
          : `${escapeHtml(item.label)}: `;
      return `<p${name(id, null)}>${label}<span class="ex"${name(null, `${id}.x`, item.example)}>${inline(item.example)}</span></p>`;
    })
    .join("");
  return `<section class="card usage block"${sectionAttr(s, name)}><h3${name(`${s}.h`, `${s}.h`, section.heading)}>${escapeHtml(section.heading)}</h3>${items}</section>`;
}

function rulesHtml(section: Extract<Section, { kind: "rules" }>, s: string, name: Namer): string {
  const items = section.items
    .map((item, n) => {
      const id = `${s}.i${n + 1}`;
      return `<li${name(id, null)}><div class="rule"${name(null, `${id}.r`, item.rule)}>${inline(item.rule)}</div>${item.examples
        .map(
          (example, m) =>
            `<div class="ex"${name(null, `${id}.e${m + 1}`, example)}>${inline(example)}</div>`,
        )
        .join("")}</li>`;
    })
    .join("");
  return `<section class="block"${sectionAttr(s, name)}><h2 class="sec"${name(`${s}.h`, `${s}.h`, section.heading)}>${escapeHtml(section.heading)}</h2><ul class="rules">${items}</ul></section>`;
}

function sectionAttr(s: string, name: Namer): string {
  return name(s, null) ? ` data-section="${s}" id="${s}"` : "";
}

function sectionHtml(section: Section, index: number, name: Namer): string {
  const s = sectionId(index);
  switch (section.kind) {
    case "table":
      return tableHtml(section, s, name);
    case "matrix":
      return matrixHtml(section, s, name);
    case "usage":
      return usageHtml(section, s, name);
    case "rules":
      return rulesHtml(section, s, name);
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
  const name = namer(Boolean(options.anchors));
  const footer = `${BRAND_NAME} · Grammar guide${options.draft === false ? "" : " · draft for review"}`;
  const callout = content.callout
    ? `<aside class="card callout"${name("c", "c", content.callout)}>${inline(content.callout)}</aside>`
    : "";
  const arabicRuns = runsHtml(parseMarkup(content.arabic_note), true);
  const arabicSeg = name(null, "a", content.arabic_note);
  const arabic = content.arabic_note
    ? `<aside class="ar" dir="rtl" lang="ar"${name("a", null)}><span class="tag">AR</span>${arabicSeg ? `<span${arabicSeg}>${arabicRuns}</span>` : arabicRuns}</aside>`
    : "";
  const policy = options.screen
    ? `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src ${escapeHtml(fontOrigin(base))}; img-src data:">`
    : "";
  const styles = css(base, escapeCssString(footer)) + (options.screen ? SCREEN_CSS : "");
  const body = `<header class="head"><h1${name("t", "t", content.title)}>${keepTogether(escapeHtml(content.title))}</h1><div class="brand" role="img" aria-label="${BRAND_NAME}">${markSvg}<span aria-hidden="true">UZYR${wordmarkA}</span></div></header>
<p class="intro"${name("i", "i", content.intro)}>${inline(content.intro)}</p>
${content.sections.map((section, index) => sectionHtml(section, index, name)).join("\n")}
${callout}
${arabic}`;
  return `<!doctype html>
<html lang="en" dir="ltr"><head><meta charset="utf-8">${policy}<title>${escapeHtml(content.title)}</title><style>${styles}</style></head><body>
${options.screen ? `<main class="sheet">${body}</main>` : body}
</body></html>`;
}

/** Fonts load from the site itself on screen ('self' does not work inside an srcdoc frame). */
function fontOrigin(base: string): string {
  const match = /^(https?:\/\/[^/]+)/i.exec(base);
  return match ? match[1] : "'self'";
}

/**
 * The study page shows the guide as one white sheet on a grey page. @page only splits pages when
 * printing, so on screen the sheet is one long page and the learner moves by section.
 */
const SCREEN_CSS = `
@media screen{
html{background:#f4f4f8}
body{padding:16px 12px 40px}
.sheet{width:${PAGE_WIDTH_PT}pt;max-width:none;margin:0 auto;padding:34pt 34pt 40pt;background:#fff;border-radius:6pt;box-shadow:0 1px 2px rgba(18,17,23,.06),0 8px 24px rgba(18,17,23,.08)}
section.block{scroll-margin-top:16px}
::selection{background:#cfe0ff}
.st-flash{animation:st-flash 1.2s ease-out}
@keyframes st-flash{0%{background:#fff3b0}100%{background:transparent}}
}
@media screen and (prefers-reduced-motion:reduce){.st-flash{animation:none;outline:2px solid #2b6df0}}`;

function escapeCssString(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[\r\n]/g, " ");
}
