import { Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { useReveal } from "@/hooks/useReveal";

const d = (ms: number) => ({ "--rh-d": `${ms}ms` }) as CSSProperties;

const PHRASES = [
  { text: "Guten Morgen", lang: "de", style: { left: "2%", top: "10%" }, delay: 0 },
  { text: "How do I say…?", lang: "en", style: { right: "0%", top: "14%" }, delay: 1500 },
  { text: "كيف أحكي؟", lang: "ar", style: { left: "10%", bottom: "8%" }, delay: 3000 },
];

/** Dark band: the voice, as a calm orb. White text is set inline because the home page's
 * cream theme re-colours white utility classes. */
export function VoiceBand() {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <section className="mx-auto w-full max-w-[1240px] px-5 pb-20 md:px-8 md:pb-28">
      <div
        ref={ref}
        className={`rita-reveal relative overflow-hidden rounded-[28px] px-7 py-14 md:rounded-[36px] md:px-14 md:py-20 ${shown ? "rita-reveal-in" : ""}`}
        style={{ background: "#121117" }}
      >
        <div className="relative z-10 grid items-center gap-12 md:grid-cols-[1fr_0.9fr]">
          <div>
            <h2
              className="text-[36px] font-bold leading-[1.06] md:text-[54px]"
              style={{ color: "#ffffff" }}
            >
              Say it badly first.
              <br />
              <span style={{ color: "var(--pp-accent)" }}>Say it better next time.</span>
            </h2>
            <p
              className="mt-6 max-w-[30rem] text-[17px] leading-[1.65] md:text-[19px]"
              style={{ color: "rgba(255,255,255,0.72)" }}
            >
              Rita waits while you think, stops when you say stop, and corrects one thing at a time.
              It feels like talking to a patient teacher, not sitting an exam.
            </p>
            <div className="mt-8">
              <Link to="/rita" className="rita-btn rita-btn-primary">
                Talk to Rita
              </Link>
            </div>
          </div>

          <div className="relative mx-auto h-[300px] w-full max-w-[420px]" aria-hidden="true">
            <span
              className="rh-ring absolute left-1/2 top-1/2 h-[130px] w-[130px] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ border: "2px solid var(--pp-accent)" }}
            />
            <span
              className="rh-ring absolute left-1/2 top-1/2 h-[130px] w-[130px] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ ...d(1800), border: "2px solid var(--pp-accent)" }}
            />
            <span
              className="absolute left-1/2 top-1/2 grid h-[130px] w-[130px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 35% 30%, #9bbcf8, var(--pp-accent) 55%, #1f5fd6)",
                boxShadow: "0 30px 60px -20px rgba(43,109,240,0.55)",
              }}
            >
              <span className="flex h-10 items-center gap-1.5">
                {[0, 200, 100, 300, 150].map((delay, i) => (
                  <span
                    key={i}
                    className="rh-wave block h-10 w-[5px] rounded-full"
                    style={{ ...d(delay), background: "#121117" }}
                  />
                ))}
              </span>
            </span>
            {PHRASES.map((phrase) => (
              <span
                key={phrase.text}
                lang={phrase.lang}
                dir={phrase.lang === "ar" ? "rtl" : "ltr"}
                className="rh-float absolute rounded-full px-4 py-2 text-[14px] font-semibold"
                style={{
                  ...phrase.style,
                  ...d(phrase.delay),
                  color: "rgba(255,255,255,0.88)",
                  border: "1px solid rgba(255,255,255,0.22)",
                  background: "rgba(255,255,255,0.05)",
                }}
              >
                {phrase.text}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
