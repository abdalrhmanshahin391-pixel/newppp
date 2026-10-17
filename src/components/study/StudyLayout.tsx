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
  { key: "study", label: "Study view", hint: "Go through your cards", icon: BookOpen },
  {
    key: "edit",
    label: "Edit and adjust study view",
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
  activeMode,
  onModeChange,
}: {
  rail: RailItem[];
  children?: ReactNode;
  board?: boolean;
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
        <div data-tour="mode-switch" className="grid gap-3 sm:grid-cols-2 md:max-w-[46rem]">
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
                    {m.label}
                  </span>
                  <span className="block truncate text-[13.5px] font-medium text-[var(--pp-muted)]">
                    {m.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-auto grid max-w-[96rem] gap-6 px-4 py-6 md:px-8 md:py-8 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside
          data-tour="study-rail"
          className="grid content-start gap-3 sm:grid-cols-2 lg:grid-cols-1"
        >
          {rail.map((item) => (
            <RailTile key={item.label} item={item} />
          ))}
        </aside>

        <main className="min-w-0">
          {board ? (
            <div
              className="min-h-[82vh] rounded-[24px] p-5 md:p-8"
              style={{ border: "2px solid var(--pp-ink)", background: "#ffffff" }}
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
          <span className="block truncate text-[13.5px] font-medium text-[var(--pp-muted)]">
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
