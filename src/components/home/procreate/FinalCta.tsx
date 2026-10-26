import { Link } from "@tanstack/react-router";
import { StartLearningLink } from "@/components/StartLearningLink";

/** Closing invitation. White text is inline: the home theme re-colours white utility classes. */
export function FinalCta() {
  return (
    <section className="mx-auto w-full max-w-[1240px] px-5 pb-24 md:px-8 md:pb-32">
      <div
        className="rounded-[28px] px-7 py-14 text-center md:rounded-[36px] md:px-14 md:py-20"
        style={{ background: "var(--uz-band, #121117)" }}
      >
        <h2
          className="mx-auto max-w-[36rem] text-[34px] font-bold leading-[1.08] md:text-[52px]"
          style={{ color: "#ffffff" }}
        >
          Start with one sentence.
        </h2>
        <p
          className="mx-auto mt-4 max-w-[30rem] text-[17px]"
          style={{ color: "rgba(255,255,255,0.72)" }}
        >
          Free to start. No card needed.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <StartLearningLink className="rita-btn rita-btn-primary">
            Start learning
          </StartLearningLink>
          <Link
            to="/rita"
            className="rita-btn rita-btn-secondary"
            style={{ background: "var(--uz-secondary-bg, #ffffff)" }}
          >
            Talk to Rita
          </Link>
        </div>
      </div>
    </section>
  );
}
