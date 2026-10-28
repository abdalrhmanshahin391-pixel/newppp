import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { renderGuideHtml } from "@/lib/guides/guide-html";
import type { GuideContent } from "@/lib/guides/guide-content";

/** The sheet's width on screen: 439pt plus the page padding (see SCREEN_CSS in guide-html.ts). */
export const SHEET_PX = Math.round(439 * (4 / 3)) + 24;

export type GuideFrameHandle = {
  document: () => Document | null;
  window: () => Window | null;
  scrollToSection: (id: string) => void;
  /** Scrolls to a named piece and flashes it once. */
  showPiece: (id: string) => void;
};

/**
 * The guide on the right: the same template, words and fonts as the PDF, as a page so the learner
 * can select text on every device. It sits in an isolated frame with no script (the page reads the
 * selection from outside), and every piece carries its stable name (data-block / data-seg).
 */
export const GuideFrame = forwardRef<
  GuideFrameHandle,
  {
    content: GuideContent;
    zoom: number;
    title: string;
    onLoad?: (doc: Document) => void;
  }
>(function GuideFrame({ content, zoom, title, onLoad }, ref) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const html = useMemo(() => {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    return renderGuideHtml(content, {
      anchors: true,
      screen: true,
      draft: false,
      fontBase: `${origin}/fonts/guides/`,
    });
  }, [content]);

  useEffect(() => {
    const doc = frame.current?.contentDocument;
    if (doc?.documentElement) doc.documentElement.style.setProperty("zoom", String(zoom));
  }, [zoom]);

  useImperativeHandle(ref, () => ({
    document: () => frame.current?.contentDocument ?? null,
    window: () => frame.current?.contentWindow ?? null,
    scrollToSection: (id) => {
      const doc = frame.current?.contentDocument;
      doc?.getElementById(id)?.scrollIntoView({ block: "start", behavior: "smooth" });
    },
    showPiece: (id) => {
      const doc = frame.current?.contentDocument;
      const target =
        doc?.querySelector(`[data-seg="${CSS.escape(id)}"]`) ??
        doc?.querySelector(`[data-block="${CSS.escape(id)}"]`) ??
        doc?.getElementById(id);
      if (!target) return;
      target.scrollIntoView({ block: "center", behavior: "smooth" });
      target.classList.remove("st-flash");
      void (target as HTMLElement).offsetWidth;
      target.classList.add("st-flash");
    },
  }));

  return (
    <iframe
      ref={frame}
      title={`ملف الدرس: ${title}`}
      srcDoc={html}
      // No allow-scripts: the guide never runs code. Same origin so the page can read a selection.
      sandbox="allow-same-origin"
      className="block h-full w-full border-0 bg-[#f4f4f8]"
      onLoad={() => {
        const doc = frame.current?.contentDocument;
        if (!doc) return;
        doc.documentElement.style.setProperty("zoom", String(zoom));
        onLoad?.(doc);
      }}
    />
  );
});
