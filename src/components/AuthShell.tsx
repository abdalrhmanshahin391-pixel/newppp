import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Layers, FileText, ListChecks, Sparkles } from "lucide-react";
import { KitaBrand } from "@/components/brand/KitaBrand";
import { RitaFace } from "@/components/brand/RitaBrand";
import { cn } from "@/lib/utils";

const TRUST = [
  { icon: Layers, tone: "#e4dcf3", ink: "#4a3877", text: "Flashcards you build once and study forever" },
  { icon: FileText, tone: "#fbe3c8", ink: "#7a4b16", text: "PDF and photo summaries in Rita's colours" },
  { icon: ListChecks, tone: "#d6e8f6", ink: "#1f4c6d", text: "A to-do board that keeps the semester calm" },
];

/**
 * AuthShell — a warm, glassy split panel: an illustrated aurora side with the
 * promise + proof, and a roomy form side with large, friendly controls.
 */
export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  wide,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
  /** Register-style forms get a roomier form column. */
  wide?: boolean;
}) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#fbf5e9] text-foreground">
      {/* Soft aurora background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="auth-blob absolute -left-32 -top-40 h-[34rem] w-[34rem] rounded-full bg-[#cfe6a8] opacity-55 blur-[110px]" />
        <div className="auth-blob auth-blob-2 absolute -right-40 top-10 h-[30rem] w-[30rem] rounded-full bg-[#f6d3a6] opacity-55 blur-[110px]" />
        <div className="auth-blob auth-blob-3 absolute bottom-[-14rem] left-1/3 h-[32rem] w-[32rem] rounded-full bg-[#d9d2f2] opacity-50 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(35,32,29,0.09) 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />
      </div>

      <header className="relative mx-auto flex w-full max-w-[76rem] items-center justify-between px-4 py-5 md:px-8">
        <Link to="/" className="flex items-center">
          <KitaBrand size={34} />
        </Link>
        <Link
          to="/"
          className="rounded-full bg-white/70 px-4 py-2 text-sm font-bold text-[#6b655c] backdrop-blur transition-colors hover:bg-white hover:text-foreground"
        >
          ← back home
        </Link>
      </header>

      <main className="relative mx-auto w-full max-w-[76rem] flex-1 px-4 pb-12 md:px-8">
        <div
          className={cn(
            "grid overflow-hidden rounded-[36px] border border-white/70 bg-white/70 shadow-[0_40px_90px_-50px_rgba(35,32,29,0.55)] backdrop-blur-xl",
            wide ? "lg:grid-cols-[0.9fr_1fr]" : "lg:grid-cols-[1fr_1fr]",
          )}
        >
          {/* Illustrated side */}
          <aside className="relative hidden flex-col overflow-hidden bg-gradient-to-br from-[#f3f7e6] via-[#fdf3e2] to-[#f0ecfb] lg:flex">
            <div
              aria-hidden="true"
              className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#8ec63f]/20 blur-3xl"
            />
            <div className="relative flex h-full flex-col px-9 pt-10">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-[#5f7a2e]">
                <Sparkles size={13} /> {eyebrow}
              </span>
              <h2
                className="mt-4 max-w-[15ch] font-display font-black leading-[1.03] tracking-tight text-[#23201d]"
                style={{ fontSize: "clamp(1.8rem, 2.6vw, 2.5rem)" }}
              >
                Your whole semester, in one calm workspace.
              </h2>

              <ul className="mt-7 grid gap-3">
                {TRUST.map((item) => (
                  <li
                    key={item.text}
                    className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-[14px] font-bold text-[#3a352e] shadow-[0_10px_24px_-20px_rgba(35,32,29,0.8)] backdrop-blur-[2px]"
                  >
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                      style={{ background: item.tone, color: item.ink }}
                    >
                      <item.icon size={17} />
                    </span>
                    {item.text}
                  </li>
                ))}
              </ul>

              <RitaFace size={220} />
            </div>
          </aside>

          {/* Form side */}
          <div className="bg-white/85 p-6 sm:p-10">
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <RitaFace size={56} />
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                {eyebrow}
              </p>
            </div>

            <h1
              className="font-display font-black leading-[1.05] tracking-tight text-foreground"
              style={{ fontSize: "clamp(1.9rem, 4vw, 2.4rem)" }}
            >
              {title}
            </h1>
            <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">{subtitle}</p>

            <div className="mt-7">{children}</div>
            <div className="mt-6 rounded-2xl bg-[#fbf5e9] px-4 py-3 text-center text-sm font-medium text-muted-foreground">
              {footer}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/** Two fields side by side on desktop, stacked on phones. */
export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid gap-x-4 sm:grid-cols-2">{children}</div>;
}

/** Small labelled group (kept for simple flows that still want a boxed section). */
export function FieldGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/70 bg-background/60 p-4">
      <p className="mb-3 text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      {children}
    </section>
  );
}

export function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-[13px] font-black uppercase tracking-[0.08em] text-[#6b655c]">
        {label} {required && <span className="text-destructive">*</span>}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-2xl border-2 border-black/[0.07] bg-[#fbf7ef] px-4 h-13 py-3.5 text-[15px] font-medium text-foreground placeholder:font-normal placeholder:text-muted-foreground outline-none transition-all focus:border-[var(--rita-green)] focus:bg-white focus:ring-4 focus:ring-[var(--rita-green-soft)]";

export const buttonClass =
  "inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--rita-green)] px-8 py-4 text-[17px] font-black text-[color:var(--rita-green-ink)] shadow-[0_16px_30px_-16px_rgba(122,160,44,0.9)] transition-all hover:-translate-y-0.5 hover:bg-[var(--rita-green-deep)] active:translate-y-0 disabled:translate-y-0 disabled:opacity-60";

export function ErrorBox({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mb-5 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
    >
      {message}
    </div>
  );
}
