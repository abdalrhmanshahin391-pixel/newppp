// Small pieces the library admin tabs share: field styles, icon buttons, the colour and icon
// picker, status badges and the "run a task, refresh, say how it went" helper type.
import type { ReactNode } from "react";
import { CATEGORY_ICON } from "@/components/books/BookObject";
import {
  CATEGORY_COLORS,
  CATEGORY_COLOR_KEYS,
  CATEGORY_ICONS,
  type BookStatus,
  type CategoryColor,
  type CategoryIcon,
} from "@/lib/books";

export const field =
  "w-full rounded-lg border-[1.5px] border-[var(--pp-ink)] bg-white px-3 py-2 text-[16px] outline-none focus-visible:border-[var(--pp-accent)] disabled:opacity-50";
export const label = "grid gap-1 text-[14px] font-semibold";
export const sectionTitle = "text-[20px] font-semibold";
export const muted = "text-[14px] text-[var(--pp-muted)]";

export type Run = (key: string, task: () => Promise<unknown>, done?: string) => Promise<boolean>;

export const STATUS_WORDS: Record<BookStatus, string> = {
  draft: "مسودة",
  published: "منشور",
  archived: "مؤرشف",
};

const STATUS_TONE: Record<BookStatus, string> = {
  draft: "bg-[var(--pp-grey)] text-[var(--pp-muted)]",
  published: "bg-[#e6f4ea] text-[#1d6b3a]",
  archived: "bg-[#efe9fd] text-[#4c1d95]",
};

export function Badge({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span className={`rounded-md px-2 py-0.5 text-[12px] font-semibold ${tone}`}>{children}</span>
  );
}

export function StatusBadge({ status }: { status: BookStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_WORDS[status]}</Badge>;
}

export const WARN_TONE = "bg-[#fbe9ed] text-[#8c1a31]";
export const GOLD_TONE = "bg-[#fff6df] text-[#8a5200]";
export const GREY_TONE = "bg-[var(--pp-grey)] text-[var(--pp-muted)]";

export function IconButton({
  label: text,
  onClick,
  disabled,
  danger,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={text}
      title={text}
      className={`grid h-11 w-11 place-items-center rounded-lg border border-[var(--pp-line)] transition-colors hover:bg-[var(--pp-grey)] disabled:opacity-40 ${danger ? "text-[#b3213f]" : active ? "text-[#b8860b]" : ""}`}
    >
      {children}
    </button>
  );
}

export function Notice({
  tone = "warn",
  children,
}: {
  tone?: "warn" | "info";
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border-[1.5px] p-4 text-[15px] font-semibold ${
        tone === "warn"
          ? "border-[#f5b942] bg-[#fff8e8] text-[#8a5200]"
          : "border-[var(--pp-line)] bg-[var(--pp-grey)] text-[var(--pp-ink)]"
      }`}
    >
      {children}
    </div>
  );
}

/** A row of options where every choice stays visible (arrow keys move the choice). */
export function Choice<T extends string>({
  value,
  options,
  onChange,
  name,
  disabled,
}: {
  value: T;
  options: [T, string][];
  onChange: (next: T) => void;
  name: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={name}>
      {options.map(([key, text]) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          disabled={disabled}
          onClick={() => onChange(key)}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
            event.preventDefault();
            const index = options.findIndex(([k]) => k === value);
            const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
            const step = (event.key === "ArrowRight") !== rtl ? 1 : -1;
            const next = options[(index + step + options.length) % options.length][0];
            onChange(next);
            const group = event.currentTarget.parentElement;
            const buttons = group?.querySelectorAll<HTMLButtonElement>("[role=radio]");
            buttons?.[options.findIndex(([k]) => k === next)]?.focus();
          }}
          tabIndex={value === key ? 0 : -1}
          className={`min-h-11 rounded-lg border-[1.5px] px-3 text-[14px] font-semibold transition-colors disabled:opacity-50 ${
            value === key
              ? "border-[var(--pp-accent)] bg-[var(--pp-accent-soft)] text-[var(--pp-accent-text)]"
              : "border-[var(--pp-line)] bg-white hover:border-[var(--pp-ink)]"
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export function ColorAndIcon({
  value,
  onChange,
}: {
  value: { color: CategoryColor; icon: CategoryIcon };
  onChange: (next: { color: CategoryColor; icon: CategoryIcon }) => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="اللون">
        {CATEGORY_COLOR_KEYS.map((color) => (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={value.color === color}
            aria-label={color}
            onClick={() => onChange({ ...value, color })}
            className="grid h-10 w-10 place-items-center rounded-full"
            style={{
              background: CATEGORY_COLORS[color].soft,
              boxShadow:
                value.color === color
                  ? `0 0 0 2px #fff, 0 0 0 4px ${CATEGORY_COLORS[color].c}`
                  : undefined,
            }}
          >
            <span
              className="h-4 w-4 rounded-full"
              style={{ background: CATEGORY_COLORS[color].c }}
            />
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="الأيقونة">
        {CATEGORY_ICONS.map((icon) => {
          const Icon = CATEGORY_ICON[icon];
          return (
            <button
              key={icon}
              type="button"
              role="radio"
              aria-checked={value.icon === icon}
              aria-label={icon}
              onClick={() => onChange({ ...value, icon })}
              className="grid h-11 w-11 place-items-center rounded-xl border-[1.5px]"
              style={{
                borderColor:
                  value.icon === icon ? CATEGORY_COLORS[value.color].c : "var(--pp-line)",
                color: CATEGORY_COLORS[value.color].c,
                background: value.icon === icon ? CATEGORY_COLORS[value.color].soft : "#fff",
              }}
            >
              <Icon size={18} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** "from … until …" in the admin's words, or "always". */
export function periodText(from: string | null, until: string | null): string {
  const f = (iso: string) =>
    new Date(iso).toLocaleString("ar-u-nu-latn", { dateStyle: "medium", timeStyle: "short" });
  if (!from && !until) return "بدون مدة (دايماً)";
  if (from && until) return `من ${f(from)} لـ ${f(until)}`;
  if (from) return `من ${f(from)}`;
  return `لحد ${f(until!)}`;
}
