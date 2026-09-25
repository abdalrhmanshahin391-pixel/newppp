import { useEffect, useState, useRef, useCallback } from "react";
import { ArrowLeft, ArrowRight, Check, Sparkles, X, Languages, CheckCircle2, Eye, EyeOff } from "lucide-react";
import type { PageTourDef, TourStep } from "@/lib/tour-registry";
import type { TutorialLang } from "./ToolTutorial";

type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
};

export function LivePageTour({
  open,
  onClose,
  tour,
  lang,
  onLang,
}: {
  open: boolean;
  onClose: () => void;
  tour: PageTourDef;
  lang: TutorialLang;
  onLang: (l: TutorialLang) => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardHeight, setCardHeight] = useState(220);

  const isAr = lang === "ar";
  const step: TourStep | undefined = tour.steps[stepIndex];

  // Measure card height whenever step, lang, or window changes
  useEffect(() => {
    if (!cardRef.current) return;
    const updateH = () => {
      if (cardRef.current) {
        setCardHeight(cardRef.current.offsetHeight || 320);
      }
    };
    updateH();
    const observer = new ResizeObserver(() => updateH());
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [stepIndex, lang, open]);

  // Viewport resize listener
  useEffect(() => {
    const checkViewport = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkViewport();
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
  }, []);

function safeFindElement(selector?: string): HTMLElement | null {
  if (!selector) return null;
  try {
    return document.querySelector(selector) as HTMLElement | null;
  } catch (err) {
    console.warn(`[LivePageTour] Invalid or unresolvable selector "${selector}":`, err);
    return null;
  }
}

  // Update rect of the spotlighted target element
  const updateRect = useCallback(() => {
    if (!open || !step) {
      setRect(null);
      return;
    }

    let el = safeFindElement(step.targetSelector);
    if (!el && step.fallbackSelector) {
      el = safeFindElement(step.fallbackSelector);
    }

    if (el) {
      const freshRect = el.getBoundingClientRect();
      const mobile = window.innerWidth < 768;
      const pad = mobile ? 6 : 10;
      const elementHeight = freshRect.height;

      setRect({
        top: Math.max(0, freshRect.top - pad),
        left: Math.max(0, freshRect.left - pad),
        width: freshRect.width + pad * 2,
        height: elementHeight + pad * 2,
        bottom: freshRect.top - pad + elementHeight + pad * 2,
        right: freshRect.left - pad + freshRect.width + pad * 2,
      });
    } else {
      // Graceful fallback center box
      const w = Math.min(360, window.innerWidth - 32);
      const h = 180;
      setRect({
        top: 100,
        left: Math.max(16, (window.innerWidth - w) / 2),
        width: w,
        height: h,
        bottom: 100 + h,
        right: Math.max(16, (window.innerWidth - w) / 2) + w,
      });
    }
  }, [open, step]);

  // Smooth scroll target element into comfortable view once per step change
  useEffect(() => {
    if (!open || !step) return;

    let el = safeFindElement(step.targetSelector);
    if (!el && step.fallbackSelector) {
      el = safeFindElement(step.fallbackSelector);
    }
    if (!el) return;

    const b = el.getBoundingClientRect();
    const mobile = window.innerWidth < 768;
    const reservedBottom = mobile ? 280 : 360;

    const isComfortable =
      b.top >= (mobile ? 70 : 85) &&
      b.bottom <= window.innerHeight - reservedBottom;

    if (!isComfortable) {
      const targetScroll = window.scrollY + b.top - (mobile ? 75 : 95);
      window.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: "smooth",
      });
    }
  }, [open, stepIndex, step]);

  // Recalculate spotlight geometry on step change, resize, and scroll with rAF throttling
  useEffect(() => {
    if (!open) return;
    updateRect();
    const timer = setTimeout(updateRect, 320); // allow smooth scroll to settle

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          updateRect();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", updateRect);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", updateRect);
    };
  }, [open, stepIndex, updateRect]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        if (isAr) handleBack();
        else handleNext();
      } else if (e.key === "ArrowLeft") {
        if (isAr) handleNext();
        else handleBack();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, stepIndex, isAr]);

  if (!open || !step) return null;

  const handleNext = () => {
    if (stepIndex < tour.steps.length - 1) {
      setStepIndex((i) => i + 1);
      setIsMinimized(false);
    } else {
      onClose();
    }
  };

  const handleBack = () => {
    if (stepIndex > 0) {
      setStepIndex((i) => i - 1);
      setIsMinimized(false);
    }
  };

  const handleAction = (actionId: string) => {
    if (actionId === "toggle-edit-mode") {
      const editBtn = safeFindElement(
        '[data-tour="mode-switch"] button:nth-child(2)'
      ) as HTMLButtonElement | null;
      if (editBtn) {
        editBtn.click();
        setTimeout(updateRect, 250);
      }
    }
  };

  // --- Strict Viewport-Contained Collision-Free Card Placement ---
  let cardStyle: React.CSSProperties = {};
  const maxCardH = Math.min(480, window.innerHeight - 32);

  if (isMobile) {
    // Dynamic top/bottom placement to guarantee the spotlighted target element is NEVER obscured
    // On mobile, only dock at top if the target element starts lower down the screen (rect.top > 230px)
    // Otherwise dock at the bottom so the element's header, controls, and content at the top are 100% visible!
    const placeOnTop = rect ? rect.top > 230 : false;

    cardStyle = {
      position: "fixed",
      ...(placeOnTop
        ? { top: "max(0.75rem, env(safe-area-inset-top))" }
        : { bottom: "max(0.75rem, env(safe-area-inset-bottom))" }),
      left: "0.75rem",
      right: "0.75rem",
      maxWidth: "32rem",
      maxHeight: "min(230px, 32vh)",
      margin: "0 auto",
      zIndex: 9999,
    };
  } else if (rect) {
    const cardWidth = Math.min(460, window.innerWidth - 32);
    const estHeight = Math.min(cardHeight || 340, maxCardH);
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceRight = window.innerWidth - rect.right;
    const spaceLeft = rect.left;
    const spaceAbove = rect.top;

    let top: number | undefined = undefined;
    let bottom: number | undefined = undefined;
    let left: number | undefined = undefined;
    let right: number | undefined = undefined;

    // 1. Preferred: cleanly below the highlighted element
    if (spaceBelow >= estHeight + 20) {
      top = rect.bottom + 16;
      left = isAr ? Math.max(16, rect.right - cardWidth) : Math.max(16, rect.left);
    }
    // 2. Side-by-Side: Place to the right of the highlighted element
    else if (spaceRight >= cardWidth + 24) {
      left = rect.right + 16;
      top = Math.max(16, Math.min(window.innerHeight - estHeight - 16, rect.top));
    }
    // 3. Side-by-Side: Place to the left of the highlighted element
    else if (spaceLeft >= cardWidth + 24) {
      left = Math.max(16, rect.left - cardWidth - 16);
      top = Math.max(16, Math.min(window.innerHeight - estHeight - 16, rect.top));
    }
    // 4. Above: Only if there is clean space above without touching the element
    else if (spaceAbove >= estHeight + 20) {
      top = Math.max(16, rect.top - estHeight - 16);
      left = isAr ? Math.max(16, rect.right - cardWidth) : Math.max(16, rect.left);
    }
    // 5. Fallback: For large elements (like calendar) where neither sides nor below have clearance,
    // dock to the bottom corner so the card and its controls NEVER get pushed below the screen!
    else {
      bottom = 16;
      if (isAr) {
        left = 20;
      } else {
        right = 20;
      }
    }

    cardStyle = {
      position: "fixed",
      ...(top !== undefined ? { top: `${Math.max(16, Math.min(window.innerHeight - estHeight - 16, top))}px` } : {}),
      ...(bottom !== undefined ? { bottom: `${bottom}px` } : {}),
      ...(left !== undefined ? { left: `${Math.max(16, Math.min(window.innerWidth - cardWidth - 16, left))}px` } : {}),
      ...(right !== undefined ? { right: `${right}px` } : {}),
      width: `${cardWidth}px`,
      maxHeight: `${maxCardH}px`,
      zIndex: 9999,
    };
  }

  return (
    <div className="live-tour-root">
      {/* Full screen backdrop when rect is NOT yet measured */}
      {!rect && (
        <div
          className="fixed inset-0 z-[9990] bg-black/60 transition-opacity duration-300 cursor-pointer"
          onClick={onClose}
        />
      )}

      {/* Transparent click-outside dismiss backdrop when rect is active */}
      {rect && (
        <div
          className="fixed inset-0 z-[9990] cursor-pointer"
          onClick={onClose}
          aria-label="Close tour"
        />
      )}

      {/* Radiant Spotlight Cutout Frame:
          Uses 0 0 0 9999px box-shadow to darken everything outside
          WITHOUT using backdrop-filter blur that causes iOS Safari to blur the spotlighted element!
      */}
      {rect && (
        <div
          className="pointer-events-none fixed transition-all duration-300 ease-out"
          style={{
            top: `${rect.top}px`,
            left: `${rect.left}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            borderRadius: "20px",
            boxShadow:
              "0 0 0 9999px rgba(12, 10, 8, 0.62), 0 0 25px 5px rgba(47, 125, 85, 0.6)",
            border: "2.5px solid rgba(47, 125, 85, 0.95)",
            zIndex: 9995,
          }}
        >
          {/* Pulsating radiant ring */}
          <div className="absolute -inset-1 rounded-[22px] border border-emerald-400/50 animate-pulse" />
        </div>
      )}

      {/* Explanatory Spotlight Floating Card or Minimized Floating Dock */}
      {isMobile && isMinimized ? (
        <div
          style={{
            position: "fixed",
            bottom: "max(0.75rem, env(safe-area-inset-bottom))",
            left: "0.75rem",
            right: "0.75rem",
            maxWidth: "32rem",
            margin: "0 auto",
            zIndex: 9999,
          }}
          dir={isAr ? "rtl" : "ltr"}
          className="flex items-center justify-between gap-2 rounded-full border border-black/[0.15] bg-[#fbf5e9] px-3.5 py-1.5 shadow-[0_12px_36px_-6px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#2f7d55] text-[10px] font-black text-white">
              {stepIndex + 1}
            </span>
            <span className="truncate text-[12px] font-bold text-[#23201d]">
              {step.title[lang]}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsMinimized(false)}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-100/90 text-emerald-900 border border-emerald-300/80 px-2.5 py-1 text-[11px] font-bold hover:bg-emerald-200 transition-colors"
            >
              <Eye size={12} />
              <span>{isAr ? "عرض الشرح" : "Details"}</span>
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1 rounded-full bg-[#2f7d55] px-3 py-1 text-[11px] font-black text-white shadow-xs"
            >
              <span>{stepIndex === tour.steps.length - 1 ? (isAr ? "إنهاء" : "Finish") : (isAr ? "التالي" : "Next")}</span>
              {stepIndex < tour.steps.length - 1 && (isAr ? <ArrowLeft size={11} /> : <ArrowRight size={11} />)}
            </button>
          </div>
        </div>
      ) : (
        <div
          ref={cardRef}
          style={cardStyle}
          dir={isAr ? "rtl" : "ltr"}
          className="flex flex-col overflow-hidden rounded-[22px] sm:rounded-[26px] border border-black/[0.12] bg-[#fbf5e9] p-3 sm:p-5 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.55)] animate-in fade-in zoom-in-95 duration-200"
        >
          {/* Card Top Navigation Bar */}
          <div className="flex shrink-0 items-center justify-between border-b border-black/[0.08] pb-2 sm:pb-3">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="grid h-5 w-5 sm:h-6 sm:w-6 place-items-center rounded-full bg-[#2f7d55] text-[10px] sm:text-[11px] font-black text-white shadow-xs">
                {stepIndex + 1}
              </span>
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-[#6b655c]">
                {isAr
                  ? `الخطوة ${stepIndex + 1} من ${tour.steps.length}`
                  : `Step ${stepIndex + 1} of ${tour.steps.length}`}
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Minimize / Hide button on mobile */}
              {isMobile && (
                <button
                  type="button"
                  onClick={() => setIsMinimized(true)}
                  className="inline-flex items-center gap-1 rounded-full bg-black/[0.05] hover:bg-black/[0.1] px-2 py-0.5 text-[10.5px] font-bold text-[#5a544c] transition-colors"
                  title={isAr ? "تصغير الشرح لرؤية الشاشة كاملة" : "Minimize to see screen"}
                >
                  <EyeOff size={11} />
                  <span>{isAr ? "إخفاء" : "Hide"}</span>
                </button>
              )}

              {/* Prominent Language Switcher */}
              <div className="inline-flex items-center rounded-full border border-black/[0.09] bg-white p-0.5 shadow-xs" dir="ltr">
                <button
                  type="button"
                  onClick={() => onLang("en")}
                  className={`rounded-full px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-[11px] font-black uppercase transition-all ${
                    lang === "en"
                      ? "bg-[#23201d] text-white shadow-xs"
                      : "text-[#6b655c] hover:text-[#23201d]"
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => onLang("ar")}
                  className={`rounded-full px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-[11px] font-black transition-all ${
                    lang === "ar"
                      ? "bg-[#23201d] text-white shadow-xs"
                      : "text-[#6b655c] hover:text-[#23201d]"
                  }`}
                >
                  عربية
                </button>
              </div>

              {/* Skip Button */}
              <button
                type="button"
                onClick={onClose}
                className="text-[11px] sm:text-[12px] font-extrabold text-[#7a7265] hover:text-[#23201d] px-1 transition-colors"
              >
                {isAr ? "تخطي" : "Skip"}
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close tour"
                className="grid h-6 w-6 sm:h-7 sm:w-7 place-items-center rounded-full bg-black/[0.05] hover:bg-black/[0.1] text-[#23201d] transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Scrollable Content Body */}
          <div className="mt-2 sm:mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
            <h3 className="font-display text-[14px] sm:text-[17px] font-black leading-snug text-[#23201d]">
              {step.title[lang]}
            </h3>

            <p className="mt-1 sm:mt-1.5 text-[11.5px] sm:text-[13px] leading-relaxed text-[#4a453d] font-medium">
              {step.description[lang]}
            </p>

            {/* Key detailed bullets */}
            {step.bullets && (
              <ul className="mt-2 sm:mt-2.5 space-y-1 sm:space-y-1.5 text-[11px] sm:text-[12px] text-[#3a352e]">
                {step.bullets[lang].map((bullet, i) => (
                  <li key={i} className="flex items-start gap-1.5 sm:gap-2 leading-relaxed">
                    <CheckCircle2 size={12} className="text-[#2f7d55] shrink-0 mt-0.5" />
                    <span className="flex-1">{bullet}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* Interactive Action Prompt */}
            {step.actionPrompt && (
              <button
                type="button"
                onClick={() => handleAction(step.actionPrompt!.actionId)}
                className="mt-2 sm:mt-3 flex w-full items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-[11px] sm:text-[12px] font-black text-emerald-950 transition-all hover:bg-emerald-100 active:scale-98 shadow-xs"
              >
                <span>{step.actionPrompt.label[lang]}</span>
                <ArrowRight size={12} className={isAr ? "rotate-180" : ""} />
              </button>
            )}
          </div>

          {/* Card Footer: Progress Dots & Navigation */}
          <div className="mt-2 sm:mt-3.5 flex shrink-0 items-center justify-between border-t border-black/[0.07] pt-2 sm:pt-3">
            {/* Progress dots */}
            <div className="flex items-center gap-1.5" dir="ltr">
              {tour.steps.map((_, i) => (
                <span
                  key={i}
                  onClick={() => {
                    setStepIndex(i);
                    setIsMinimized(false);
                  }}
                  className={`cursor-pointer rounded-full transition-all ${
                    stepIndex === i
                      ? "h-1.5 sm:h-2 w-4 sm:w-5 bg-[#2f7d55]"
                      : "h-1.5 sm:h-2 w-1.5 sm:w-2 bg-black/20 hover:bg-black/40"
                  }`}
                />
              ))}
            </div>

            {/* Back & Next Navigation Buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {stepIndex > 0 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex items-center gap-1 rounded-full border border-black/[0.1] bg-white px-3 sm:px-3.5 py-1 sm:py-1.5 text-[11px] sm:text-[12px] font-bold text-[#23201d] transition-colors hover:bg-black/[0.04]"
                >
                  {isAr ? <ArrowRight size={12} /> : <ArrowLeft size={12} />}
                  {isAr ? "السابق" : "Back"}
                </button>
              )}

              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#2f7d55] px-3.5 sm:px-4 py-1 sm:py-1.5 text-[11px] sm:text-[12px] font-black text-white shadow-sm transition-all hover:bg-[#256344] active:scale-98"
              >
                <span>
                  {stepIndex === tour.steps.length - 1
                    ? isAr
                      ? "إنهاء الجولة ✓"
                      : "Finish tour ✓"
                    : isAr
                      ? "التالي"
                      : "Next"}
                </span>
                {stepIndex < tour.steps.length - 1 && (
                  isAr ? <ArrowLeft size={12} /> : <ArrowRight size={12} />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
