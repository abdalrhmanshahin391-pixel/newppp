import { useState } from "react";
import { Languages } from "lucide-react";

export type TutorialLang = "en" | "ar";

/** English / Arabic switch used by the in-page "How it works" tours. */
export function LangSwitch({
  lang,
  onChange,
}: {
  lang: TutorialLang;
  onChange: (l: TutorialLang) => void;
}) {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-lg bg-white p-1"
      style={{ border: "2px solid #121117" }}
    >
      <Languages size={14} className="ml-2" style={{ color: "#6a697c" }} aria-hidden="true" />
      {(["en", "ar"] as TutorialLang[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          aria-pressed={lang === l}
          className="rounded-md px-3 py-1 text-[12.5px] font-bold transition-colors"
          style={
            lang === l
              ? { background: "#ff7aac", color: "#121117" }
              : { background: "transparent", color: "#6a697c" }
          }
        >
          {l === "en" ? "English" : "العربية"}
        </button>
      ))}
    </div>
  );
}

/** Remembers the last chosen tutorial language for this browser. */
export function useTutorialLang(): [TutorialLang, (l: TutorialLang) => void] {
  const [lang, setLang] = useState<TutorialLang>(() => {
    if (typeof window === "undefined") return "en";
    try {
      return localStorage.getItem("rita-tutorial-lang") === "ar" ? "ar" : "en";
    } catch {
      return "en";
    }
  });
  return [
    lang,
    (l: TutorialLang) => {
      setLang(l);
      try {
        localStorage.setItem("rita-tutorial-lang", l);
      } catch {
        /* ignore */
      }
    },
  ];
}
