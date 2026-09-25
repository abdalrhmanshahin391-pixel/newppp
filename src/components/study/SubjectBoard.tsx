import { useState } from "react";
import { Check, ChevronDown, ChevronUp, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import type { SampleSubject } from "@/lib/study-sample-data";
import type { Selection } from "@/lib/use-study-subjects";

const TONE_DOTS = ["#f0a95c", "#6aa9d8", "#9b83d1", "#d1795e", "#6ab887"];

type DragState =
  | { kind: "subject"; from: number }
  | { kind: "sub"; si: number; from: number }
  | null;

export type SubjectBoardProps = {
  subjects: SampleSubject[];
  selection: Selection;
  onSelect: (sel: Selection) => void;
  onMoveSubject: (from: number, to: number) => void;
  onMoveSub: (si: number, from: number, to: number) => void;
  onEdit: (sel: Selection) => void;
  onRemove: (sel: Selection) => void;
  onAddSub: (si: number) => void;
  /** Real card count for a sub-subject; omit to hide counts entirely. */
  countFor?: (si: number, sj: number) => number;
};

const iconBtn =
  "grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[#a29a8d] transition-colors hover:bg-black/[0.06] hover:text-[#23201d]";

function Box({
  checked,
  tone,
  onToggle,
  size = 22,
}: {
  checked: boolean;
  tone: string;
  onToggle: () => void;
  size?: number;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="grid shrink-0 place-items-center rounded-[8px] border-2 transition-colors"
      style={{
        width: size,
        height: size,
        borderColor: checked ? tone : "#ded6c7",
        background: checked ? tone : "#fff",
      }}
    >
      {checked && <Check size={size - 10} strokeWidth={3.5} color="#fff" />}
    </button>
  );
}

/** Numbered subject list with checkbox selection, drag-reorder and inline actions. */
export function SubjectBoard({
  subjects,
  selection,
  onSelect,
  onMoveSubject,
  onMoveSub,
  onEdit,
  onRemove,
  onAddSub,
  countFor,
}: SubjectBoardProps) {
  const [open, setOpen] = useState<number | null>(0);
  const [drag, setDrag] = useState<DragState>(null);
  const [overSubject, setOverSubject] = useState<number | null>(null);
  const [overSub, setOverSub] = useState<string | null>(null);

  if (subjects.length === 0) {
    return (
      <div className="grid min-h-[40vh] place-items-center rounded-2xl border border-dashed border-black/10 bg-[#fbf5e9] text-center">
        <p className="px-6 text-[15px] font-bold text-[#a29a8d]">
          No subjects yet — use “Add subject” on the left to start your board.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {subjects.map((subject, i) => {
        const expanded = open === i;
        const selected = selection?.kind === "subject" && selection.si === i;
        const dot = TONE_DOTS[i % TONE_DOTS.length];
        const dropTarget = drag?.kind === "subject" && overSubject === i && drag.from !== i;
        const total = countFor
          ? subject.subs.reduce((n, _s, j) => n + countFor(i, j), 0)
          : 0;

        return (
          <div key={`${subject.name}-${i}`}>
            <div
              draggable
              onDragStart={(e) => {
                setDrag({ kind: "subject", from: i });
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (drag?.kind !== "subject") return;
                e.preventDefault();
                setOverSubject(i);
              }}
              onDragLeave={() => setOverSubject((v) => (v === i ? null : v))}
              onDrop={(e) => {
                e.preventDefault();
                if (drag?.kind === "subject") onMoveSubject(drag.from, i);
                setDrag(null);
                setOverSubject(null);
              }}
              onDragEnd={() => {
                setDrag(null);
                setOverSubject(null);
              }}
              onClick={() => setOpen(expanded ? null : i)}
              className={`group relative flex min-h-20 w-full cursor-pointer items-center gap-3.5 overflow-hidden rounded-2xl border pl-4 pr-3.5 text-left transition-all ${
                dropTarget ? "border-dashed border-[#f0a95c]" : ""
              } ${
                selected
                  ? "border-transparent bg-[#fdf3e4] shadow-[0_10px_24px_-20px_rgba(35,32,29,0.6)]"
                  : "border-black/[0.06] bg-white hover:bg-[#fdfaf3]"
              }`}
            >
              {selected && (
                <span
                  className="absolute inset-y-0 left-0 w-[5px] rounded-r-full"
                  style={{ background: dot }}
                />
              )}
              <Box
                checked={selected}
                tone={dot}
                onToggle={() => onSelect(selected ? null : { kind: "subject", si: i })}
              />
              <GripVertical
                size={16}
                className="shrink-0 cursor-grab text-[#d8d0c2] active:cursor-grabbing"
              />
              <span className="w-7 shrink-0 text-[13px] font-black tabular-nums text-[#c0b7a8]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[17px] font-black leading-tight text-[#23201d]">
                  {subject.name}
                </span>
                <span className="mt-0.5 block text-[12.5px] font-semibold text-[#a29a8d]">
                  {subject.subs.length} sub-topic{subject.subs.length === 1 ? "" : "s"}
                  {countFor && total > 0 ? ` · ${total} card${total === 1 ? "" : "s"}` : ""}
                </span>
              </span>

              <span className="flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  aria-label="Move up"
                  className={iconBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveSubject(i, i - 1);
                  }}
                >
                  <ChevronUp size={15} />
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  className={iconBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveSubject(i, i + 1);
                  }}
                >
                  <ChevronDown size={15} />
                </button>
                <button
                  type="button"
                  aria-label="Add sub-subject"
                  className={iconBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddSub(i);
                  }}
                >
                  <Plus size={15} />
                </button>
                <button
                  type="button"
                  aria-label="Edit subject"
                  className={iconBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit({ kind: "subject", si: i });
                  }}
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  aria-label="Remove subject"
                  className={iconBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove({ kind: "subject", si: i });
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </span>

              <span
                className={iconBtn}
                aria-hidden
              >
                <ChevronDown
                  size={18}
                  className={`transition-transform ${expanded ? "rotate-180" : ""}`}
                />
              </span>
            </div>

            {expanded && (
              <div className="mt-2 flex flex-col gap-2 pl-7">
                {subject.subs.map((sub, j) => {
                  const key = `${i}-${j}`;
                  const subSelected =
                    selection?.kind === "sub" && selection.si === i && selection.sj === j;
                  const subDrop =
                    drag?.kind === "sub" && drag.si === i && overSub === key && drag.from !== j;
                  return (
                    <div
                      key={`${sub.name}-${j}`}
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation();
                        setDrag({ kind: "sub", si: i, from: j });
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(e) => {
                        if (drag?.kind !== "sub" || drag.si !== i) return;
                        e.preventDefault();
                        setOverSub(key);
                      }}
                      onDragLeave={() => setOverSub((v) => (v === key ? null : v))}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (drag?.kind === "sub" && drag.si === i) onMoveSub(i, drag.from, j);
                        setDrag(null);
                        setOverSub(null);
                      }}
                      onDragEnd={() => {
                        setDrag(null);
                        setOverSub(null);
                      }}
                      onClick={() => onSelect(subSelected ? null : { kind: "sub", si: i, sj: j })}
                       className={`group relative flex min-h-20 cursor-pointer items-center gap-3 overflow-hidden rounded-2xl border pl-4 pr-3 transition-all ${
                        subDrop ? "border-dashed border-[#f0a95c]" : ""
                      } ${
                        subSelected
                          ? "border-transparent bg-[#fdf3e4]"
                          : "border-transparent bg-[#fbf5e9] hover:bg-[#f7efe0]"
                      }`}
                    >
                      {subSelected && (
                        <span
                          className="absolute inset-y-0 left-0 w-[4px] rounded-r-full"
                          style={{ background: dot }}
                        />
                      )}
                      <Box
                        size={20}
                        checked={subSelected}
                        tone={dot}
                        onToggle={() =>
                          onSelect(subSelected ? null : { kind: "sub", si: i, sj: j })
                        }
                      />
                      <GripVertical
                        size={14}
                        className="shrink-0 cursor-grab text-[#d8d0c2] active:cursor-grabbing"
                      />
                      <span className="w-6 shrink-0 text-[12px] font-bold tabular-nums text-[#c0b7a8]">
                        {String(j + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-[#3d3833]">
                        {sub.name}
                      </span>
                      <span className="flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          aria-label="Move up"
                          className={iconBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveSub(i, j, j - 1);
                          }}
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          type="button"
                          aria-label="Move down"
                          className={iconBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveSub(i, j, j + 1);
                          }}
                        >
                          <ChevronDown size={14} />
                        </button>
                        <button
                          type="button"
                          aria-label="Edit sub-subject"
                          className={iconBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit({ kind: "sub", si: i, sj: j });
                          }}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          aria-label="Remove sub-subject"
                          className={iconBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemove({ kind: "sub", si: i, sj: j });
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </span>
                      {countFor && countFor(i, j) > 0 && (
                        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[12px] font-bold tabular-nums text-[#7a736a]">
                          {countFor(i, j)} cards
                        </span>
                      )}
                    </div>
                  );
                })}
                {subject.subs.length === 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddSub(i);
                    }}
                    className="flex h-12 items-center gap-2 rounded-xl border border-dashed border-black/10 px-3.5 text-[13.5px] font-bold text-[#a29a8d] hover:bg-[#fbf5e9]"
                  >
                    <Plus size={14} /> Add a sub-subject
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
