import { Link } from "@tanstack/react-router";
import {
  Lock,
  Sparkles,
  Smartphone,
  Layers,
  CalendarCheck,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import { openAuth } from "@/lib/auth-dialog";
import { UzyraIcon } from "@/components/books/BookObject";

const ASSURANCES = [
  { icon: Lock, text: "Your subjects and cards stay private to you." },
  { icon: Sparkles, text: "Free to start — no card needed." },
  { icon: Smartphone, text: "Same account on laptop, tablet and phone." },
];

export type PanelMode = { icon: LucideIcon; title: string; text: string };

const MODES: PanelMode[] = [
  { icon: Layers, title: "Memory Lab", text: "Flashcards that come back at the right moment." },
  { icon: CalendarCheck, title: "Exam schedule", text: "Every exam on one calm calendar." },
  { icon: ListChecks, title: "To-do list", text: "Today's study plan, ticked off one by one." },
];

/**
 * The screen a signed-out visitor meets before a study surface, game or shared item opens.
 * `title` and `lead` replace the default "Sign in to keep …" lines; `modes` replaces the list of
 * what waits inside. After signing in the visitor comes back to the same page.
 */
export function SignedOutPanel({
  what,
  title,
  lead,
  modes = MODES,
}: {
  what: string;
  title?: string;
  lead?: string;
  modes?: PanelMode[];
}) {
  const next =
    typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined;

  return (
    <div className="mx-auto grid w-full max-w-[1080px] items-center gap-10 py-14 md:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-14">
      <div className="rounded-[30px] border border-black/[0.06] bg-[#ffffff] p-7 shadow-[0_44px_90px_-60px_rgba(18,18,18,0.45)] md:p-10">
        <span
          className="grid h-14 w-14 place-items-center rounded-[20px]"
          style={{ background: "#121212", color: "#fff" }}
        >
          <UzyraIcon size={28} />
        </span>

        <h1 className="mt-5 font-display text-[28px] font-semibold leading-[1.1] tracking-tight md:text-[34px]">
          {title ?? `Sign in to keep ${what}`}
        </h1>
        <p className="mt-3 max-w-[34rem] text-[16px] leading-relaxed text-[#54546a]">
          {lead ??
            "Uzyra saves your decks, plans and progress to your own account, so nothing you build here gets lost."}
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => openAuth("signin", next)}
            className="rita-btn"
            style={{ background: "#121212", color: "#fff" }}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => openAuth("signup", next)}
            className="rita-btn rita-btn-secondary"
          >
            Create an account
          </button>
        </div>

        <ul className="mt-8 space-y-3 border-t border-black/[0.06] pt-6">
          {ASSURANCES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-[15px] text-[#4b4a5c]">
              <Icon size={17} className="shrink-0 text-[#121212]" />
              {text}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-[30px] border border-black/[0.06] bg-[color:var(--pro-card,#f4f4f8)] p-7 md:p-9">
        <p className="text-[12px] font-black uppercase tracking-[0.16em] text-[#6a697c]">
          Waiting for you inside
        </p>
        <div className="mt-5 space-y-4">
          {modes.map(({ icon: Icon, title: name, text }) => (
            <div
              key={name}
              className="flex items-start gap-4 rounded-[22px] bg-[#ffffff] px-5 py-4"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#f3f3f4]">
                <Icon size={18} className="text-[#121212]" />
              </span>
              <div>
                <p className="text-[15.5px] font-extrabold">{name}</p>
                <p className="mt-0.5 text-[14px] leading-relaxed text-[#54546a]">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
