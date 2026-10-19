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
      className="fixed bottom-4 inset-x-3 z-40 mx-auto max-w-md animate-in fade-in slide-in-from-bottom-3 duration-300 md:hidden"
    >
      <div className="relative flex items-start gap-3 rounded-2xl border-2 border-[#121117] bg-white p-3.5 text-[#121117]">
        {/* Device Icon Avatar */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center text-[#121117]">
          <div className="relative">
            <Laptop size={18} />
            <Tablet size={11} className="absolute -bottom-1 -right-1 text-[#121117]" />
          </div>
        </div>

        {/* Text Content */}
        <div className="min-w-0 flex-1 pe-8">
          <div className="flex items-center gap-1.5 text-[14px] font-bold text-[#121117]">
            <Sparkles size={13} className="text-[#2b6df0] shrink-0" />
            <span>{isArabic ? "نصيحة دراسية لتجربة أفضل" : "Friendly Study Tip"}</span>
          </div>

          <p className="mt-1 text-[12px] font-semibold leading-relaxed text-[#4b4a5c]">
            {isArabic ? (
              <>
                للحصول على أفضل وأسهل تجربة مع البطاقات التعليمية، التلخيصات وبنك الأسئلة، ننصحك بفتح{" "}
                <span className="font-bold text-[#121117]">ريتاجت</span> من جهاز{" "}
                <span className="font-bold text-[#121117]">آيباد أو لابتوب</span>! 💻📱
              </>
            ) : (
              <>
                For the best study experience with flashcards, PDF summaries & question banks, we recommend opening{" "}
                <span className="font-bold text-[#121117]">EdithLab</span> on an{" "}
                <span className="font-bold text-[#121117]">iPad or laptop</span>! 💻📱
              </>
            )}
          </p>

          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={dismiss}
              className="min-h-11 rounded-lg border-2 border-[#121117] bg-[#2b6df0] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#2260e4]"
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
          className="absolute end-1 top-1 grid h-11 w-11 place-items-center rounded-full text-[#4b4a5c] transition-colors hover:bg-black/5 hover:text-[#121117]"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
