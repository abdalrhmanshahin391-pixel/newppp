import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { ProHome } from "@/components/home/procreate/ProHome";
import { InstallAppBanner } from "@/components/InstallAppButton";
import screenAsset from "@/assets/home-ipad-restored.webp.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RitaJet — Learn. Recall. Pass." },
      {
        name: "description",
        content:
          "RitaJet turns your notes and lecture PDFs into smart flashcards, clean one-page summaries and AI-written practice questions.",
      },
      { property: "og:title", content: "RitaJet — Learn. Recall. Pass." },
      {
        property: "og:description",
        content:
          "Flashcards, PDF summaries and AI practice questions from your own study material.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://ritajet.com/" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:image",
        content:
          "https://ritajet.com/__l5e/assets-v1/e715e252-b093-484d-98d9-8e3144845769/home-ipad-restored.webp",
      },
      {
        name: "twitter:image",
        content:
          "https://ritajet.com/__l5e/assets-v1/e715e252-b093-484d-98d9-8e3144845769/home-ipad-restored.webp",
      },
    ],
    links: [
      { rel: "canonical", href: "https://ritajet.com/" },
      { rel: "preload", as: "image", href: screenAsset.url, fetchPriority: "high" },
      { rel: "prefetch", href: "/pricing" },
    ],
  }),
  component: Index,
});

function Index() {
  const router = useRouter();

  useEffect(() => {
    // When the browser is idle after painting the home page, warm up the primary ad conversion
    // targets (/pricing and /register) so tapping "Start learning" or "Pricing" opens in 0ms.
    let cancelled = false;
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
      .requestIdleCallback;
    const warm = () => {
      if (cancelled) return;
      void router.preloadRoute({ to: "/pricing" } as any);
      void router.preloadRoute({ to: "/register" } as any);
    };
    const id = idle ? idle(warm, { timeout: 1500 }) : window.setTimeout(warm, 700);
    return () => {
      cancelled = true;
      const cancelIdle = (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
      if (idle && cancelIdle) cancelIdle(id as number);
      else window.clearTimeout(id as number);
    };
  }, [router]);

  return (
    <div className="rita-cream min-h-screen bg-black text-white">
      <ProHome />
      <InstallAppBanner />
    </div>
  );
}
