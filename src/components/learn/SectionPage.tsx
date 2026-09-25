import { ArrowLeft, Sparkles, Layers, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { SiteHeader } from "@/components/SiteHeader";
import { ToolCard } from "@/components/learn/ToolCard";
import {
  SECTION_FLAG,
  TOOL_FLAG,
  sectionOf,
  toolsOf,
  type SectionId,
} from "@/lib/site-tools";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useSiteText } from "@/hooks/useSiteText";

export function SectionPage({ id }: { id: SectionId }) {
  const s = sectionOf(id);
  const tools = toolsOf(id);
  const { enabled, badge } = useFeatureFlags();
  const { text } = useSiteText();
  const { i18n } = useTranslation();
  const isAr = (i18n.language ?? "").startsWith("ar");
  const sectionOff = !enabled(SECTION_FLAG(id));

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden" style={{ background: "#fbf5e9", color: "#23201d" }}>
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl min-w-0 overflow-x-hidden px-4 pb-24 pt-8 md:px-8 md:pt-12">
        <Link
          to="/learn"
          className="inline-flex items-center gap-2 text-[13px] font-extrabold text-[#7a6f5f] hover:text-[#23201d]"
        >
          <ArrowLeft size={15} /> All rooms
        </Link>

        <div className="mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <h1 className="font-display text-[32px] font-black leading-[1.05] tracking-tight md:text-[42px]">
            {text(`rj.section.${id}.title`, s.title)}
          </h1>
          {badge(SECTION_FLAG(id)) ? (
            <span className="rounded-full bg-[#23201d] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-white">
              {badge(SECTION_FLAG(id))}
            </span>
          ) : null}
        </div>
        <p className="mt-3 max-w-2xl text-[15.5px] leading-relaxed text-[#6b655c]">{text(`rj.section.${id}.intro`, s.intro)}</p>

        {sectionOff ? (
          <div className="mt-8 rounded-3xl border border-black/[0.07] bg-white p-6 text-[15px] font-semibold text-[#6b655c]">
            This room is closed right now. {badge(SECTION_FLAG(id)) ?? "Check back soon."}
          </div>
        ) : null}

        <div
          className={`mt-8 grid w-full max-w-full min-w-0 gap-6 ${s.columns.length > 1 ? "lg:grid-cols-2" : "grid-cols-1"}`}
        >
          {s.columns.map((col) => {
            const list = tools.filter((t) => t.column === col.id);
            if (list.length === 0) return null;
            const isAi = col.id === "ai";
            const isNoAi = col.id === "no-ai";

            return (
              <section
                key={col.id}
                className="w-full max-w-full min-w-0 overflow-hidden rounded-[28px] border border-black/[0.08] bg-white/75 p-5 md:p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-black/[0.07]">
                  {isAi ? (
                    <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#6e2fa6] to-[#4c217f] px-4 py-1.5 text-white shadow-[0_4px_14px_rgba(110,47,166,0.32)]">
                      <Sparkles size={15} className="text-amber-300 animate-pulse" />
                      <h2 className="text-[13px] font-black uppercase tracking-[0.14em]">
                        {isAr ? col.label.ar : col.label.en}
                      </h2>
                    </div>
                  ) : isNoAi ? (
                    <div className="inline-flex items-center gap-2 rounded-full bg-[#2a241d] px-4 py-1.5 text-[#fbf5e9] shadow-[0_4px_14px_rgba(42,36,29,0.25)]">
                      <Layers size={15} className="text-[#e8af61]" />
                      <h2 className="text-[13px] font-black uppercase tracking-[0.14em]">
                        {isAr ? col.label.ar : col.label.en}
                      </h2>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 rounded-full bg-[#1b4332] px-4 py-1.5 text-white shadow-[0_4px_14px_rgba(27,67,50,0.25)]">
                      <Users size={15} className="text-[#74c69d]" />
                      <h2 className="text-[13px] font-black uppercase tracking-[0.14em]">
                        {isAr ? col.label.ar : col.label.en}
                      </h2>
                    </div>
                  )}
                  <p className={`text-[13.5px] font-bold ${isAi ? "text-[#6e2fa6]" : isNoAi ? "text-[#5e5344]" : "text-[#2d6a4f]"}`}>
                    {isAr ? col.note.ar : col.note.en}
                  </p>
                </div>
                <div className="mt-5 grid w-full max-w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                  {list.map((t) => (
                    <ToolCard
                      key={t.key}
                      tool={t}
                      badge={badge(TOOL_FLAG(t.key))}
                      locked={sectionOff || !enabled(TOOL_FLAG(t.key))}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
