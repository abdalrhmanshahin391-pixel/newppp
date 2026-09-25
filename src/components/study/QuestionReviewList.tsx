import { Check, Trash2 } from "lucide-react";
import type { StudyQuestion } from "@/lib/use-study-questions";

type Draft = Omit<StudyQuestion, "id"> & { id?: string };

/** Compact review card list: used for fresh drafts and for saved questions. */
export function QuestionReviewList({
  questions,
  onDelete,
  emptyNote,
}: {
  questions: Draft[];
  onDelete?: (index: number) => void;
  emptyNote?: string;
}) {
  if (questions.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-black/10 p-5 text-[13px] font-semibold text-[#b3aa9c]">
        {emptyNote ?? "Nothing here yet."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {questions.map((q, i) => (
        <article
          key={q.id ?? i}
          className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white p-4 pl-5"
        >
          <span className="absolute inset-y-0 left-0 w-1.5 bg-[#6ab887]" aria-hidden />
          <div className="flex items-start gap-3">
            <p className="flex-1 text-[14px] font-black leading-snug text-[#23201d]">{q.stem}</p>
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(i)}
                aria-label="Remove question"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[#a29a8d] transition-colors hover:bg-black/[0.06] hover:text-[#d1795e]"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
          <ul className="mt-3 flex flex-col gap-1.5">
            {q.options.map((o) => (
              <li
                key={o.letter}
                className={`flex items-start gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold ${
                  o.is_correct ? "bg-[#eaf6ee] text-[#215237]" : "bg-[#faf6ee] text-[#6d675e]"
                }`}
              >
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white text-[11px] font-black">
                  {o.is_correct ? <Check size={12} strokeWidth={3.5} /> : o.letter}
                </span>
                {o.body}
              </li>
            ))}
          </ul>
          {q.correct_explanation && (
            <p className="mt-3 border-t border-black/[0.06] pt-3 text-[12.5px] font-medium leading-relaxed text-[#6d675e]">
              {q.correct_explanation}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
