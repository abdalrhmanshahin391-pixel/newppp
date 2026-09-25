import { useState, useEffect } from "react";
import { Laptop, Tablet, X, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

const STORAGE_KEY = "ritajet_phone_experience_tip_dismissed";

export function PhoneExperienceTip() {
  const [visible, setVisible] = useState(false);
  const { i18n } = useTranslation();

  useEffect(() => {
    // Only show on client-side
    if (typeof window === "undefined") return;

    // Check if dismissed before
    try {
      if (localStorage.getItem(STORAGE_KEY) === "true") return;
    } catch {
      // localStorage disabled / private browsing
    }

    // Check if on a mobile phone screen width (< 768px)
    const isPhone = window.innerWidth < 768;
    if (!isPhone) return;

    // Give the user a moment to load the page before showing the friendly tip
    const timer = window.setTimeout(() => {
      setVisible(true);
    }, 1800);

    return () => window.clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // ignore
    }
  };

  if (!visible) return null;

  const isArabic =
    i18n.language?.startsWith("ar") ||
    (typeof document !== "undefined" &&
      (document.documentElement.lang === "ar" || document.documentElement.dir === "rtl"));

  return (
    <div
      role="status"
      aria-live="polite"
      dir={isArabic ? "rtl" : "ltr"}
      className="fixed bottom-4 inset-x-3 z-50 mx-auto max-w-md animate-in fade-in slide-in-from-bottom-3 duration-300 md:hidden"
    >
      <div className="relative flex items-start gap-3 rounded-2xl border border-emerald-900/15 bg-[#fdfbf6] p-3.5 text-[#2b2620] shadow-[0_16px_40px_-15px_rgba(43,38,32,0.45)] ring-1 ring-black/5">
        {/* Device Icon Avatar */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 shadow-xs">
          <div className="relative">
            <Laptop size={18} />
            <Tablet size={11} className="absolute -bottom-1 -right-1 text-emerald-900" />
          </div>
        </div>

        {/* Text Content */}
        <div className="min-w-0 flex-1 pe-5">
          <div className="flex items-center gap-1.5 text-[13px] font-black text-emerald-900">
            <Sparkles size={13} className="text-emerald-700 shrink-0" />
            <span>{isArabic ? "نصيحة دراسية لتجربة أفضل" : "Friendly Study Tip"}</span>
          </div>

          <p className="mt-1 text-[12px] font-semibold leading-relaxed text-[#5c554a]">
            {isArabic ? (
              <>
                للحصول على أفضل وأسهل تجربة مع البطاقات التعليمية، التلخيصات وبنك الأسئلة، ننصحك بفتح{" "}
                <span className="font-bold text-[#23201d]">ريتاجت</span> من جهاز{" "}
                <span className="font-bold text-emerald-950">آيباد أو لابتوب</span>! 💻📱
              </>
            ) : (
              <>
                For the best study experience with flashcards, PDF summaries & question banks, we recommend opening{" "}
                <span className="font-bold text-[#23201d]">RitaJet</span> on an{" "}
                <span className="font-bold text-emerald-950">iPad or laptop</span>! 💻📱
              </>
            )}
          </p>

          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={dismiss}
              className="rounded-lg bg-emerald-800 px-3 py-1 text-[11.5px] font-black text-white shadow-xs transition-colors hover:bg-emerald-900 active:scale-95"
            >
              {isArabic ? "حسناً، فهمت" : "Got it!"}
            </button>
          </div>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={dismiss}
          aria-label={isArabic ? "إغلاق" : "Dismiss"}
          className="absolute top-2.5 end-2.5 rounded-full p-1 text-[#8f8677] transition-colors hover:bg-black/5 hover:text-[#2b2620]"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
