import type { SummaryBlock } from "@/lib/summaries.functions";
import { Sparkles, AlertTriangle, Lightbulb, StickyNote, Brain } from "lucide-react";

/**
 * Light Rita palette for the summary sheet. Every accent is a pale tint that
 * always carries near-black ink on top, so nothing collapses into itself.
 */
const INK = "#121117";
const BODY = "#2a2933";

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
  indigo: { head: "#f4f4f8", headInk: "#1d5fd0", zebra: "#ffffff" },
  pink: { head: "#f4f4f8", headInk: "#961a34", zebra: "#ffffff" },
  emerald: { head: "#d2ecd4", headInk: "#1d4f20", zebra: "#ffffff" },
  amber: { head: "#ffe6a3", headInk: "#8a5200", zebra: "#ffffff" },
};

const CALLOUT_TONES: Record<
  string,
  { bg: string; border: string; ink: string; label: string; Icon: any; chip: string }
> = {
  highYield: {
    bg: "#f4f4f8",
    border: "#f5b3c0",
    ink: "#961a34",
    label: "HIGH-YIELD",
    Icon: Sparkles,
    chip: "#f4f4f8",
  },
  trap: {
    bg: "#ffe6a3",
    border: "#f5b942",
    ink: "#8a5200",
    label: "COMMON TRAP",
    Icon: AlertTriangle,
    chip: "#f4f4f8",
  },
  pearl: {
    bg: "#d2ecd4",
    border: "#7bc280",
    ink: "#1d4f20",
    label: "CLINICAL PEARL",
    Icon: Lightbulb,
    chip: "#f4f4f8",
  },
  note: {
    bg: "#f4f4f8",
    border: "#cddcfb",
    ink: "#1a4ba8",
    label: "NOTE",
    Icon: StickyNote,
    chip: "#f4f4f8",
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
              style={{ background: "#3a9042" }}
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
        style={{ background: "#f4f4f8", borderColor: "#cddcfb" }}
      >
        <p
          className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.3em]"
          style={{ color: "#1a4ba8" }}
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
        style={{ background: "#ffffff", borderColor: "#cddcfb" }}
      >
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
          style={{ background: "#f4f4f8", color: "#1d5fd0" }}
        >
          <Brain size={18} />
        </div>
        <div className="min-w-0">
          <p
            className="text-[10px] font-extrabold tracking-[0.3em]"
            style={{ color: "#1d5fd0" }}
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
      <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "#ffd266" }}>
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
                    style={{ color: BODY, borderColor: "#ffe6a3" }}
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
