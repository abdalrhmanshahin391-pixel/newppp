import { lazy, Suspense } from "react";
import { ProHeader } from "./ProHeader";
import { FeatureExplorer } from "./FeatureExplorer";
import { IntroCard } from "./IntroCard";
import { UltraHero } from "./UltraHero";

const TopicsStrip = lazy(() => import("./TopicsStrip").then((m) => ({ default: m.TopicsStrip })));
const AppWindow = lazy(() => import("./AppWindow").then((m) => ({ default: m.AppWindow })));
const UnderTheHood = lazy(() =>
  import("./UnderTheHood").then((m) => ({ default: m.UnderTheHood })),
);

/**
 * Home page: white surface, ink text, black, white and greys. Uzyra first, then what she does, the
 * library and how it works. (The «Ask Uzyra anything» list, the voice band, the sticker shelf, the
 * questions and the closing invitation were removed in Nov 2026 at the owner's request.)
 */
export function ProHome() {
  return (
    <main
      className="uz-home rita-cream edith-light edith-premium relative min-h-screen overflow-clip bg-black text-white"
      style={{ fontFamily: "var(--font-grotesk)" }}
    >
      <noscript>
        <style>
          {
            ".rita-reveal{opacity:1!important;transform:none!important}.uz-ag-ch,.uz-ag-letter,.library-shelves .bk-item,.uz-fx-me,.uz-fx-her-wrap,.uz-fx-wordlist li{opacity:1!important;translate:none!important;transform:none!important}"
          }
        </style>
      </noscript>
      <ProHeader tone="light" />

      <UltraHero />
      <IntroCard />
      <FeatureExplorer />

      <Suspense fallback={<div className="min-h-[45vh]" aria-hidden="true" />}>
        <TopicsStrip />
        <AppWindow />
        <UnderTheHood />
      </Suspense>
    </main>
  );
}
