import type { ReactNode } from "react";

export type SegmentedOption<T extends string> = {
  key: T;
  label: string;
  icon?: ReactNode;
};

/**
 * Modern segmented control used across the German labs. Purely local state —
 * the parent updates instantly, nothing waits on the network.
 */
export function Segmented<T extends string>({
  label,
  value,
  options,
  accent,
  onChange,
  columns = 1,
}: {
  label: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  accent: string;
  onChange: (next: T) => void;
  columns?: 1 | 2 | 3;
}) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b3aa9c]">{label}</p>
      <div
        className={`mt-2 grid gap-1 rounded-2xl bg-[#f6f1e8] p-1 ${
          columns === 3 ? "grid-cols-3" : columns === 2 ? "grid-cols-2" : "grid-cols-1"
        }`}
      >
        {options.map((o) => {
          const on = o.key === value;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => onChange(o.key)}
              aria-pressed={on}
              className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[13px] font-extrabold transition-[background,color,box-shadow] duration-150 ${
                on ? "bg-white shadow-[0_6px_16px_-10px_rgba(0,0,0,0.5)]" : "text-[#8a8175] hover:text-[#5a4a2e]"
              }`}
              style={on ? { color: accent } : undefined}
            >
              {o.icon}
              <span className="truncate">{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Soft on/off pill (e.g. "Flagged only"). */
export function ToggleChip({
  on,
  icon,
  children,
  onClick,
  tone = "#d94a4a",
}: {
  on: boolean;
  icon?: ReactNode;
  children: ReactNode;
  onClick: () => void;
  tone?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="mt-2 flex w-full items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-left text-[13px] font-extrabold transition-colors duration-150"
      style={{
        borderColor: on ? tone : "rgba(0,0,0,0.07)",
        background: on ? tone : "#fff",
        color: on ? "#fff" : "#8a8175",
      }}
    >
      {icon}
      {children}
    </button>
  );
}
