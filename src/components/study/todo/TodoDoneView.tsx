import { useMemo } from "react";
import { CheckCircle2, Flame, RotateCcw } from "lucide-react";
import { dayLabel, iso, type Task } from "@/lib/todo-store";

/** The completed log plus the daily goal and streak — the reason people come back. */
export function TodoDoneView({
  tasks,
  goal,
  onGoal,
  onUndo,
}: {
  tasks: Task[];
  goal: number;
  onGoal: (n: number) => void;
  onUndo: (id: string) => void;
}) {
  const done = useMemo(
    () =>
      tasks
        .filter((t) => t.done && t.completedAt)
        .sort((a, b) => (a.completedAt! < b.completedAt! ? 1 : -1)),
    [tasks],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of done) {
      const day = iso(new Date(t.completedAt!));
      const arr = map.get(day);
      if (arr) arr.push(t);
      else map.set(day, [t]);
    }
    return [...map.entries()];
  }, [done]);

  const todayIso = iso(new Date());
  const todayCount = byDay.find(([d]) => d === todayIso)?.[1].length ?? 0;

  const streak = useMemo(() => {
    const hit = new Set(byDay.filter(([, list]) => list.length >= goal).map(([d]) => d));
    let n = 0;
    const cursor = new Date();
    // Today only breaks the streak once it is over, so start from yesterday if needed.
    if (!hit.has(iso(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (hit.has(iso(cursor))) {
      n += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return n;
  }, [byDay, goal]);

  const pct = Math.min(100, Math.round((todayCount / Math.max(1, goal)) * 100));

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-black/[0.07] bg-[#fbf5e9] p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b3aa9c]">
            Today's goal
          </p>
          <p className="mt-2 text-[26px] font-black leading-none">
            {todayCount}
            <span className="ml-1.5 text-[13px] font-bold text-[#a29a8d]">of {goal} done</span>
          </p>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-[#4c9a2a] transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[12.5px] font-bold text-[#8a7f6c]">Daily goal</span>
            <input
              type="range"
              min={1}
              max={20}
              value={goal}
              onChange={(e) => onGoal(Number(e.target.value))}
              className="flex-1 accent-[#4c9a2a]"
            />
            <span className="w-6 text-right text-[13px] font-black tabular-nums">{goal}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-black/[0.07] bg-[#fdf1e2] p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b3aa9c]">Streak</p>
          <p className="mt-2 flex items-baseline gap-2 text-[26px] font-black leading-none">
            <Flame size={24} className="text-[#f0a95c]" />
            {streak}
            <span className="text-[13px] font-bold text-[#a29a8d]">
              day{streak === 1 ? "" : "s"} hitting the goal
            </span>
          </p>
          <p className="mt-3 text-[13px] font-semibold text-[#8a7f6c]">
            {todayCount >= goal
              ? "Goal reached today — Rita is proud of you."
              : `${goal - todayCount} more today keeps the streak alive.`}
          </p>
        </div>
      </div>

      {byDay.length === 0 && (
        <p className="py-8 text-[15px] font-bold text-[#a29a8d]">
          Nothing finished yet. Tick something off and it lands here.
        </p>
      )}

      {byDay.map(([day, list]) => (
        <section key={day}>
          <h2 className="border-b border-black/[0.07] pb-2 text-[14px] font-black">
            {dayLabel(day)} · {list.length} done
          </h2>
          <div className="flex flex-col pt-2">
            {list.map((t) => (
              <div
                key={t.id}
                className="mb-1.5 flex items-center gap-3 rounded-xl bg-[#faf8f3] px-3 py-2.5"
              >
                <CheckCircle2 size={17} className="shrink-0 text-[#4c9a2a]" />
                <span className="flex-1 text-[15px] font-bold text-[#8a7f6c] line-through">
                  {t.title}
                </span>
                <button
                  type="button"
                  onClick={() => onUndo(t.id)}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-extrabold text-[#6d675e] hover:bg-white"
                >
                  <RotateCcw size={13} /> Undo
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
