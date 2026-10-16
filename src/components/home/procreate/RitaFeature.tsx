import { Link } from "@tanstack/react-router";
import { useReveal } from "@/hooks/useReveal";

/** Home section for Rita, the voice teacher: what a call looks like and where the words go. */
export function RitaFeature() {
  const copy = useReveal<HTMLDivElement>();
  const demo = useReveal<HTMLDivElement>();

  return (
    <section className="mx-auto w-full max-w-[1120px] px-5 pb-20 pt-4 md:px-8 md:pb-32 md:pt-10">
      <div className="grid items-center gap-12 md:grid-cols-[1fr_1fr] md:gap-16">
        <div ref={copy.ref} className={`rita-reveal ${copy.shown ? "rita-reveal-in" : ""}`}>
          <h2 className="rita-ink text-[38px] font-bold leading-[1.06] md:text-[56px]">
            Say it out loud with <span className="rita-accent">Rita.</span>
          </h2>
          <p className="rita-ink-soft mt-6 max-w-[520px] text-[18px] leading-[1.6] md:text-[20px]">
            Speak English or German with a voice teacher who explains in Arabic and stops when you
            say stop. Tap any foreign word for its meaning and three pronunciation speeds.
          </p>
          <p className="rita-ink-soft mt-4 max-w-[520px] text-[18px] leading-[1.6] md:text-[20px]">
            Every word you ask about lands in your list, ready to become flashcards.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link to="/rita" className="rita-btn rita-btn-primary">
              Talk to Rita
            </Link>
            <Link to="/rita-lessons" className="rita-btn rita-btn-secondary">
              See the lessons
            </Link>
          </div>
        </div>

        <div
          ref={demo.ref}
          className={`rita-reveal ${demo.shown ? "rita-reveal-in" : ""}`}
          style={{ transitionDelay: "90ms" }}
        >
          <div
            role="img"
            aria-label="Example: the learner asks what Guten Morgen means, Rita answers, and the word is added to the learner's list."
            className="rounded-[24px] bg-[var(--pro-card)] p-5 md:p-7"
          >
            <div className="flex flex-col gap-3" aria-hidden="true">
              <div
                className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-[var(--pp-ink)] px-4 py-3 text-[16px] font-medium"
                style={{ color: "#fff" }}
              >
                <span dir="rtl" lang="ar">
                  شو معنى Guten Morgen؟
                </span>
              </div>
              <div className="max-w-[90%] self-start rounded-2xl rounded-bl-md bg-white px-4 py-3 text-[16px] leading-7 text-[var(--pp-ink)]">
                <p dir="rtl" lang="ar">
                  يعني{" "}
                  <span
                    dir="ltr"
                    className="mx-0.5 inline-block rounded-md bg-[var(--pp-pink-soft)] px-2 font-semibold"
                  >
                    Guten Morgen
                  </span>{" "}
                  صباح الخير. بنقولها الصبح لحد الساعة عشرة تقريباً.
                </p>
              </div>
              <div className="mt-2 rounded-2xl border border-[var(--pp-line)] bg-white px-4 py-3">
                <p className="text-[13px] font-semibold text-[var(--pp-muted)]">
                  Added to your words
                </p>
                <div className="mt-1 flex items-baseline justify-between gap-4">
                  <strong className="text-[17px]">Guten Morgen</strong>
                  <span dir="rtl" lang="ar" className="text-[16px] text-[var(--pp-muted)]">
                    صباح الخير
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
