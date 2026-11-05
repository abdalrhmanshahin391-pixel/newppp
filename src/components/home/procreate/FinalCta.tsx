import { Link } from "@tanstack/react-router";
import { StartLearningLink } from "@/components/StartLearningLink";

/** Closing invitation. White text is inline: the home theme re-colours white utility classes. */
export function FinalCta() {
  return (
    <section className="mx-auto w-full max-w-[1240px] px-5 pb-20 md:px-8 md:pb-24">
      <div
        className="rounded-[16px] px-6 py-12 text-center md:px-12 md:py-16"
        style={{ background: "#121117" }}
      >
        <h2 className="rh-h2 mx-auto max-w-[36rem]" style={{ color: "#ffffff" }}>
          Start with one sentence.
        </h2>
        <p
          className="rh-lead2 mx-auto mt-3 max-w-[30rem]"
          style={{ color: "rgba(255,255,255,0.72)" }}
        >
          Free to start. No card needed.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <StartLearningLink className="rita-btn rita-btn-primary">
            Start learning
          </StartLearningLink>
          <Link
            to="/rita"
            className="rita-btn rita-btn-secondary"
            style={{ background: "#ffffff" }}
          >
            Talk to Rita
          </Link>
        </div>
      </div>
    </section>
  );
}
