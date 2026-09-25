import { useMemo } from "react";
import type { SummaryContent } from "@/lib/summaries.functions";
import { BlockRenderer } from "./SummaryBlocks";

type Props = {
  content: SummaryContent;
  siteName: string;
  tagline?: string;
  authorName?: string;
  createdAt?: string;
};

/** Rita sheet palette — cream paper, near-black ink, green + pastel accents. */
const PAPER = "#fffdf8";
const CREAM = "#fbf5e9";
const INK = "#23201d";
const BODY = "#4a453d";
const MUTED = "#6d675e";
const LINE = "#e9e1d2";
const GREEN = "#58a700";

/**
 * Multi-page A4-style summary in the Rita look: cream paper, dark ink and
 * pastel accents only on rules, chips and headers so text always stays legible.
 */
export function SummaryView({ content, siteName, tagline, authorName, createdAt }: Props) {
  const pages = useMemo(() => paginate(content), [content]);

  return (
    <div className="summary-doc mx-auto flex w-full max-w-[920px] flex-col gap-8 px-4 py-10">
      <CoverPage content={content} siteName={siteName} tagline={tagline} authorName={authorName} />
      <TOCPage siteName={siteName} pages={pages} />
      {pages.map((p, i) => (
        <ContentPage
          key={i}
          pageNum={i + 3}
          sections={p}
          siteName={siteName}
          title={content.title}
        />
      ))}
      <RecapPage
        content={content}
        siteName={siteName}
        authorName={authorName}
        createdAt={createdAt}
        pageNum={pages.length + 3}
      />
    </div>
  );
}

/** Page wrapper — cream paper with a hairline border and a whisper watermark. */
function Page({ children, siteName }: { children: React.ReactNode; siteName: string }) {
  return (
    <article
      className="summary-page relative overflow-hidden rounded-[28px] border shadow-[0_18px_50px_-30px_rgba(35,32,29,0.35)]"
      style={{ aspectRatio: "1 / 1.414", background: PAPER, borderColor: LINE }}
    >
      <div className="relative flex h-full w-full flex-col p-8 md:p-12">{children}</div>
    </article>
  );
}

function BrandChip({ siteName }: { siteName: string }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5"
      style={{ background: CREAM, borderColor: LINE }}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: GREEN }} />
      <span
        className="text-[10px] font-extrabold uppercase tracking-[0.25em]"
        style={{ color: BODY }}
      >
        {siteName}
      </span>
    </span>
  );
}

/* ---------- COVER ---------- */
function CoverPage({
  content,
  siteName,
  tagline,
  authorName,
}: {
  content: SummaryContent;
  siteName: string;
  tagline?: string;
  authorName?: string;
}) {
  return (
    <article
      className="summary-page relative overflow-hidden rounded-[28px] border shadow-[0_18px_50px_-30px_rgba(35,32,29,0.35)]"
      style={{ aspectRatio: "1 / 1.414", background: CREAM, borderColor: LINE }}
    >
      {/* soft pastel corners — kept far away from the text column */}
      <div
        aria-hidden
        className="absolute -right-24 -top-24 h-[320px] w-[320px] rounded-full"
        style={{ background: "#e4dcf3", opacity: 0.55 }}
      />
      <div
        aria-hidden
        className="absolute -bottom-28 -left-24 h-[340px] w-[340px] rounded-full"
        style={{ background: "#d8ecdd", opacity: 0.55 }}
      />

      <div className="relative flex h-full flex-col p-10 md:p-14">
        <div className="flex items-center justify-between">
          <BrandChip siteName={siteName} />
          <span
            className="text-[10px] font-extrabold uppercase tracking-[0.3em]"
            style={{ color: MUTED }}
          >
            Summary sheet
          </span>
        </div>

        <div className="mt-16">
          <h1
            className="font-display font-black leading-[1.05] tracking-tight"
            style={{ color: INK, fontSize: "clamp(2rem, 5.2vw, 3.4rem)" }}
          >
            {content.title}
          </h1>
          {content.subtitle && (
            <p className="mt-5 max-w-[38ch] text-lg leading-relaxed" style={{ color: BODY }}>
              {content.subtitle}
            </p>
          )}
          <div className="mt-8 h-[4px] w-32 rounded-full" style={{ background: GREEN }} />
        </div>

        <footer
          className="mt-auto flex items-end justify-between border-t pt-5 text-[11px]"
          style={{ borderColor: LINE, color: MUTED }}
        >
          <div>
            <p
              className="font-extrabold uppercase tracking-[0.25em]"
              style={{ color: INK }}
            >
              {siteName}
            </p>
            {tagline && <p className="mt-0.5">{tagline}</p>}
          </div>
          {authorName && (
            <p className="font-bold" style={{ color: BODY }}>
              By {authorName}
            </p>
          )}
        </footer>
      </div>
    </article>
  );
}

