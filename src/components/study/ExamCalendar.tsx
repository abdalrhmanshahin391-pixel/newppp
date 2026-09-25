import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, GraduationCap, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/legacy-client";
import { useAuth } from "@/hooks/useAuth";

type Exam = {
  id: string;
  title: string;
  starts_at: string;
};

const WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** 42 cells, Monday first, covering the whole month plus its edges. */
function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const shift = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - shift);
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

export function ExamCalendar() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", date: iso(new Date()) });

  const { data: exams = [] } = useQuery({
    queryKey: ["study-exams"],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("study_exams")
        .select("id,title,starts_at")
        .order("starts_at");
      return (data ?? []) as Exam[];
    },
  });

  const byDay = useMemo(() => {
    const map = new Map<string, Exam[]>();
    for (const e of exams) {
      const key = iso(new Date(e.starts_at));
      const list = map.get(key);
      if (list) list.push(e);
      else map.set(key, [e]);
    }
    return map;
  }, [exams]);

  const days = useMemo(() => monthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor]);

  const add = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const [y, m, d] = form.date.split("-").map(Number);
      const at = new Date(y!, (m ?? 1) - 1, d ?? 1, 9, 0, 0);
      const { error } = await (supabase.from as any)("study_exams").insert({
        user_id: u.user.id,
        title: form.title.trim().slice(0, 120),
        starts_at: at.toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setOpen(false);
      setForm({ title: "", date: iso(new Date()) });
      qc.invalidateQueries({ queryKey: ["study-exams"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await (supabase.from as any)("study_exams").delete().eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study-exams"] }),
  });

  const todayIso = iso(new Date());
  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const valid = form.title.trim().length > 0 && form.date.length === 10;

  return (
    <div data-tour="exams-calendar" className="overflow-hidden rounded-[28px] border border-black/[0.07] bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-black/[0.06] px-5 py-4 md:px-7">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          className="grid h-9 w-9 place-items-center rounded-full text-[#6d675e] hover:bg-[#fbf5e9]"
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="font-display text-[26px] font-black tracking-tight text-[#23201d] md:text-[30px]">
          {monthLabel}
        </h2>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          className="grid h-9 w-9 place-items-center rounded-full text-[#6d675e] hover:bg-[#fbf5e9]"
        >
          <ChevronRight size={20} />
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
            className="rounded-xl border border-black/[0.09] bg-white px-4 py-2 text-[13.5px] font-extrabold text-[#3c372f] hover:bg-[#fbf5e9]"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => {
              setForm({ title: "", date: iso(new Date()) });
              setOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-[#4c9a2a] px-4 py-2 text-[13.5px] font-black text-white shadow-[0_10px_24px_-14px_rgba(60,120,20,0.9)]"
          >
            <Plus size={16} /> Add new exam
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-black/[0.06] bg-[#fbf5e9]">
        {WEEK.map((d) => (
          <div
            key={d}
            className="px-2 py-3 text-center text-[12.5px] font-black text-[#3c372f]"
          >
            <span className="hidden sm:inline">{d}</span>
            <span className="sm:hidden">{d.slice(0, 3)}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((d) => {
          const key = iso(d);
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = key === todayIso;
          const list = byDay.get(key) ?? [];
          return (
            <div
              key={key}
              className={`min-h-[92px] border-b border-r border-black/[0.06] p-2 md:min-h-[112px] ${
                inMonth ? "bg-white" : "bg-[#faf8f3]"
              } ${isToday ? "bg-[#f2f8ec]" : ""}`}
            >
              <span
                className={`inline-grid h-7 min-w-7 place-items-center rounded-full px-1.5 text-[13px] font-black tabular-nums ${
                  isToday
                    ? "bg-[#4c9a2a] text-white"
                    : inMonth
                      ? "text-[#23201d]"
                      : "text-[#b3aa9c]"
                }`}
              >
                {d.getDate()}
              </span>

              <div className="mt-1.5 space-y-1">
                {list.map((e) => (
                  <div
                    key={e.id}
                    className="group flex items-center gap-1.5 rounded-lg bg-[#eaf4e2] px-2 py-1 text-[12px] font-extrabold text-[#2f6318]"
                  >
                    <GraduationCap size={12} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{e.title}</span>
                    <button
                      type="button"
                      aria-label={`Delete ${e.title}`}
                      onClick={() => remove.mutate(e.id)}
                      className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-[26px] bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#eaf4e2] text-[#2f6318]">
                <GraduationCap size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-[22px] font-black tracking-tight text-[#23201d]">
                  Add new exam
                </h3>
                <p className="mt-1 text-[14px] text-[#6d675e]">Enter details for your new exam.</p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="rounded-full p-1 text-[#6d675e] hover:bg-[#fbf5e9]"
              >
                <X size={20} />
              </button>
            </div>

            <form
              className="mt-5 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (valid && !add.isPending) add.mutate();
              }}
            >
              <label className="block">
                <span className="mb-1.5 block text-[14px] font-extrabold text-[#23201d]">
                  Course name
                </span>
                <input
                  autoFocus
                  value={form.title}
                  maxLength={120}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Biology 101"
                  className="w-full rounded-xl border border-black/[0.12] bg-white px-4 py-3 text-[15px] font-semibold text-[#23201d] outline-none focus:border-[#4c9a2a]"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[14px] font-extrabold text-[#23201d]">
                  Exam date
                </span>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full rounded-xl border border-black/[0.12] bg-white px-4 py-3 text-[15px] font-semibold text-[#23201d] outline-none focus:border-[#4c9a2a]"
                />
              </label>

              <button
                type="submit"
                disabled={!valid || add.isPending}
                className="w-full rounded-xl bg-[#4c9a2a] px-5 py-3.5 text-[15px] font-black text-white disabled:opacity-50"
              >
                Save exam
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
