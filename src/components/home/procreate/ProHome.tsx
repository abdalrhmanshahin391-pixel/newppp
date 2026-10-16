import { lazy, Suspense } from "react";
import { ProHeader } from "./ProHeader";
import { HeroLive } from "./HeroLive";
import { IpadStage } from "./IpadStage";
import { StartLearningLink } from "@/components/StartLearningLink";
import { BRAND_NAME } from "@/lib/brand";

const TopicsStrip = lazy(() => import("./TopicsStrip").then((m) => ({ default: m.TopicsStrip })));
const FeatureTrio = lazy(() => import("./FeatureTrio").then((m) => ({ default: m.FeatureTrio })));
const VoiceBand = lazy(() => import("./VoiceBand").then((m) => ({ default: m.VoiceBand })));
const LessonPathPreview = lazy(() =>
  import("./LessonPathPreview").then((m) => ({ default: m.LessonPathPreview })),
);
const ProductShowcase = lazy(() =>
  import("./ProductShowcase").then((m) => ({ default: m.ProductShowcase })),
);
const FeatureTriptych = lazy(() =>
  import("./FeatureTriptych").then((m) => ({ default: m.FeatureTriptych })),
);
const GermanLabFeature = lazy(() =>
  import("./GermanLabFeature").then((m) => ({ default: m.GermanLabFeature })),
);
const ShareBand = lazy(() => import("./ShareBand").then((m) => ({ default: m.ShareBand })));
const HomeFaq = lazy(() => import("./HomeFaq").then((m) => ({ default: m.HomeFaq })));
const FinalCta = lazy(() => import("./FinalCta").then((m) => ({ default: m.FinalCta })));

/** Home page: white surface, ink text, pink actions. Rita first, the study workspace after. */
export function ProHome() {
  return (
    <main
      className="rita-cream edith-light edith-premium relative min-h-screen overflow-hidden bg-black text-white"
      style={{ fontFamily: "var(--font-grotesk)" }}
    >
      <noscript>
        <style>{".rita-reveal{opacity:1!important;transform:none!important}"}</style>
      </noscript>
      <ProHeader tone="light" />

      <HeroLive />

      <Suspense fallback={<div className="min-h-[45vh]" aria-hidden="true" />}>
        <TopicsStrip />
        <FeatureTrio />
        <VoiceBand />
        <LessonPathPreview />
      </Suspense>

      <section aria-labelledby="study-heading" className="pt-4 md:pt-10">
        <IpadStage cropped={false} />
        <div className="mx-auto max-w-[900px] px-5 pb-24 pt-8 text-center md:pt-10">
          <h2
            id="study-heading"
            className="font-bold leading-[1.02] tracking-[-0.03em]"
            style={{ fontSize: "clamp(2.4rem,6vw,4.6rem)" }}
          >
            Learn. Recall. <span className="rita-accent">Pass.</span>
          </h2>
          <p
            className="mx-auto mt-7 max-w-[620px] text-[19px] leading-[1.5] md:text-[21px]"
            style={{ color: "var(--pp-muted)" }}
          >
            {BRAND_NAME} is also a study workspace that turns your own notes and lecture PDFs into
            flashcards, summaries and practice questions.
          </p>
          <div className="mt-10 flex justify-center">
            <StartLearningLink className="rita-btn rita-btn-primary">
              Start learning
            </StartLearningLink>
          </div>
        </div>
      </section>

      <Suspense fallback={<div className="min-h-[45vh]" aria-hidden="true" />}>
        <ProductShowcase />
        <FeatureTriptych />
        <GermanLabFeature />
        <ShareBand />
        <HomeFaq />
        <FinalCta />
      </Suspense>
    </main>
  );
}
