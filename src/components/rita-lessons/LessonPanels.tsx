import { Link } from "@tanstack/react-router";
import { Check, Loader2, RotateCcw } from "lucide-react";
import type { ObjectiveState } from "@/lib/rita-curriculum";
import type { LessonSession } from "@/lib/rita-curriculum.functions";
import { LessonImage, LessonStars } from "./LessonArt";

/** The lesson's goals, ticked off as the learner shows each one. */
export function LessonObjectivesPanel({
  session,
  objectives,
  score,
  checking,
  justMet,
}: {
  session: LessonSession;
  objectives: ObjectiveState;
  score: number;
  checking: boolean;
  justMet: string[];
}) {
  const goals = session.lesson.objectives;
  const met = goals.filter((goal) => objectives[goal.id]?.met).length;
  return (
    <section dir="rtl" className="rounded-3xl border border-[#EEE8FB] bg-[#FBFAFF] p-4">
      <div className="flex items-center gap-3">
        <LessonImage
          src={session.lesson.image_url}
          alt=""
          className="h-14 w-14 shrink-0 border-2 border-white shadow"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold text-[#9B5CF6]">درس اليوم</p>
          <h2 className="truncate text-lg font-black">
            {session.lesson.title_ar || session.lesson.title}
          </h2>
          <p className="truncate text-xs font-semibold text-[#6B6F86]" dir="ltr">
            {session.lesson.title}
          </p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-black text-[#6D35D8]">
            {met}/{goals.length}
          </p>
          <p className="text-[10px] font-bold text-[#8A8FA3]">أهداف</p>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#ECE6FA]">
        <div
          className="h-full rounded-full bg-[#9B5CF6] transition-all duration-500"
          style={{ width: `${goals.length ? (met / goals.length) * 100 : 0}%` }}
        />
      </div>
      <ul className="mt-3 space-y-2">
        {goals.map((goal) => {
          const done = objectives[goal.id]?.met === true;
          const fresh = justMet.includes(goal.id);
          return (
            <li
              key={goal.id}
              className={`flex items-start gap-2 rounded-2xl px-3 py-2 text-sm transition-colors ${
                done ? "bg-[#EAF8EF]" : "bg-white"
              } ${fresh ? "ring-2 ring-[#48C774]" : ""}`}
            >
              <span
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                  done ? "bg-[#48C774] text-white" : "border-2 border-[#D9DCE6]"
                }`}
              >
                {done && <Check size={13} strokeWidth={3} />}
              </span>
              <span className="min-w-0">
                <span className="block font-bold">{goal.text_ar || goal.text}</span>
                {goal.text_ar && (
                  <span className="block text-xs text-[#6B6F86]" dir="ltr">
                    {goal.text}
                  </span>
                )}
                {done && objectives[goal.id]?.evidence && (
                  <span className="mt-0.5 block text-xs italic text-[#2F8F55]" dir="ltr">
                    “{objectives[goal.id].evidence}”
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 flex items-center gap-1.5 text-xs font-bold text-[#8A8FA3]">
        {checking && <Loader2 size={12} className="animate-spin" />}
        {checking ? "ريتا تراجع إجابتك…" : `النتيجة حتى الآن: ${score}%`}
      </p>
    </section>
  );
}

/** Shown when every objective is met: score, stars and the way forward. */
export function LessonResultCard({
  score,
  stars,
  nextLessonId,
  onRetry,
  onClose,
}: {
  score: number;
  stars: number;
  nextLessonId: string | null;
  onRetry: () => void;
  onClose: () => void;
}) {
  const praise =
    stars === 3 ? "ممتاز!" : stars === 2 ? "عمل رائع!" : stars === 1 ? "أحسنت!" : "أكملت الدرس!";
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#1E2A4A]/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <section
        dir="rtl"
        className="w-full max-w-sm rounded-[28px] bg-white p-6 text-center shadow-2xl"
      >
        <LessonStars stars={stars} size={44} />
        <h2 className="mt-3 text-3xl font-black text-[#1E2A4A]">{praise}</h2>
        <p className="mt-1 font-bold text-[#6B6F86]">حققت كل أهداف الدرس</p>
        <p className="mt-4 text-5xl font-black text-[#6D35D8]">{score}%</p>
        <div className="mt-6 space-y-2">
          {nextLessonId ? (
            <Link
              to="/rita-live"
              search={{ lesson: nextLessonId }}
              className="block rounded-2xl bg-[#9B5CF6] py-3.5 text-lg font-black text-white shadow-[0_5px_0_#6D35D8]"
              onClick={onClose}
            >
              الدرس التالي
            </Link>
          ) : (
            <p className="rounded-2xl bg-[#F4EFFE] py-3 text-sm font-bold text-[#6D35D8]">
              أنهيت كل الدروس المتاحة 🎉
            </p>
          )}
          <Link
            to="/rita-lessons"
            className="block rounded-2xl border-2 border-[#EEE8FB] py-3 font-black text-[#6D35D8]"
            onClick={onClose}
          >
            العودة إلى المسار
          </Link>
          <button
            type="button"
            onClick={onRetry}
            className="flex w-full items-center justify-center gap-1.5 py-2 text-sm font-bold text-[#8A8FA3]"
          >
            <RotateCcw size={14} /> أعد الدرس لتحسين نتيجتك
          </button>
        </div>
      </section>
    </div>
  );
}
