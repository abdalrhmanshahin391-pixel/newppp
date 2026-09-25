import type { SummaryBlock } from "@/lib/summaries.functions";
import { Sparkles, AlertTriangle, Lightbulb, StickyNote, Brain } from "lucide-react";

/**
 * Light Rita palette for the summary sheet. Every accent is a pale tint that
 * always carries near-black ink on top, so nothing collapses into itself.
 */
const INK = "#23201d";
const BODY = "#3b3730";

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return (
        <strong key={i} className="font-extrabold" style={{ color: INK }}>
          {p.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

const TABLE_TONES: Record<string, { head: string; headInk: string; zebra: string }> = {
  indigo: { head: "#e4dcf3", headInk: "#4a3877", zebra: "#faf7ff" },
  pink: { head: "#f7d9de", headInk: "#75283a", zebra: "#fff8f9" },
  emerald: { head: "#d8ecdd", headInk: "#215237", zebra: "#f7fcf8" },
  amber: { head: "#fbe3c8", headInk: "#7a4b16", zebra: "#fffaf3" },
};

const CALLOUT_TONES: Record<
  string,
  { bg: string; border: string; ink: string; label: string; Icon: any; chip: string }
> = {
  highYield: {
    bg: "#f7d9de",
    border: "#eab6c0",
    ink: "#75283a",
    label: "HIGH-YIELD",
    Icon: Sparkles,
    chip: "#fdeff2",
  },
  trap: {
    bg: "#fbe3c8",
    border: "#eec59a",
    ink: "#7a4b16",
    label: "COMMON TRAP",
    Icon: AlertTriangle,
    chip: "#fef6ec",
  },
  pearl: {
    bg: "#d8ecdd",
    border: "#a9d5b8",
    ink: "#215237",
    label: "CLINICAL PEARL",
    Icon: Lightbulb,
    chip: "#f0f9f3",
  },
  note: {
    bg: "#d6e8f6",
    border: "#a9cbe5",
    ink: "#1f4c6d",
    label: "NOTE",
    Icon: StickyNote,
    chip: "#eff7fd",
  },
};

export function BlockRenderer({ block }: { block: SummaryBlock }) {
  if (block.type === "paragraph") {
    return (
      <p className="text-[15px] leading-relaxed" style={{ color: BODY }}>
        {renderInline(block.text)}
      </p>
    );
  }

  if (block.type === "bullets") {
    return (
      <ul className="space-y-2">
        {block.items.map((it, i) => (
          <li key={i} className="flex gap-3 text-[15px] leading-relaxed" style={{ color: BODY }}>
            <span
              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: "#6ab887" }}
            />
            <span>{renderInline(it)}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (block.type === "usage") {
    return (
      <div
        className="rounded-2xl border p-5"
        style={{ background: "#eff7fd", borderColor: "#c5ddef" }}
      >
        <p
          className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.3em]"
          style={{ color: "#1f4c6d" }}
        >
          {block.title || "Usage"}
        </p>
        <ul className="space-y-1.5">
          {block.items.map((it, i) => (
            <li key={i} className="text-[15px] leading-relaxed" style={{ color: BODY }}>
              {renderInline(it)}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (block.type === "callout") {
    const c = CALLOUT_TONES[block.tone] || CALLOUT_TONES.note!;
    const Icon = c.Icon;
    return (
      <div
        className="flex gap-4 rounded-2xl border p-5"
        style={{ background: c.chip, borderColor: c.border }}
      >
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
          style={{ background: c.bg, color: c.ink }}
        >
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <p
            className="text-[10px] font-extrabold tracking-[0.3em]"
            style={{ color: c.ink }}
          >
            {c.label}
          </p>
          {block.title && (
            <p className="mt-1 font-extrabold" style={{ color: INK }}>
              {block.title}
            </p>
          )}
          <p className="mt-1 text-[15px] leading-relaxed" style={{ color: BODY }}>
            {renderInline(block.text)}
          </p>
        </div>
      </div>
    );
  }

  if (block.type === "mnemonic") {
    return (
      <div
        className="flex gap-4 rounded-2xl border p-5"
        style={{ background: "#f5f1fd", borderColor: "#d3c7ee" }}
      >
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
          style={{ background: "#e4dcf3", color: "#4a3877" }}
        >
          <Brain size={18} />
        </div>
        <div className="min-w-0">
          <p
            className="text-[10px] font-extrabold tracking-[0.3em]"
            style={{ color: "#4a3877" }}
          >
            MNEMONIC
          </p>
          <p className="mt-1 text-xl font-black tracking-wide" style={{ color: INK }}>
            {block.title}
          </p>
          <p className="mt-1 text-[15px] leading-relaxed" style={{ color: BODY }}>
            {renderInline(block.text)}
          </p>
        </div>
      </div>
    );
  }

  if (block.type === "table") {
    const tone = TABLE_TONES[block.tone || "indigo"] || TABLE_TONES.indigo!;
    return (
      <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "#e6e0d4" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: tone.head, color: tone.headInk }}>
              {block.headers.map((h, i) => (
                <th key={i} className="px-4 py-3 text-left font-extrabold tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, r) => (
              <tr key={r} style={{ background: r % 2 ? tone.zebra : "#ffffff" }}>
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className="border-t px-4 py-3"
                    style={{ color: BODY, borderColor: "#eee8dc" }}
                  >
                    {renderInline(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return null;
}
