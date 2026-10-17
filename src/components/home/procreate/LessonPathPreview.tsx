import { Check, Lock, BookOpen } from "lucide-react";
import type { CSSProperties } from "react";
import { useReveal } from "@/hooks/useReveal";

const ink = { color: "var(--pp-ink)" } as const;
const muted = { color: "var(--pp-muted)" } as const;

type State = "done" | "current" | "locked";
const LESSONS: { title: string; state: State }[] = [
  { title: "Hello & Goodbye", state: "done" },
  { title: "Me & You", state: "done" },
  { title: "Thank you & Please", state: "current" },
  { title: "Yes, No & Great idea!", state: "locked" },
  { title: "I'm busy", state: "locked" },
];

function Node({ state }: { state: State }) {
  const base = "relative grid h-[84px] w-[84px] place-items-center rounded-full";
  if (state === "done")
    return (
      <span
        className={base}
        style={{
          background: "var(--pp-accent)",
          border: "3px solid var(--pp-ink)",
          color: "var(--pp-on-accent)",
        }}
      >
        <Check size={30} strokeWidth={3} aria-hidden="true" />
      </span>
    );
  if (state === "current")
    return (
      <span
        className={base}
        style={{
          background: "var(--pp-accent-soft)",
          border: "3px solid var(--pp-ink)",
          boxShadow: "0 0 0 8px rgba(43,109,240,0.25)",
          ...ink,
        }}
      >
        <BookOpen size={30} aria-hidden="true" />
      </span>
    );
  return (
    <span
      className={base}
      style={{ background: "var(--pp-grey)", border: "3px solid var(--pp-line)", ...muted }}
    >
      <Lock size={26} aria-hidden="true" />
    </span>
  );
}

/** A small, honest picture of the lesson path (sample lesson names), shown as it fills in. */
export function LessonPathPreview() {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <section className="mx-auto w-full max-w-[1180px] px-5 pb-20 md:px-10 md:pb-28">
      <div className="mx-auto max-w-[40rem] text-center">
        <h2 className="text-[34px] font-bold leading-[1.08] md:text-[48px]" style={ink}>
          Lessons that follow a path.
        </h2>
        <p className="mt-4 text-[17px] leading-[1.6] md:text-[19px]" style={muted}>
          Short lessons with clear goals. Reach the goals, collect stars, and the next lesson opens.
        </p>
      </div>
      <div ref={ref} className="relative mt-14 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-5">
        <span
          aria-hidden="true"
          className="absolute left-[10%] right-[10%] top-[42px] hidden border-t-[3px] border-dotted sm:block"
          style={{ borderColor: "var(--pp-line)" }}
        />
        {LESSONS.map((lesson, index) => (
          <div
            key={lesson.title}
            className={`rita-reveal relative flex flex-col items-center text-center ${shown ? "rita-reveal-in" : ""}`}
            style={{ transitionDelay: `${index * 110}ms` } as CSSProperties}
          >
            <Node state={lesson.state} />
            <p className="mt-4 text-[15.5px] font-bold leading-snug" style={ink}>
              {lesson.title}
            </p>
            <p className="mt-1 text-[13px] font-semibold" style={muted}>
              {lesson.state === "done"
                ? "Done"
                : lesson.state === "current"
                  ? "You are here"
                  : "Locked"}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-10 text-center text-[13.5px]" style={muted}>
        Example path: English, level A1.
      </p>
    </section>
  );
}
