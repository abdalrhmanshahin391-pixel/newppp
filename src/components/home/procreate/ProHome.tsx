import { lazy, Suspense } from "react";
import { ProHeader } from "./ProHeader";
import { IpadStage } from "./IpadStage";
import { StartLearningLink } from "@/components/StartLearningLink";
import { BRAND_NAME } from "@/lib/brand";

const ProductShowcase = lazy(() =>
  import("./ProductShowcase").then((m) => ({ default: m.ProductShowcase })),
);
const FeatureTriptych = lazy(() =>
  import("./FeatureTriptych").then((m) => ({ default: m.FeatureTriptych })),
);
const GermanLabFeature = lazy(() =>
  import("./GermanLabFeature").then((m) => ({ default: m.GermanLabFeature })),
);
const RitaFeature = lazy(() => import("./RitaFeature").then((m) => ({ default: m.RitaFeature })));
const ShareBand = lazy(() => import("./ShareBand").then((m) => ({ default: m.ShareBand })));

/** Home page: white surface, ink text, blue accent. */
export function ProHome() {
  return (
    <main
      className="rita-cream edith-light edith-premium relative min-h-screen overflow-hidden bg-black text-white"
      style={{ fontFamily: "var(--font-grotesk)" }}
    >
      <ProHeader tone="light" />

      <IpadStage />

      <div className="mx-auto max-w-[900px] px-5 pb-24 pt-8 text-center md:pt-10">
        <h1
          className="edith-in font-bold leading-[1.02] tracking-[-0.03em]"
          style={{ fontSize: "clamp(2.6rem,7vw,5.5rem)", "--d": "680ms" } as React.CSSProperties}
        >
          Learn. Recall. <span className="rita-accent">Pass.</span>
        </h1>
        <p
          className="edith-in mx-auto mt-7 max-w-[620px] text-[19px] leading-[1.5] text-white/60 md:text-[21px]"
          style={{ "--d": "760ms" } as React.CSSProperties}
        >
          {BRAND_NAME} is a study workspace that turns your own notes and lecture PDFs into
          flashcards, summaries and practice questions.
        </p>
        <div
          className="edith-in mt-10 flex justify-center"
          style={{ "--d": "840ms" } as React.CSSProperties}
        >
          <StartLearningLink className="rita-btn rita-btn-primary">
            Start learning
          </StartLearningLink>
        </div>
        <p
          className="edith-in mt-5 text-[15px] text-white/45"
          style={{ "--d": "900ms" } as React.CSSProperties}
        >
          Free to start. No card needed.
        </p>
      </div>

      <Suspense fallback={<div className="min-h-[45vh]" aria-hidden="true" />}>
        <RitaFeature />
        <ProductShowcase />
        <FeatureTriptych />
        <GermanLabFeature />
        <ShareBand />
      </Suspense>
    </main>
  );
}
