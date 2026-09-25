import { Link } from "@tanstack/react-router";
import { Lock, Sparkles, Smartphone, Layers, CalendarCheck, ListChecks } from "lucide-react";
import { openAuth } from "@/lib/auth-dialog";
import { RitaFace } from "@/components/brand/RitaBrand";

const ASSURANCES = [
  { icon: Lock, text: "Your subjects and cards stay private to you." },
  { icon: Sparkles, text: "Free to start — no card needed." },
  { icon: Smartphone, text: "Same account on laptop, tablet and phone." },
];

const MODES = [
  { icon: Layers, title: "Memory Lab", text: "Flashcards that come back at the right moment." },
  { icon: CalendarCheck, title: "Exam schedule", text: "Every exam on one calm calendar." },
  { icon: ListChecks, title: "To-do list", text: "Today's study plan, ticked off one by one." },
];

/** The screen a signed-out visitor meets before a study surface opens. */
export function SignedOutPanel({ what }: { what: string }) {
  const next =
    typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined;

  return (
    <div className="mx-auto grid w-full max-w-[1080px] items-center gap-10 py-14 md:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-14">
      <div className="rounded-[30px] border border-black/[0.06] bg-[#fdfaf3] p-7 shadow-[0_44px_90px_-60px_rgba(60,45,20,0.55)] md:p-10">
        <span className="grid h-14 w-14 place-items-center rounded-[20px] bg-[color:var(--rita-green-soft,rgba(122,160,44,0.14))]">
          <RitaFace size={40} />
        </span>

        <h1 className="mt-5 font-display text-[30px] font-black leading-[1.1] tracking-tight md:text-[38px]">
          Sign in to keep {what}
        </h1>
        <p className="mt-3 max-w-[34rem] text-[16px] leading-relaxed text-[#6d665c]">
          Rita saves your decks, plans and progress to your own account, so nothing you build here
          gets lost.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => openAuth("signin", next)}
            className="rita-btn rita-btn-primary"
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
            <li key={text} className="flex items-center gap-3 text-[15px] text-[#5d574e]">
              <Icon size={17} className="rita-accent shrink-0" />
              {text}
            </li>
          ))}
        </ul>

        <p className="mt-6 text-[14px] text-[#8a8378]">
          Just looking around?{" "}
          <Link to="/tutorial" className="rita-accent font-bold underline-offset-4 hover:underline">
            See how RitaJet works
          </Link>
        </p>
      </div>

      <div className="rounded-[30px] border border-black/[0.06] bg-[color:var(--pro-card,#f6f1e5)] p-7 md:p-9">
        <p className="text-[12px] font-black uppercase tracking-[0.16em] text-[#8a8378]">
          Waiting for you inside
        </p>
        <div className="mt-5 space-y-4">
          {MODES.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="flex items-start gap-4 rounded-[22px] bg-[#fdfaf3] px-5 py-4"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[color:var(--rita-green-soft,rgba(122,160,44,0.14))]">
                <Icon size={18} className="rita-accent" />
              </span>
              <div>
                <p className="text-[15.5px] font-extrabold">{title}</p>
                <p className="mt-0.5 text-[14px] leading-relaxed text-[#6d665c]">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
