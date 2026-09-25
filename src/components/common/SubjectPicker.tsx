import { useMemo, useState } from "react";
import { Check, ChevronDown, Plus, Search } from "lucide-react";

export type PickSubject = { id: string; name: string };
export type PickSubtopic = { id: string; subject_id: string; name: string };

type Props = {
  accent?: string;
  subjects: PickSubject[];
  subtopics: PickSubtopic[];
  value: string;
  onChange: (subtopicId: string) => void;
  onNewSubject: () => void;
  onNewSubtopic: (subjectId: string) => void;
  emptyHint?: string;
};

/** Archive-style destination picker: search, subject rows, sub-subjects with ticks. */
export function SubjectPicker({
  accent = "#3f2c73",
  subjects,
  subtopics,
  value,
  onChange,
  onNewSubject,
  onNewSubtopic,
  emptyHint = "No subjects yet — tap New subject to make your first one.",
}: Props) {
  const [q, setQ] = useState("");
  const chosenParent = useMemo(
    () => subtopics.find((t) => t.id === value)?.subject_id ?? subjects[0]?.id ?? "",
    [subtopics, value, subjects],
  );
  const [open, setOpen] = useState<string>(chosenParent);

  const term = q.trim().toLowerCase();
  const rows = useMemo(() => {
    return subjects
      .map((s) => ({
        ...s,
        kids: subtopics.filter(
          (t) =>
            t.subject_id === s.id &&
            (!term || t.name.toLowerCase().includes(term) || s.name.toLowerCase().includes(term)),
        ),
      }))
      .filter((s) => !term || s.kids.length > 0 || s.name.toLowerCase().includes(term));
  }, [subjects, subtopics, term]);

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a89e90]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search subjects and sub-subjects…"
            className="h-11 w-full rounded-xl border border-black/10 bg-white pl-9 pr-3 text-[14px] font-semibold focus:outline-none focus:ring-2"
            style={{ boxShadow: "none" }}
          />
        </div>
        <button
          type="button"
          onClick={onNewSubject}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 text-[13px] font-extrabold hover:bg-black/[0.03]"
        >
          <Plus size={15} /> New subject
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {rows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-black/10 bg-[#fbf5e9] px-4 py-8 text-center text-[14px] font-bold text-[#a29a8d]">
            {emptyHint}
          </div>
        )}

        {rows.map((s) => {
          const expanded = open === s.id || !!term;
          const holdsValue = s.kids.some((k) => k.id === value);
          return (
            <div key={s.id} className="overflow-hidden rounded-2xl border border-black/[0.07] bg-white">
              <button
                type="button"
                onClick={() => setOpen(expanded && !term ? "" : s.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[#fdfaf3]"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: holdsValue ? accent : "#ded6c7" }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15.5px] font-black">{s.name}</span>
                  <span className="text-[12px] font-semibold text-[#a29a8d]">
                    {s.kids.length} sub-subject{s.kids.length === 1 ? "" : "s"}
                  </span>
                </span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onNewSubtopic(s.id);
                  }}
                  className="hidden rounded-lg px-2.5 py-1.5 text-[12px] font-extrabold text-[#6b6357] hover:bg-black/[0.05] sm:inline-flex"
                >
                  + Sub-subject
                </span>
                <ChevronDown size={17} className={`shrink-0 text-[#a89e90] transition-transform ${expanded ? "rotate-180" : ""}`} />
              </button>

              {expanded && (
                <div className="flex flex-col gap-1.5 px-3 pb-3">
                  {s.kids.map((t) => {
                    const on = t.id === value;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onChange(t.id)}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition"
                        style={on ? { background: "#fdf3e4" } : undefined}
                      >
                        <span
                          className="grid h-5 w-5 shrink-0 place-items-center rounded-[7px] border-2"
                          style={{ borderColor: on ? accent : "#ded6c7", background: on ? accent : "#fff" }}
                        >
                          {on && <Check size={12} strokeWidth={3.5} color="#fff" />}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[14.5px] font-bold text-[#3d3833]">{t.name}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => onNewSubtopic(s.id)}
                    className="flex h-11 items-center gap-2 rounded-xl border border-dashed border-black/10 px-3 text-[13px] font-bold text-[#a29a8d] hover:bg-[#fbf5e9]"
                  >
                    <Plus size={14} /> Add a sub-subject
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
