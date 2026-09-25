import type { ReactNode } from "react";

/**
 * The shared "Start a session" panel, taken from the Archive questions page:
 * what you picked, a couple of facts, then the mode buttons. Every study mode
 * passes its own buttons so it keeps its personality.
 */
export type LaunchAction = {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "solid" | "outline" | "dark";
};

export function LaunchPanel({
  accent,
  eyebrow = "Start a session",
  stat,
  statLabel,
  rows = [],
  children,
  actions,
  footnote,
}: {
  accent: string;
  eyebrow?: string;
  stat?: string | number;
  statLabel?: string;
  rows?: { label: string; value: string }[];
  children?: ReactNode;
  actions: LaunchAction[];
  footnote?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-lg shadow-foreground/5">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b3aa9c]">{eyebrow}</p>

      {stat !== undefined && (
        <p className="mt-3 text-[34px] font-black leading-none text-foreground">
          {stat}
          {statLabel && (
            <span className="ml-1.5 text-[13px] font-bold text-[#a29a8d]">{statLabel}</span>
          )}
        </p>
      )}

      {rows.length > 0 && (
        <dl className="mt-3 space-y-1.5">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3">
              <dt className="text-[12.5px] font-semibold text-[#a29a8d]">{r.label}</dt>
              <dd className="text-[12.5px] font-extrabold text-[#23201d]">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {children && <div className="mt-4 border-t border-black/[0.06] pt-4">{children}</div>}

      <div className="mt-5 flex flex-col gap-2.5">
        {actions.map((a) => {
          const base =
            "inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-extrabold transition active:scale-[0.99] disabled:opacity-40";
          if (a.tone === "dark")
            return (
              <button
                key={a.label}
                disabled={a.disabled}
                onClick={a.onClick}
                className={`${base} bg-foreground text-background hover:brightness-125`}
              >
                {a.icon}
                {a.label}
              </button>
            );
          if (a.tone === "outline")
            return (
              <button
                key={a.label}
                disabled={a.disabled}
                onClick={a.onClick}
                className={`${base} border border-border bg-card text-foreground hover:bg-muted`}
              >
                {a.icon}
                {a.label}
              </button>
            );
          return (
            <button
              key={a.label}
              disabled={a.disabled}
              onClick={a.onClick}
              className={`${base} text-primary-foreground hover:brightness-110`}
              style={{ background: accent, boxShadow: `0 14px 30px -18px ${accent}` }}
            >
              {a.icon}
              {a.label}
            </button>
          );
        })}
      </div>

      {footnote && (
        <p className="mt-3 text-center text-[12.5px] font-bold text-[#8a8175]">{footnote}</p>
      )}
    </div>
  );
}

/** Header band used above a picker: title, one line of copy and stat chips. */
export function WorkspaceHeader({
  eyebrow,
  title,
  description,
  stats = [],
  back,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  stats?: { label: string; value: string | number; icon?: ReactNode }[];
  back?: ReactNode;
}) {
  return (
    <section className="rounded-[26px] border border-black/[0.07] bg-white px-5 py-6 shadow-[0_20px_50px_-40px_rgba(0,0,0,0.4)] md:px-8 md:py-8">
      {back}
      {eyebrow && (
        <p className="mt-2 text-[11px] font-black uppercase tracking-[0.2em] text-[#a89e90]">
          {eyebrow}
        </p>
      )}
      <h1 className="mt-1 font-display text-[clamp(1.7rem,3.2vw,2.4rem)] font-black leading-tight tracking-tight text-[#23201d]">
        {title}
      </h1>
      {description && (
        <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-[#4a453d]">{description}</p>
      )}
      {stats.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {stats.map((s) => (
            <span
              key={s.label}
              className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-[#fbf8f2] px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-[#6b645b]"
            >
              {s.icon}
              {s.label}
              <b className="text-[13px] tracking-normal text-[#23201d]">{s.value}</b>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
