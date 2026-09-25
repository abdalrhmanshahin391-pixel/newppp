import { useState } from "react";
import { HelpCircle, Sparkles } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { useTutorialLang } from "@/components/tutorials/ToolTutorial";
import { toolForPath, type ToolDef } from "@/lib/site-tools";
import { getTourForTool } from "@/lib/tour-registry";
import { LivePageTour } from "@/components/tutorials/LivePageTour";

/**
 * Shining, highly visible "How it works" button.
 * Features an animated glowing shimmer ring and sparkling aura.
 * When clicked, launches an in-situ spotlight walkthrough directly on the page.
 */
export function HowItWorksButton({ tool }: { tool: ToolDef }) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useTutorialLang();
  const isAr = lang === "ar";
  const tour = getTourForTool(tool.key);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={isAr ? "دليل كيف يعمل" : "How it works guide"}
        className="group relative inline-flex items-center gap-2.5 rounded-full border-2 border-[#2f7d55] bg-white/95 px-4 py-2.5 text-[13.5px] font-black text-[#23201d] shadow-[0_4px_25px_rgba(47,125,85,0.35)] backdrop-blur-md transition-all duration-300 hover:scale-105 hover:bg-white hover:shadow-[0_6px_30px_rgba(47,125,85,0.55)] active:scale-95"
      >
        {/* Breathing animated glow ring */}
        <span className="pointer-events-none absolute -inset-1 rounded-full border border-emerald-500/40 opacity-75 animate-pulse" />

        {/* Pulsing live dot */}
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-80" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" />
        </span>

        {/* Sparkle icon */}
        <Sparkles
          size={16}
          className="text-[#2f7d55] transition-transform duration-500 group-hover:rotate-12"
        />

        {/* Label */}
        <span className="tracking-tight">
          {isAr ? "كيف يعمل؟" : "How it works"}
        </span>

        {/* Prominent Language Switcher Pill */}
        <span
          onClick={(e) => {
            e.stopPropagation();
            setLang(isAr ? "en" : "ar");
          }}
          className="rounded-full bg-[#fbf5e9] px-2 py-0.5 text-[10.5px] font-black uppercase tracking-wider text-[#2f7d55] border border-[#2f7d55]/30 hover:bg-[#2f7d55] hover:text-white transition-colors"
        >
          {lang === "ar" ? "عربية / EN" : "EN / ع"}
        </span>
      </button>

      {/* Live In-Page Interactive Spotlight Walkthrough */}
      <LivePageTour
        open={open}
        onClose={() => setOpen(false)}
        tour={tour}
        lang={lang}
        onLang={setLang}
      />
    </>
  );
}

/**
 * Floating launcher mounted once in the root layout: it shows itself only on
 * pages that belong to a known tool.
 */
export function ToolTutorialLauncher() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tool = toolForPath(pathname);
  if (!tool) return null;

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-40 print:hidden">
      <div className="pointer-events-auto">
        <HowItWorksButton tool={tool} />
      </div>
    </div>
  );
}
