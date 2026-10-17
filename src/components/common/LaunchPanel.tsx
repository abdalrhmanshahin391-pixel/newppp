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
    <div
      className="rounded-[20px] bg-white p-6"
      style={{ border: "2px solid var(--pp-ink, #121117)" }}
    >
      <p className="text-[14px] font-semibold text-[#6a697c]">{eyebrow}</p>

      {stat !== undefined && (
        <p className="mt-3 text-[38px] font-bold leading-none tracking-[-0.03em] text-[#121117]">
          {stat}
          {statLabel && (
            <span className="ml-1.5 text-[14px] font-semibold text-[#6a697c]">{statLabel}</span>
          )}
        </p>
      )}

      {rows.length > 0 && (
        <dl className="mt-3 space-y-1.5">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3">
              <dt className="text-[14px] font-medium text-[#6a697c]">{r.label}</dt>
              <dd className="text-[14px] font-bold text-[#121117]">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {children && <div className="mt-4 border-t border-[#dcdce5] pt-4">{children}</div>}

      <div className="mt-5 flex flex-col gap-2.5">
        {actions.map((a) => {
          const base =
            "inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border-2 border-[#121117] text-[15px] font-semibold transition active:scale-[0.98] disabled:opacity-40";
          if (a.tone === "dark")
            return (
              <button
                key={a.label}
                disabled={a.disabled}
                onClick={a.onClick}
                className={`${base} bg-[#121117] text-white hover:bg-[#2a2933]`}
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
                className={`${base} bg-white text-[#121117] hover:bg-[#f4f4f8]`}
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
              data-accent={accent}
              className={`${base} bg-[#2b6df0] text-white hover:bg-[#2260e4]`}
            >
              {a.icon}
              {a.label}
            </button>
          );
        })}
      </div>

      {footnote && (
        <p className="mt-3 text-center text-[13.5px] font-medium text-[#6a697c]">{footnote}</p>
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
    <section
      className="rounded-[24px] bg-white px-5 py-6 md:px-8 md:py-8"
      style={{ border: "2px solid #121117" }}
      data-eyebrow={eyebrow}
    >
      {back}
      <h1 className="mt-1 font-display text-[clamp(1.7rem,3.2vw,2.4rem)] font-bold leading-tight tracking-[-0.03em] text-[#121117]">
        {title}
      </h1>
      {description && (
        <p className="mt-2 max-w-3xl text-[16px] leading-relaxed text-[#4b4a5c]">{description}</p>
      )}
      {stats.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {stats.map((s) => (
            <span
              key={s.label}
              className="inline-flex items-center gap-2 rounded-lg border-2 border-[#121117] bg-white px-3 py-1 text-[13.5px] font-semibold text-[#121117]"
            >
              {s.icon}
              {s.label}
              <b className="text-[14px] font-bold">{s.value}</b>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
