import { Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { StartLearningLink } from "@/components/StartLearningLink";
import { LiveCallPhone } from "./LiveCallPhone";

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/** First screen: the promise on the left, a real Rita call on the right. */
export function HeroLive() {
  return (
    <section className="relative mx-auto grid max-w-[1180px] items-center gap-14 px-5 pb-16 pt-12 md:grid-cols-[1.05fr_0.95fr] md:gap-8 md:px-10 md:pb-24 md:pt-20">
      <div className="relative z-10 text-center md:text-start">
        <h1
          className="edith-in font-bold leading-[1.02] tracking-[-0.035em]"
          style={{ ...delay(80), fontSize: "clamp(2.6rem,6.4vw,4.8rem)" }}
        >
          Say it out loud.
          <br />
          <span className="rita-accent">
            Keep it <span className="whitespace-nowrap">for good.</span>
          </span>
        </h1>
        <p
          className="edith-in mx-auto mt-6 max-w-[34rem] text-[18px] leading-[1.55] md:mx-0 md:text-[20px]"
          style={{ ...delay(160), color: "var(--pp-muted)" }}
        >
          Rita is a voice teacher for English and German who explains in Arabic. Every word you ask
          about can become a flashcard.
        </p>
        <div
          className="edith-in mt-9 flex flex-wrap items-center justify-center gap-3 md:justify-start"
          style={delay(240)}
        >
          <StartLearningLink className="rita-btn rita-btn-primary">
            Start learning
          </StartLearningLink>
          <Link to="/rita" className="rita-btn rita-btn-secondary">
            Talk to Rita
          </Link>
        </div>
        <p
          className="edith-in mt-5 text-[14.5px]"
          style={{ ...delay(320), color: "var(--pp-muted)" }}
        >
          Free to start. No card needed.{" "}
          <Link to="/privacy-policy" className="underline underline-offset-4">
            Privacy
          </Link>
          {" · "}
          <Link to="/refund-policy" className="underline underline-offset-4">
            Refunds
          </Link>
        </p>
      </div>

      <div className="edith-in relative" style={delay(200)}>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, var(--pp-pink-soft) 0%, rgba(255,229,240,0.5) 55%, transparent 100%)",
          }}
        />
        <div className="relative">
          <LiveCallPhone />
        </div>
      </div>
    </section>
  );
}
