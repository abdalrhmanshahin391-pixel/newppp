import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Loader2, Lock, Medal, Star } from "lucide-react";
import type { PathLesson } from "@/lib/rita-curriculum.functions";
import { LessonImage, LessonStars } from "./LessonArt";

// Horizontal offsets that make the path zig-zag, as in the lesson map design.
const ZIGZAG = [0, 70, 100, 70, 0, -70, -100, -70];
const ROW = 178;
const WIDTH = 340;
const NODE = 104;

function UkFlag() {
  return (
    <svg
      viewBox="0 0 60 40"
      className="h-6 w-9 overflow-hidden rounded-md shadow-sm"
      aria-label="English"
    >
      <rect width="60" height="40" fill="#1F3F8F" />
      <path d="M0 0l60 40M60 0L0 40" stroke="#fff" strokeWidth="8" />
      <path d="M0 0l60 40M60 0L0 40" stroke="#D7263D" strokeWidth="3" />
      <path d="M30 0v40M0 20h60" stroke="#fff" strokeWidth="12" />
      <path d="M30 0v40M0 20h60" stroke="#D7263D" strokeWidth="7" />
    </svg>
  );
}

/** The lesson map: a zig-zag path of round lesson pictures with stars. */
export function LessonPathView({
  lessons,
  error,
  onOpenLesson,
}: {
  lessons: PathLesson[] | null;
  error: string;
  onOpenLesson: (lesson: PathLesson) => void;
}) {
  const [hint, setHint] = useState("");

  const current = lessons?.find((lesson) => lesson.state === "current");
  const totalStars = lessons?.reduce((sum, lesson) => sum + lesson.stars, 0) ?? 0;
  const completed = lessons?.filter((lesson) => lesson.state === "done").length ?? 0;

  function open(lesson: PathLesson) {
    if (lesson.state === "locked") {
      setHint("أكمل الدرس الحالي أولاً لفتح هذا الدرس.");
      return;
    }
    onOpenLesson(lesson);
  }

  const centres = (lessons ?? []).map((_, index) => ({
    x: WIDTH / 2 + ZIGZAG[index % ZIGZAG.length],
    y: index * ROW + 34 + NODE / 2,
  }));
  const pathD = centres
    .slice(1)
    .map((point, index) => {
      const from = centres[index];
      const midY = (from.y + point.y) / 2;
      return `M${from.x} ${from.y} C${from.x} ${midY} ${point.x} ${midY} ${point.x} ${point.y}`;
    })
    .join(" ");

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#FBFAFF] pb-32 font-[Nunito,'Noto_Sans_Arabic',sans-serif] text-[#1E2A4A]"
    >
      <header className="sticky top-0 z-20 border-b border-[#EEE8FB] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <Link
            to="/"
            aria-label="رجوع"
            className="grid h-10 w-10 place-items-center rounded-full text-[#8A8FA3] hover:bg-[#F4EFFE]"
          >
            <ArrowRight size={22} />
          </Link>
          <div className="flex items-center gap-4 text-sm font-black">
            <UkFlag />
            <span className="flex items-center gap-1 text-[#E8A400]">
              <Star size={20} fill="#FFC83D" strokeWidth={1.5} /> {totalStars}
            </span>
            <span className="flex items-center gap-1 text-[#9B5CF6]">
              <Medal size={20} /> {completed}
            </span>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-md px-4 pt-6 text-center">
        <p className="text-sm font-extrabold text-[#9B5CF6]">English · A1</p>
        <h1 className="mt-1 text-2xl font-black">دروسك مع ريتا</h1>
        <p className="mt-1 text-sm font-semibold text-[#6B6F86]">
          تحدّث مع ريتا، حقّق أهداف كل درس، واجمع النجوم.
        </p>
      </section>

      {error && (
        <p className="mx-auto mt-6 max-w-md rounded-2xl bg-red-50 px-4 py-3 text-center text-sm font-bold text-red-700">
          {error}
        </p>
      )}
      {!lessons && !error && (
        <div className="grid place-items-center py-24 text-[#9B5CF6]">
          <Loader2 className="animate-spin" />
        </div>
      )}
      {lessons && lessons.length === 0 && (
        <p className="mx-auto mt-16 max-w-xs text-center font-bold text-[#8A8FA3]">
          لا توجد دروس منشورة بعد. عُد قريباً!
        </p>
      )}

      {lessons && lessons.length > 0 && (
        <div
          className="relative mx-auto mt-6"
          style={{ width: WIDTH, height: lessons.length * ROW + 40 }}
        >
          <svg
            className="pointer-events-none absolute inset-0"
            width={WIDTH}
            height={lessons.length * ROW + 40}
            aria-hidden="true"
          >
            <path
              d={pathD}
              fill="none"
              stroke="#D9CFF5"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray="0.1 14"
            />
          </svg>
          {lessons.map((lesson, index) => {
            const centre = centres[index];
            const locked = lesson.state === "locked";
            const isCurrent = lesson.state === "current";
            return (
              <button
                key={lesson.id}
                type="button"
                onClick={() => open(lesson)}
                className="absolute flex w-[150px] flex-col items-center text-center"
                style={{ left: centre.x - 75, top: index * ROW }}
                aria-label={`${lesson.title_ar || lesson.title}${locked ? " (مقفل)" : ""}`}
              >
                <LessonStars stars={lesson.stars} />
                <span className="relative mt-1 block" style={{ width: NODE, height: NODE }}>
                  {isCurrent && (
                    <span className="absolute -inset-2 animate-pulse rounded-full bg-[#C9A7FF]/40" />
                  )}
                  {/* Solid backing so the dotted path never shows through a faded node. */}
                  <span className="absolute inset-0 rounded-full bg-[#FBFAFF]" />
                  <LessonImage
                    src={lesson.image_url}
                    alt=""
                    className={`relative h-full w-full border-4 shadow-[0_6px_0_#E6E1F5] ${
                      isCurrent ? "border-[#7B3FE4]" : "border-white"
                    } ${locked ? "opacity-60 grayscale-[0.85]" : ""}`}
                  />
                  {locked && (
                    <span className="absolute bottom-0 left-0 grid h-8 w-8 place-items-center rounded-full bg-white text-[#8A8FA3] shadow">
                      <Lock size={15} />
                    </span>
                  )}
                  <span
                    className={`absolute -top-1 right-0 rounded-full px-2 py-0.5 text-[10px] font-black text-white ${
                      lesson.kind === "vocabulary" ? "bg-[#3BA7FF]" : "bg-[#FF6FA8]"
                    }`}
                  >
                    {lesson.kind === "vocabulary" ? "كلمات" : "قواعد"}
                  </span>
                </span>
                <span
                  className={`mt-2 text-[15px] font-black leading-5 ${locked ? "text-[#A3A7BA]" : ""}`}
                >
                  {lesson.title_ar || lesson.title}
                </span>
                {lesson.in_progress && !locked && (
                  <span className="mt-1 text-[11px] font-extrabold text-[#9B5CF6]">
                    قيد التقدّم
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {hint && (
        <p
          className="fixed inset-x-4 bottom-28 z-30 mx-auto max-w-sm rounded-2xl bg-[#1E2A4A] px-4 py-3 text-center text-sm font-bold text-white"
          onClick={() => setHint("")}
        >
          {hint}
        </p>
      )}

      {current && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#EEE8FB] bg-white/95 px-4 py-4 backdrop-blur">
          <button
            type="button"
            onClick={() => open(current)}
            className="mx-auto block w-full max-w-md rounded-2xl bg-[#9B5CF6] py-4 text-lg font-black text-white shadow-[0_5px_0_#6D35D8] active:translate-y-1 active:shadow-none"
          >
            متابعة
          </button>
        </div>
      )}
    </main>
  );
}