/* ---------- TOC ---------- */
function TOCPage({ siteName, pages }: { siteName: string; pages: { heading: string }[][] }) {
  const entries: { heading: string; page: number }[] = [];
  pages.forEach((p, idx) => {
    p.forEach((s) => entries.push({ heading: s.heading, page: idx + 3 }));
  });

  return (
    <Page siteName={siteName}>
      <header
        className="flex items-center justify-between border-b pb-5"
        style={{ borderColor: LINE }}
      >
        <h2
          className="font-display text-3xl font-black tracking-tight md:text-4xl"
          style={{ color: INK }}
        >
          Table of contents
        </h2>
        <BrandChip siteName={siteName} />
      </header>

      <ol className="mt-8 flex-1 space-y-3">
        {entries.map((e, i) => (
          <li key={i} className="flex items-baseline gap-3" style={{ color: BODY }}>
            <span className="w-6 text-sm font-extrabold" style={{ color: GREEN }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="font-bold" style={{ color: INK }}>
              {e.heading}
            </span>
            <span
              className="-translate-y-[4px] flex-1 border-b border-dotted"
              style={{ borderColor: "#d8cfbc" }}
            />
            <span className="text-sm font-bold" style={{ color: MUTED }}>
              {e.page}
            </span>
          </li>
        ))}
      </ol>

      <PageFooter pageNum={2} siteName={siteName} />
    </Page>
  );
}

/* ---------- CONTENT PAGE ---------- */
function ContentPage({
  pageNum,
  sections,
  siteName,
  title,
}: {
  pageNum: number;
  sections: { heading: string; kicker?: string; blocks: any[] }[];
  siteName: string;
  title: string;
}) {
  return (
    <Page siteName={siteName}>
      <header
        className="relative flex items-center justify-between border-b pb-4"
        style={{ borderColor: LINE }}
      >
        <p
          className="truncate text-[10px] font-extrabold uppercase tracking-[0.3em]"
          style={{ color: MUTED }}
        >
          {title}
        </p>
        <BrandChip siteName={siteName} />
      </header>

      <div className="relative mt-6 flex-1 space-y-8 overflow-hidden">
        {sections.map((s, i) => (
          <section key={i}>
            {s.kicker && (
              <p
                className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.3em]"
                style={{ color: GREEN }}
              >
                {s.kicker}
              </p>
            )}
            <h3
              className="mb-4 font-display text-xl font-black tracking-tight md:text-2xl"
              style={{ color: INK }}
            >
              {s.heading}
            </h3>
            <div className="space-y-4">
              {s.blocks.map((b, j) => (
                <BlockRenderer key={j} block={b} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <PageFooter pageNum={pageNum} siteName={siteName} />
    </Page>
  );
}

/* ---------- RECAP ---------- */
function RecapPage({
  content,
  siteName,
  authorName,
  createdAt,
  pageNum,
}: {
  content: SummaryContent;
  siteName: string;
  authorName?: string;
  createdAt?: string;
  pageNum: number;
}) {
  return (
    <Page siteName={siteName}>
      <header
        className="relative flex items-center justify-between border-b pb-4"
        style={{ borderColor: LINE }}
      >
        <h2
          className="font-display text-2xl font-black tracking-tight md:text-3xl"
          style={{ color: INK }}
        >
          Quick recap
        </h2>
        <BrandChip siteName={siteName} />
      </header>

      <div className="relative mt-8 flex-1">
        <ul className="space-y-4">
          {content.recap.length ? (
            content.recap.map((r, i) => (
              <li
                key={i}
                className="flex gap-4 rounded-2xl border p-4"
                style={{ background: PAPER, borderColor: LINE }}
              >
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl font-extrabold"
                  style={{ background: "#d8ecdd", color: "#215237" }}
                >
                  {i + 1}
                </span>
                <span className="text-[15px] leading-relaxed" style={{ color: BODY }}>
                  {r}
                </span>
              </li>
            ))
          ) : (
            <li className="text-sm" style={{ color: MUTED }}>
              No quick-recap items.
            </li>
          )}
        </ul>
      </div>

      <footer
        className="relative mt-8 flex items-center justify-between border-t pt-5 text-[11px]"
        style={{ borderColor: LINE, color: MUTED }}
      >
        <p>
          Compiled{createdAt ? ` on ${new Date(createdAt).toLocaleDateString()}` : ""} with{" "}
          <span className="font-extrabold uppercase tracking-[0.2em]" style={{ color: INK }}>
            {siteName}
          </span>
          {authorName ? ` · for ${authorName}` : ""}
        </p>
        <span className="font-bold">Page {pageNum}</span>
      </footer>
    </Page>
  );
}

function PageFooter({ pageNum, siteName }: { pageNum: number; siteName: string }) {
  return (
    <footer
      className="relative mt-6 flex items-center justify-between border-t pt-4 text-[10px] uppercase tracking-[0.2em]"
      style={{ borderColor: LINE, color: MUTED }}
    >
      <span className="font-bold">{siteName}</span>
      <span className="font-bold">Page {pageNum}</span>
    </footer>
  );
}

/* ---------- PAGINATION ---------- */
function paginate(content: SummaryContent): SummaryContent["sections"][] {
  const PAGE_BUDGET = 14;
  const pages: SummaryContent["sections"][] = [];
  let current: SummaryContent["sections"] = [];
  let used = 0;

  for (const s of content.sections) {
    let w = 2;
    for (const b of s.blocks) {
      if (b.type === "paragraph") w += 2;
      else if (b.type === "bullets") w += Math.max(2, b.items.length * 0.7);
      else if (b.type === "callout") w += 3;
      else if (b.type === "mnemonic") w += 3;
      else if (b.type === "usage") w += Math.max(2, b.items.length * 0.7);
      else if (b.type === "table") w += 4 + b.rows.length * 0.9;
    }
    if (used + w > PAGE_BUDGET && current.length) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(s);
    used += w;
  }
  if (current.length) pages.push(current);
  return pages.length ? pages : [content.sections];
}
