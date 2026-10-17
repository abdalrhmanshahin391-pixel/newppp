import { ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SECTIONS, SECTION_FLAG, toolsOf, type SectionDef } from "@/lib/site-tools";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useSiteText } from "@/hooks/useSiteText";

/** Where each room sits in the grid and how it looks: one dark, one grey, one wide and white. */
const LOOK: Record<
  SectionDef["key"],
  { span: string; className: string; dark?: boolean; wide?: boolean }
> = {
  "study-space": { span: "md:col-span-4", className: "rh-room-dark", dark: true },
  "study-room": { span: "md:col-span-2", className: "rh-room-grey" },
  german: { span: "md:col-span-6", className: "rh-room-white", wide: true },
};

/** /learn: three rooms, nothing else. */
export function LearnDoors() {
  const { enabled, badge } = useFeatureFlags();
  const { text } = useSiteText();

  return (
    <div
      className="edith-premium min-h-screen bg-white text-[var(--pp-ink)]"
      style={{ fontFamily: "var(--font-grotesk)" }}
    >
      <SiteHeader />

      <main className="mx-auto max-w-[1180px] px-5 pb-24 pt-12 md:px-10 md:pt-20">
        <h1 className="max-w-[16ch] font-bold tracking-[-0.035em]">
          {text("rj.learn.title", {
            en: "Where do you want to study today?",
            ar: "أين تريد الدراسة اليوم؟",
          })}
        </h1>
        <svg
          aria-hidden="true"
          viewBox="0 0 400 22"
          preserveAspectRatio="none"
          className="mt-3 h-[14px] w-[150px]"
        >
          <path
            d="M4 15 C 70 3, 130 20, 200 11 S 330 5, 396 13"
            fill="none"
            stroke="var(--pp-accent)"
            strokeWidth="7"
            strokeLinecap="round"
          />
        </svg>
        <p className="mt-5 max-w-[34rem] text-[17px] leading-[1.6] text-[var(--pp-muted)] md:text-[19px]">
          {text("rj.learn.intro", {
            en: "Pick one of the three rooms. Every tool lives inside one of them.",
            ar: "اختر إحدى الغرف الثلاث. كل أداة تعيش داخل واحدة منها.",
          })}
        </p>

        <div className="mt-10 grid gap-5 md:mt-12 md:grid-cols-6">
          {SECTIONS.map((s) => {
            const off = !enabled(SECTION_FLAG(s.key));
            const chip = badge(SECTION_FLAG(s.key));
            const look = LOOK[s.key];
            const Icon = s.icon;
            const tools = toolsOf(s.key);

            const inner = (
              <>
                <div
                  className={`flex ${look.wide ? "flex-col gap-6 md:flex-row md:items-end md:justify-between" : "h-full flex-col"}`}
                >
                  <div className={look.wide ? "md:max-w-[26rem]" : ""}>
                    <div className="flex items-center justify-between gap-3">
                      <Icon size={30} strokeWidth={2} aria-hidden="true" />
                      {chip ? <span className="rh-flag">{chip}</span> : null}
                    </div>
                    <h2 className="mt-6 text-[30px] font-bold leading-[1.08] tracking-[-0.03em] md:text-[38px]">
                      {text(`rj.section.${s.key}.title`, s.title)}
                    </h2>
                    <p className="rh-room-text mt-3 text-[16px] leading-[1.55]">
                      {text(`rj.section.${s.key}.intro`, s.intro)}
                    </p>
                  </div>

                  <div className={look.wide ? "md:max-w-[28rem]" : "mt-auto pt-6"}>
                    <ul className="flex flex-wrap gap-2">
                      {tools.slice(0, look.wide ? 6 : 5).map((tool) => (
                        <li key={tool.key} className="rh-minichip">
                          {tool.name.en}
                        </li>
                      ))}
                    </ul>
                    <span className="rh-open mt-6">
                      {off ? "Coming soon" : "Open room"}
                      {!off && (
                        <ArrowRight size={17} aria-hidden="true" className="rtl:rotate-180" />
                      )}
                    </span>
                  </div>
                </div>
              </>
            );

            const shell = `rh-room ${look.className} ${look.span}`;

            return off ? (
              <div key={s.key} className={`${shell} rh-room-off`}>
                {inner}
              </div>
            ) : (
              <Link key={s.key} to={s.to} className={shell}>
                {inner}
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
