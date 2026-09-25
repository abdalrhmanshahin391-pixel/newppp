import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { addDays, dayLabel, today, type Task } from "@/lib/todo-store";
import type { Parsed } from "@/lib/todo-nlp";
import { QuickAdd } from "./TodoQuickAdd";

/** Days added per scroll batch — about a month and a half at a time. */
const PAGE = 45;



/**
 * Upcoming, Todoist-shaped: one section per day — today included, so Today's
 * tasks live in the very same list — with overdue pinned above and further
 * days streaming in as you scroll.
 */

export function TodoUpcoming({
  byDay,
  overdue = [],
  renderRow,
  onAdd,
  onDropTask,
  onRescheduleOverdue,
}: {
  byDay: Map<string, Task[]>;
  overdue?: Task[];
  renderRow: (task: Task) => ReactNode;
  onAdd: (day: string, parsed: Parsed) => void;
  onDropTask: (id: string, day: string) => void;
  onRescheduleOverdue?: () => void;
}) {
  const [start] = useState(today());
  const [pages, setPages] = useState(1);
  const [openAdd, setOpenAdd] = useState<string | null>(null);
  const [dropDay, setDropDay] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPages(1);
    setOpenAdd(null);
    scroller.current?.scrollTo({ top: 0 });
  }, [start]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setPages((p) => Math.min(p + 1, 16));
      },
      { rootMargin: "600px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  // Only the visible window is ever built — never a whole year of rows.
  const days = useMemo(
    () => Array.from({ length: pages * PAGE }, (_, i) => addDays(start, i)),
    [start, pages],
  );




  return (
    <div className="flex min-h-0 flex-1 flex-col">

      <div ref={scroller} className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
        {overdue.length > 0 && (
          <section>
            <div className="flex items-center gap-3 border-b border-[#d1795e]/30 pb-2">
              <h2 className="text-[14px] font-black text-[#a8462c]">Overdue · {overdue.length}</h2>
              {onRescheduleOverdue && (
                <button
                  type="button"
                  onClick={onRescheduleOverdue}
                  className="ml-auto rounded-full bg-[#fbeae4] px-3 py-1.5 text-[12.5px] font-extrabold text-[#a8462c]"
                >
                  Reschedule
                </button>
              )}
            </div>
            <div className="flex flex-col pt-2">{overdue.map((t) => renderRow(t))}</div>
          </section>
        )}

        {days.map((day) => {
          const list = byDay.get(day) ?? [];
          return (
            <section
              key={day}
              onDragOver={(e) => {
                e.preventDefault();
                setDropDay(day);
              }}
              onDragLeave={() => setDropDay((d) => (d === day ? null : d))}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/rita-task");
                setDropDay(null);
                if (id) onDropTask(id, day);
              }}
              className={`rounded-2xl transition-colors ${
                dropDay === day ? "bg-[#eef6e9] ring-2 ring-[#4c9a2a]/30" : ""
              }`}
            >
              <h2 className="border-b border-black/[0.07] px-1 pb-2 text-[14px] font-black">
                {dayLabel(day)}
              </h2>
              <div className="flex flex-col px-1 pt-2">
                {list.map((t) => renderRow(t))}
                {openAdd === day ? (
                  <QuickAdd
                    onAdd={(parsed) => {
                      onAdd(day, parsed);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpenAdd(day)}
                    className="flex items-center gap-2 rounded-xl px-1 py-2 text-left text-[13.5px] font-extrabold text-[#c0392b]/80 hover:text-[#c0392b]"
                  >
                    <span className="grid h-5 w-5 place-items-center rounded-full text-[16px] leading-none">
                      +
                    </span>
                    Add task
                  </button>
                )}
              </div>
            </section>
          );
        })}

        <div ref={sentinel} className="h-8" />
        {pages >= 16 && (
          <p className="pb-4 text-center text-[12.5px] font-bold text-[#b3aa9c]">
            That's about two years ahead — pick a date above for anything further.
          </p>
        )}
      </div>
    </div>
  );
}
