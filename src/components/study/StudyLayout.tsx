import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { BookOpen, SlidersHorizontal } from "lucide-react";
import { KitaBrand } from "@/components/brand/KitaBrand";

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

const TONES: Record<RailTone, { soft: string; dot: string; ink: string }> = {
  apricot: { soft: "#fbe3c8", dot: "#f0a95c", ink: "#7a4b16" },
  sky: { soft: "#d6e8f6", dot: "#6aa9d8", ink: "#1f4c6d" },
  lilac: { soft: "#e4dcf3", dot: "#9b83d1", ink: "#4a3877" },
  clay: { soft: "#f6ddd5", dot: "#d1795e", ink: "#7d3421" },
  mint: { soft: "#d8ecdd", dot: "#6ab887", ink: "#215237" },
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
    <div className="min-h-screen bg-[#fbf5e9] text-[#23201d]">
      <header className="border-b border-black/5">
        <div className="mx-auto flex max-w-[96rem] flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:gap-6 md:px-8 md:py-5">
          <Link to="/" className="shrink-0">
            <KitaBrand size={38} />
          </Link>

          <div data-tour="mode-switch" className="grid flex-1 gap-3 sm:grid-cols-2 md:max-w-[46rem]">
            {MODES.map((m) => {
              const on = mode === m.key;
              const Icon = m.icon;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMode(m.key)}
                  aria-pressed={on}
                  className={`rita-tile flex min-h-16 items-center gap-3 rounded-2xl px-5 py-3 text-left ${
                    on
                      ? "rita-pill shadow-[0_10px_24px_-14px_rgba(60,120,20,0.9)]"
                      : "border border-black/10 bg-white text-[#23201d]"
                  }`}
                >
                  <Icon size={20} className="shrink-0 opacity-80" />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-extrabold leading-tight">
                      {m.label}
                    </span>
                    <span
                      className={`block truncate text-[12.5px] font-semibold ${
                        on ? "opacity-80" : "text-[#a29a8d]"
                      }`}
                    >
                      {m.hint}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[96rem] gap-6 px-4 py-6 md:px-8 md:py-8 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside data-tour="study-rail" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {rail.map((item) => (
            <RailTile key={item.label} item={item} />
          ))}
        </aside>

        <main className="min-w-0">
          {board ? (
            <div className="min-h-[82vh] rounded-[28px] bg-white p-5 md:p-8">{children}</div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

function RailTile({ item }: { item: RailItem }) {
  const tone = TONES[item.tone ?? (item.danger ? "clay" : "apricot")];
  const inner = (
    <>
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
        style={{ background: tone.soft, color: tone.ink }}
      >
        {item.icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-extrabold leading-tight">{item.label}</span>
        {item.hint && (
          <span className="block truncate text-[12.5px] font-semibold text-[#a29a8d]">{item.hint}</span>
        )}
      </span>
    </>
  );

  const cls = `rita-tile flex min-h-[5.25rem] w-full items-center gap-3.5 rounded-3xl border border-black/[0.06] bg-white px-5 py-4 text-left ${
    item.disabled ? "opacity-45" : ""
  }`;

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
export function StudyHeading({ eyebrow, title, aside }: { eyebrow: string; title: string; aside?: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b3aa9c]">{eyebrow}</p>
        <h1
          className="mt-2 font-display font-black leading-[1.05] tracking-tight"
          style={{ fontSize: "clamp(2rem, 4.4vw, 3.25rem)" }}
        >
          {title}
        </h1>
      </div>
      {aside}
    </div>
  );
}
