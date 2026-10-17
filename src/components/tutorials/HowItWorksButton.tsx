import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { useTutorialLang } from "@/components/tutorials/tutorial-lang";
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
        className="inline-flex items-center gap-2.5 rounded-lg px-4 py-2.5 text-[14px] font-bold transition-transform hover:-translate-y-0.5 active:scale-[0.97]"
        style={{
          background: "#ffffff",
          color: "#121117",
          border: "2px solid #121117",
          fontFamily: "Figtree, Inter, Helvetica, Arial, sans-serif",
        }}
      >
        <Sparkles size={16} aria-hidden="true" style={{ color: "#d13d76" }} />
        <span>{isAr ? "كيف يعمل؟" : "How it works"}</span>
        <span
          role="button"
          tabIndex={0}
          aria-label={isAr ? "Switch to English" : "التبديل إلى العربية"}
          onClick={(e) => {
            e.stopPropagation();
            setLang(isAr ? "en" : "ar");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              setLang(isAr ? "en" : "ar");
            }
          }}
          className="rounded-md px-2 py-0.5 text-[12px] font-bold"
          style={{ background: "#ffe5f0", border: "1.5px solid #121117" }}
        >
          {lang === "ar" ? "EN" : "ع"}
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
