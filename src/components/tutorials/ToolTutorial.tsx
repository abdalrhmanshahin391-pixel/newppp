import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Languages, Lock, Sparkles } from "lucide-react";
import { ToolDemo } from "@/components/tutorials/ToolDemo";
import type { ToolDef } from "@/lib/site-tools";

export type TutorialLang = "en" | "ar";

export function LangSwitch({
  lang,
  onChange,
}: {
  lang: TutorialLang;
  onChange: (l: TutorialLang) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-black/[0.08] bg-white p-1">
      <Languages size={14} className="ml-2 text-[#a1957f]" />
      {(["en", "ar"] as TutorialLang[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          className={`rounded-full px-3 py-1 text-[12px] font-black uppercase tracking-[0.1em] transition-colors ${
            lang === l ? "bg-[#23201d] text-white" : "text-[#6b655c] hover:bg-black/[0.04]"
          }`}
        >
          {l === "en" ? "English" : "العربية"}
        </button>
      ))}
    </div>
  );
}

function getToolUrl(tool: ToolDef): string {
  if (tool.demo === "cards") return "ritajet.com/study/session";
  if (tool.demo === "qbank") return "ritajet.com/courses/question-bank";
  if (tool.demo === "match") return "ritajet.com/study/match";
  if (tool.demo === "summary") return "ritajet.com/study/pdf";
  if (tool.demo === "allinone") return "ritajet.com/study/all-in-one";
  if (tool.demo === "todo") return "ritajet.com/study/todo";
  if (tool.demo === "calendar") return "ritajet.com/study/exams";
  if (tool.demo === "lecture") return "ritajet.com/study/lectures";
  if (tool.demo === "share") return "ritajet.com/share";
  if (tool.demo === "spaces") return "ritajet.com/spaces";
  if (tool.demo === "german") return "ritajet.com/german";
  if (tool.demo === "timer") return "ritajet.com/study/timer";
  return `ritajet.com${tool.href}`;
}

/** The tutorial body: animated live browser demo + numbered steps, in the chosen language. */
export function ToolTutorial({
  tool,
  lang,
  onLang,
  showOpenLink = true,
  showLang = true,
}: {
  tool: ToolDef;
  lang: TutorialLang;
  onLang: (l: TutorialLang) => void;
  showOpenLink?: boolean;
  showLang?: boolean;
}) {
  const dir = lang === "ar" ? "rtl" : "ltr";
  const Icon = tool.icon;
  const isAr = lang === "ar";

  return (
    <div dir={dir} className={isAr ? "text-right" : undefined}>
      <div className="flex flex-wrap items-center gap-3" dir="ltr">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl shadow-xs"
          style={{ background: tool.soft, color: tool.ink }}
        >
          <Icon size={22} />
        </span>
        <div className="min-w-0">
          <div
            className="text-[10px] font-black uppercase tracking-[0.14em]"
            style={{ color: tool.ink }}
          >
            {tool.tag[lang]}
          </div>
          <h3 className="font-display text-[20px] font-black tracking-tight text-[#23201d]">
            {tool.name[lang]}
          </h3>
        </div>
        {showLang ? (
          <div className="ml-auto">
            <LangSwitch lang={lang} onChange={onLang} />
          </div>
        ) : null}
      </div>

      <p className="mt-3 text-[14.5px] leading-relaxed text-[#4a453d]">{tool.line[lang]}</p>

      {/* Mini-Browser Chrome Window */}
      <div className="mt-5 overflow-hidden rounded-[22px] border border-black/[0.12] bg-[#fbf5e9] shadow-md">
        {/* Browser Top Navigation Bar */}
        <div className="flex items-center justify-between border-b border-black/[0.08] bg-[#efe6d5]/90 px-4 py-2.5">
          {/* Traffic Light Window Buttons */}
          <div className="flex items-center gap-1.5" dir="ltr">
            <span className="h-3 w-3 rounded-full bg-[#ff5f56] border border-[#e0443e]/40" />
            <span className="h-3 w-3 rounded-full bg-[#ffbd2e] border border-[#dea123]/40" />
            <span className="h-3 w-3 rounded-full bg-[#27c93f] border border-[#1aab29]/40" />
          </div>

          {/* Realistic Address Bar */}
          <div
            className="mx-2 flex max-w-sm flex-1 items-center justify-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-3 py-1 text-[11.5px] font-bold text-[#5c5446] shadow-xs"
            dir="ltr"
          >
            <Lock size={11} className="text-emerald-600 shrink-0" />
            <span className="truncate">{getToolUrl(tool)}</span>
          </div>

          {/* Live Interactive Badge */}
          <div className="flex items-center gap-1.5" dir="ltr">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="hidden sm:inline text-[10px] font-black uppercase tracking-wider text-[#6e6350]">
              {isAr ? "معاينة حية وتفاعلية" : "Live interactive preview"}
            </span>
          </div>
        </div>

        {/* Demo Surface */}
        <div className="p-3.5 sm:p-4 bg-[#f8f3ea]">
          <ToolDemo tool={tool} lang={lang} />
        </div>
      </div>

      {/* Step by step guide */}
      <div className="mt-6">
        <div className="text-[11px] font-black uppercase tracking-[0.14em] text-[#a1957f]">
          {isAr ? "خطوات العمل بالتفصيل" : "How it works step-by-step"}
        </div>
        <ol className="mt-3 space-y-3">
          {tool.steps.map((s, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-xl border border-black/[0.05] bg-[#fbf5e9]/60 p-3 transition-colors hover:bg-white"
            >
              <span
                className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-black text-white shadow-xs"
                style={{ background: tool.ink }}
              >
                {i + 1}
              </span>
              <span className="text-[14px] font-bold leading-relaxed text-[#3a352e]">
                {s[lang]}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {showOpenLink ? (
        <Link
          to={tool.to}
          params={tool.params as never}
          className="mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-black text-white transition-all shadow-sm hover:opacity-90 active:scale-98"
          style={{ background: tool.ink }}
        >
          {tool.cta[lang]}
          <ArrowRight size={15} />
        </Link>
      ) : null}
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
