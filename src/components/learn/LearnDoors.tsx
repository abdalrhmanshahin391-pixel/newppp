import { ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SECTIONS, SECTION_FLAG } from "@/lib/site-tools";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useSiteText } from "@/hooks/useSiteText";
import roomStudySpace from "@/assets/room-study-space.jpg";
import roomStudyRoom from "@/assets/room-study-room.jpg";
import roomGerman from "@/assets/room-german.jpg";

const ROOM_ART: Record<string, string> = {
  "study-space": roomStudySpace,
  "study-room": roomStudyRoom,
  german: roomGerman,
};

/** /learn — three doors, nothing else. */
export function LearnDoors() {
  const { enabled, badge } = useFeatureFlags();
  const { text } = useSiteText();

  return (
    <div className="min-h-screen" style={{ background: "#fbf5e9", color: "#23201d" }}>
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-10 md:px-8 md:pt-16">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#a1957f]">
          {text("rj.learn.eyebrow", { en: "Start learning", ar: "ابدأ التعلم" })}
        </p>
        <h1 className="mt-3 font-display text-[34px] font-black leading-[1.05] tracking-tight md:text-[46px]">
          {text("rj.learn.title", { en: "Where do you want to study today?", ar: "أين تريد الدراسة اليوم؟" })}
        </h1>
        <p className="mt-4 max-w-2xl text-[15.5px] leading-relaxed text-[#6b655c]">
          {text("rj.learn.intro", {
            en: "Pick one of the three rooms. Every tool lives inside one of them.",
            ar: "اختر إحدى الغرف الثلاث. كل أداة تعيش داخل واحدة منها.",
          })}
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {SECTIONS.map((s) => {
            const off = !enabled(SECTION_FLAG(s.key));
            const chip = badge(SECTION_FLAG(s.key));

            const inner = (
              <>
                <img
                  src={ROOM_ART[s.key]}
                  alt=""
                  loading="lazy"
                  width={1024}
                  height={1024}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/5" />

                {chip ? (
                  <span className="absolute right-4 top-4 rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-[#23201d]">
                    {chip}
                  </span>
                ) : null}

                <div className="relative mt-auto p-6">
                  <h2 className="font-display text-[25px] font-black tracking-tight text-white">
                    {text(`rj.section.${s.key}.title`, s.title)}
                  </h2>
                  <p className="mt-1.5 text-[13.5px] leading-snug text-white/85">
                    {text(`rj.section.${s.key}.intro`, s.intro)}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-2 text-[13.5px] font-extrabold text-white">
                    {off ? "Coming soon" : "Open this room"}
                    {!off && (
                      <ArrowRight
                        size={16}
                        className="transition-transform duration-300 group-hover:translate-x-1"
                      />
                    )}
                  </span>
                </div>
              </>
            );

            const shell =
              "group relative flex aspect-square flex-col overflow-hidden rounded-[28px] border border-black/[0.07] transition-all duration-300";

            return off ? (
              <div key={s.key} className={`${shell} opacity-60`}>
                {inner}
              </div>
            ) : (
              <Link
                key={s.key}
                to={s.to}
                className={`${shell} hover:-translate-y-2 hover:shadow-[0_28px_54px_-28px_rgba(0,0,0,0.28)]`}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
