import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getLessonPath, type PathLesson } from "@/lib/rita-curriculum.functions";
import { ProHeader } from "@/components/home/procreate/ProHeader";
import { LessonImage } from "@/components/rita-lessons/LessonArt";

/** A still pink orb in the same colours as the live voice orb. No WebGL needed on this page. */
function OrbPreview() {
  return (
    <div className="relative grid h-36 w-36 place-items-center sm:h-44 sm:w-44" aria-hidden="true">
      <div
        className="absolute inset-0 rounded-full opacity-80 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(circle, rgba(255,150,190,0.55) 0%, rgba(255,179,207,0.18) 45%, rgba(255,179,207,0) 70%)",
        }}
      />
      <div
        className="relative h-3/5 w-3/5 rounded-full shadow-[0_18px_40px_-18px_rgba(209,61,118,0.7)] transition-transform duration-300 group-hover:scale-105"
        style={{
          background:
            "radial-gradient(circle at 36% 30%, #fff 0%, #ffd1e2 26%, #ff7aac 62%, #dc4d80 100%)",
        }}
      />
    </div>
  );
}

const PREVIEW_PICTURES = ["hello", "to-be", "me-and-you"];

function LessonsPreview({ pictures }: { pictures: (string | null)[] }) {
  return (
    <div className="flex h-36 items-center justify-center sm:h-44" aria-hidden="true">
      <div className="flex -space-x-5">
        {pictures.map((src, index) => (
          <LessonImage
            key={index}
            src={src}
            alt=""
            className={`h-20 w-20 border-4 border-[var(--pp-grey)] shadow-[0_6px_0_var(--pp-line)] transition-transform duration-300 sm:h-24 sm:w-24 ${
              index === 1
                ? "z-10 -translate-y-3 group-hover:-translate-y-5"
                : "group-hover:-translate-y-1"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function Card({
  to,
  search,
  visual,
  eyebrow,
  title,
  titleAr,
  text,
  detail,
  action,
}: {
  to: "/rita-live" | "/rita-lessons";
  search?: { lesson?: string };
  visual: React.ReactNode;
  eyebrow: string;
  title: string;
  titleAr: string;
  text: string;
  detail?: React.ReactNode;
  action: string;
}) {
  return (
    <Link
      to={to}
      search={search as never}
      className="group flex flex-col rounded-2xl bg-[var(--pp-grey)] p-6 outline-none transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_24px_48px_-32px_rgba(18,17,23,0.5)] focus-visible:ring-2 focus-visible:ring-[var(--pp-ink)] focus-visible:ring-offset-4 sm:p-8"
    >
      <div className="flex justify-center">{visual}</div>
      <p className="mt-2 text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--pp-muted)]">
        {eyebrow}
      </p>
      <h3 className="mt-2 flex flex-wrap items-baseline gap-x-3 text-[28px] leading-[32px] text-[var(--pp-ink)]">
        {title}
        <span lang="ar" className="text-[18px] font-semibold text-[var(--pp-muted)]">
          {titleAr}
        </span>
      </h3>
      <p className="mt-3 text-[17px] leading-7 text-[var(--pp-muted)]">{text}</p>
      <div className="mt-4 min-h-[24px] text-[15px] font-semibold text-[var(--pp-ink)]">
        {detail}
      </div>
      <div className="mt-auto pt-5">
        <span className="rita-btn rita-btn-primary gap-2">
          {action}
          <ArrowRight
            size={18}
            className="transition-transform duration-300 group-hover:translate-x-1"
          />
        </span>
      </div>
    </Link>
  );
}

/** Where learners choose between a free conversation and the lessons. */
export function RitaHub() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const pathFn = useServerFn(getLessonPath);
  const [lessons, setLessons] = useState<PathLesson[] | null | "none">(null);

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/login" });
  }, [loading, navigate, user]);

  useEffect(() => {
    if (!user) return;
    // Progress is a nicety: if the lessons are not set up yet the card simply has no progress line.
    pathFn()
      .then((result) => setLessons(result.lessons))
      .catch(() => setLessons("none"));
  }, [pathFn, user]);

  const list = Array.isArray(lessons) ? lessons : [];
  const done = list.filter((lesson) => lesson.state === "done").length;
  const current = list.find((lesson) => lesson.state === "current");
  const pictures = list.length
    ? list.slice(0, 3).map((lesson) => lesson.image_url)
    : PREVIEW_PICTURES.map((key) => `/curriculum/${key}.svg`);

  return (
    <main
      className="edith-premium min-h-screen bg-white text-[var(--pp-ink)]"
      style={{ fontFamily: "var(--font-grotesk), 'Noto Sans Arabic', sans-serif" }}
    >
      <div className="rita-cream edith-light edith-premium">
        <ProHeader variant="solid" tone="light" />
      </div>

      <section className="mx-auto w-full max-w-5xl px-5 pb-16 pt-10 sm:px-8 sm:pt-12">
        <div className="max-w-3xl">
          <p className="text-[13px] font-bold uppercase tracking-[0.18em] text-[var(--pp-muted)]">
            Rita
          </p>
          <h2 className="mt-3 text-[36px] leading-[40px] sm:text-[48px] sm:leading-[52px]">
            What would you like to do today?
          </h2>
          <p lang="ar" className="mt-3 text-[20px] font-semibold text-[var(--pp-muted)]">
            ماذا تريد أن تفعل اليوم؟
          </p>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Card
            to="/rita-live"
            visual={<OrbPreview />}
            eyebrow="Open practice"
            title="Free conversation"
            titleAr="محادثة حرة"
            text="Talk to Rita about anything. She listens, answers out loud and gently corrects you as you go."
            action="Start talking"
          />
          <Card
            to="/rita-lessons"
            visual={<LessonsPreview pictures={pictures} />}
            eyebrow="Guided path"
            title="Lessons"
            titleAr="الدروس"
            text="Short lessons with clear goals. Rita teaches, asks you questions and gives you stars when you reach each goal."
            detail={
              lessons === null ? (
                <Loader2 size={16} className="animate-spin text-[var(--pp-muted)]" />
              ) : list.length ? (
                <span>
                  {done} of {list.length} completed
                  {current ? (
                    <span className="font-medium text-[var(--pp-muted)]"> · Next: </span>
                  ) : null}
                  {current ? (
                    <span lang="ar" className="font-semibold">
                      {current.title_ar || current.title}
                    </span>
                  ) : null}
                </span>
              ) : null
            }
            action={done > 0 ? "Continue" : "Open lessons"}
          />
        </div>
      </section>
    </main>
  );
}
