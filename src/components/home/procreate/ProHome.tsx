import { lazy, Suspense } from "react";
import { ProHeader } from "./ProHeader";
import { HeroTapWord } from "./HeroTapWord";

const TopicsStrip = lazy(() => import("./TopicsStrip").then((m) => ({ default: m.TopicsStrip })));
const FeatureTrio = lazy(() => import("./FeatureTrio").then((m) => ({ default: m.FeatureTrio })));
const VoiceBand = lazy(() => import("./VoiceBand").then((m) => ({ default: m.VoiceBand })));
const LessonPathPreview = lazy(() =>
  import("./LessonPathPreview").then((m) => ({ default: m.LessonPathPreview })),
);
const UnderTheHood = lazy(() =>
  import("./UnderTheHood").then((m) => ({ default: m.UnderTheHood })),
);
const HomeFaq = lazy(() => import("./HomeFaq").then((m) => ({ default: m.HomeFaq })));
const FinalCta = lazy(() => import("./FinalCta").then((m) => ({ default: m.FinalCta })));

/** Home page: white surface, ink text, blue actions. Rita first, then the story bands and the questions. */
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

      <HeroTapWord />

      <Suspense fallback={<div className="min-h-[45vh]" aria-hidden="true" />}>
        <TopicsStrip />
        <FeatureTrio />
        <VoiceBand />
        <LessonPathPreview />
        <UnderTheHood />
      </Suspense>

      <Suspense fallback={<div className="min-h-[45vh]" aria-hidden="true" />}>
        <HomeFaq />
        <FinalCta />
      </Suspense>
    </main>
  );
}
