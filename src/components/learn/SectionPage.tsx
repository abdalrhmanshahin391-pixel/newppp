import { ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { SiteHeader } from "@/components/SiteHeader";
import { ToolCard } from "@/components/learn/ToolCard";
import { SECTION_FLAG, TOOL_FLAG, sectionOf, toolsOf, type SectionId } from "@/lib/site-tools";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useSiteText } from "@/hooks/useSiteText";

/** A room: its title, then one grey panel per column of tools. */
export function SectionPage({ id }: { id: SectionId }) {
  const s = sectionOf(id);
  const tools = toolsOf(id);
  const { enabled, badge } = useFeatureFlags();
  const { text } = useSiteText();
  const { i18n } = useTranslation();
  const isAr = (i18n.language ?? "").startsWith("ar");
  const sectionOff = !enabled(SECTION_FLAG(id));
  const sectionBadge = badge(SECTION_FLAG(id));

  return (
    <div
      className="edith-premium min-h-screen w-full max-w-full overflow-x-hidden bg-white text-[var(--pp-ink)]"
      style={{ fontFamily: "var(--font-grotesk)" }}
    >
      <SiteHeader />

      <main className="mx-auto w-full min-w-0 max-w-[1180px] px-5 pb-24 pt-10 md:px-10 md:pt-14">
        <Link to="/learn" className="rh-back">
          <ArrowLeft size={16} aria-hidden="true" className="rtl:rotate-180" /> All rooms
        </Link>

        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="font-bold tracking-[-0.035em]">
            {text(`rj.section.${id}.title`, s.title)}
          </h1>
          {sectionBadge ? <span className="rh-flag">{sectionBadge}</span> : null}
        </div>
        <p className="mt-4 max-w-[36rem] text-[17px] leading-[1.6] text-[var(--pp-muted)] md:text-[19px]">
          {text(`rj.section.${id}.intro`, s.intro)}
        </p>

        {sectionOff ? (
          <div
            className="mt-8 rounded-2xl p-6 text-[16px] font-semibold"
            style={{ background: "var(--pp-grey)" }}
          >
            This room is closed right now. {sectionBadge ?? "Check back soon."}
          </div>
        ) : null}

        <div className="mt-10 grid w-full min-w-0 gap-6">
          {s.columns.map((col) => {
            const list = tools.filter((t) => t.column === col.id);
            if (list.length === 0) return null;
            const isAi = col.id === "ai";
            const headingId = `col-${id}-${col.id}`;

            return (
              <section
                key={col.id}
                aria-labelledby={headingId}
                className="w-full min-w-0 rounded-[24px] p-5 md:p-8"
                style={{ background: "var(--pp-grey)" }}
              >
                <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
                  <h2
                    id={headingId}
                    className="flex items-center gap-3 text-[26px] font-bold tracking-[-0.02em]"
                  >
                    {isAr ? col.label.ar : col.label.en}
                    {isAi ? <span className="rh-flag rh-flag-pink">AI</span> : null}
                  </h2>
                  <p className="text-[15px] text-[var(--pp-muted)]">
                    {isAr ? col.note.ar : col.note.en}
                  </p>
                </div>
                <div className="mt-6 grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
