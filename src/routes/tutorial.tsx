import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import {
  LangSwitch,
  ToolTutorial,
  useTutorialLang,
} from "@/components/tutorials/ToolTutorial";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useSiteText } from "@/hooks/useSiteText";
import {
  SECTIONS,
  SECTION_FLAG,
  TOOL_FLAG,
  TOOLS,
  toolsOf,
  type ToolDef,
} from "@/lib/site-tools";

export const Route = createFileRoute("/tutorial")({
  head: () => ({
    meta: [
      { title: "Tutorial — How every RitaJet tool works" },
      {
        name: "description",
        content:
          "A full tutorial for every RitaJet study tool with short animations and step-by-step explanations in English or Arabic.",
      },
      { property: "og:title", content: "Tutorial — How every RitaJet tool works" },
      {
        property: "og:description",
        content: "Watch how each RitaJet study tool works, in English or Arabic.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TutorialPage,
});

function TutorialPage() {
  const [lang, setLang] = useTutorialLang();
  const { enabled, badge } = useFeatureFlags();
  const { text } = useSiteText();
  const [active, setActive] = useState<ToolDef>(TOOLS[0]!);

  return (
    <div className="min-h-screen" style={{ background: "#fbf5e9", color: "#23201d" }}>
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 md:px-8 md:pt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#2f7d55]">
              {text("rj.tutorial.eyebrow", { en: "RitaJet tutorial", ar: "دليل استخدام ريتاجت" }, lang)}
            </div>
            <h1 className="mt-2 font-display text-[32px] font-black leading-[1.05] tracking-tight md:text-[42px]">
              {text("rj.tutorial.title", { en: "How every tool works", ar: "كيف تعمل كل أداة" }, lang)}
            </h1>
            <p className="mt-3 max-w-2xl text-[15.5px] leading-relaxed text-[#6b655c]">
              {text(
                "rj.tutorial.intro",
                {
                  en: "Pick any tool on the left to watch a short animation and read the steps for using it.",
                  ar: "اختر أي أداة من القائمة لترى رسمًا متحركًا قصيرًا وخطوات واضحة لطريقة استخدامها.",
                },
                lang,
              )}
            </p>
          </div>
          <LangSwitch lang={lang} onChange={setLang} />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <nav className="space-y-5" dir={lang === "ar" ? "rtl" : "ltr"}>
            {SECTIONS.filter((s) => enabled(SECTION_FLAG(s.key))).map((s) => (
              <div key={s.key}>
                <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-[#a1957f]">
                  {text(`rj.section.${s.key}.title`, s.title, lang)}
                </h2>
                <ul className="mt-2 space-y-1.5">
                  {toolsOf(s.key)
                    .filter((t) => enabled(TOOL_FLAG(t.key)))
                    .map((t) => {
                      const on = active.key === t.key;
                      const Icon = t.icon;
                      return (
                        <li key={t.key}>
                          <button
                            type="button"
                            onClick={() => setActive(t)}
                            className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                              on
                                ? "border-[#2f7d55]/25 bg-white shadow-sm"
                                : "border-transparent hover:bg-white/70"
                            }`}
                          >
                            <span
                              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                              style={{ background: t.soft, color: t.ink }}
                            >
                              <Icon size={16} />
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[13.5px] font-black text-[#23201d]">
                              {t.name[lang]}
                            </span>
                            {badge(TOOL_FLAG(t.key), lang) ? (
                              <span className="rounded-full bg-[#23201d] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-white">
                                {badge(TOOL_FLAG(t.key), lang)}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </nav>

          <section className="rounded-[28px] border border-[#2f7d55]/15 bg-white p-5 shadow-[0_20px_50px_-40px_rgba(0,0,0,0.5)] md:p-7">
            <ToolTutorial tool={active} lang={lang} onLang={setLang} showLang={false} />
          </section>
        </div>
      </main>
    </div>
  );
}
