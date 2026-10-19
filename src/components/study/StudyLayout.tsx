import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { BookOpen, SlidersHorizontal } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";

export type RailTone = "apricot" | "sky" | "lilac" | "clay" | "mint";

export type RailItem = {
  label: string;
  hint?: string;
  icon?: ReactNode;
  onClick?: () => void;
  to?: string;
  danger?: boolean;
  disabled?: boolean;
  tone?: RailTone;
};

const MODES = [
  {
    key: "study",
    label: "Study view",
    short: "Study",
    hint: "Go through your cards",
    icon: BookOpen,
  },
  {
    key: "edit",
    label: "Edit and adjust study view",
    short: "Edit",
    hint: "Build and rearrange your subjects",
    icon: SlidersHorizontal,
  },
] as const;

/**
 * The Rita study workspace frame: two large mode buttons on top, a column of
 * big action tiles on the left and one plain white board in the middle.
 */
export function StudyLayout({
  rail,
  children,
  board = true,
  framed = true,
  activeMode,
  onModeChange,
}: {
  rail: RailItem[];
  children?: ReactNode;
  board?: boolean;
  /** Ink frame around the board. Off for screens built from grey panels and rows. */
  framed?: boolean;
  activeMode?: "study" | "edit";
  onModeChange?: (mode: "study" | "edit") => void;
}) {
  const [internalMode, setInternalMode] = useState<"study" | "edit">("study");
  const mode = activeMode ?? internalMode;
  const setMode = (next: "study" | "edit") => {
    setInternalMode(next);
    onModeChange?.(next);
  };

  return (
    <div className="min-h-screen bg-white text-[var(--pp-ink)]">
      <SiteHeader />

      <div className="mx-auto max-w-[96rem] px-4 pt-6 md:px-8 md:pt-8">
        <div data-tour="mode-switch" className="grid grid-cols-2 gap-2 sm:gap-3 md:max-w-[46rem]">
          {MODES.map((m) => {
            const on = mode === m.key;
            const Icon = m.icon;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                aria-pressed={on}
                className="rh-modetab"
              >
                <Icon size={22} strokeWidth={2} className="shrink-0" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-[16px] font-bold leading-tight">
                    <span className="sm:hidden">{m.short}</span>
                    <span className="hidden sm:inline">{m.label}</span>
                  </span>
                  <span className="rh-hint block truncate text-[13.5px] font-medium text-[var(--pp-muted)]">
                    {m.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-auto grid max-w-[96rem] gap-6 px-4 pb-28 pt-6 md:px-8 md:pb-24 md:pt-8 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside
          data-tour="study-rail"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:-mx-8 md:px-8 lg:mx-0 lg:grid lg:content-start lg:gap-3 lg:overflow-visible lg:px-0 lg:pb-0"
        >
          {rail.map((item) => (
            <RailTile key={item.label} item={item} />
          ))}
        </aside>

        <main className="min-w-0">
          {board ? (
            <div
              className={
                framed ? "min-h-[82vh] rounded-[24px] p-5 md:p-8" : "min-h-[82vh] bg-white md:p-1"
              }
              style={
                framed ? { border: "2px solid var(--pp-ink)", background: "#ffffff" } : undefined
              }
            >
              {children}
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

function RailTile({ item }: { item: RailItem }) {
  const inner = (
    <>
      <span className="shrink-0" aria-hidden="true">
        {item.icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[16px] font-bold leading-tight">{item.label}</span>
        {item.hint && (
          <span className="rh-hint block truncate text-[13.5px] font-medium text-[var(--pp-muted)]">
            {item.hint}
          </span>
        )}
      </span>
    </>
  );

  const cls = `rh-rail ${item.danger ? "rh-rail-danger" : ""} ${item.disabled ? "opacity-45" : ""}`;

  if (item.to) {
    return (
      <Link to={item.to} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={item.onClick} className={cls} aria-disabled={item.disabled}>
      {inner}
    </button>
  );
}

/** Big, airy page heading used on workspace sub-screens. */
export function StudyHeading({
  eyebrow,
  title,
  aside,
}: {
  eyebrow: string;
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
      <div className="min-w-0">
        <h1
          className="font-display font-bold leading-[1.05] tracking-tight"
          style={{ fontSize: "clamp(2rem, 4.4vw, 3.25rem)" }}
        >
          {title}
        </h1>
      </div>
      {aside}
    </div>
  );
}
