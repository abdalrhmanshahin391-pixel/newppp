import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { SampleSubject } from "@/lib/study-sample-data";
import type { Selection } from "@/lib/use-study-subjects";

type DragState =
  { kind: "subject"; from: number } | { kind: "sub"; si: number; from: number } | null;

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

/** Tick box: 24px to look at, 44px to hit. */
function Box({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="-ml-2 grid h-11 w-11 shrink-0 touch-manipulation place-items-center"
    >
      <span
        className="grid h-6 w-6 place-items-center rounded-[6px] border-2 border-[#121117] transition-colors duration-150"
        style={{ background: checked ? "#2b6df0" : "#fff" }}
      >
        {checked && <Check size={14} strokeWidth={3.5} color="#fff" />}
      </span>
    </button>
  );
}

type MenuItem = {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
};

/**
 * The one "more" menu on a row. It replaces five 36px icon buttons that squeezed
 * the name down to a few letters, and it works by touch (native drag does not).
 */
function RowMenu({ name, items }: { name: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <span ref={root} className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        ref={trigger}
        type="button"
        aria-label={`Actions for ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid h-11 w-11 touch-manipulation place-items-center rounded-lg text-[#4b4a5c] transition-colors duration-150 hover:bg-[#e7eefd] hover:text-[#121117] active:scale-95"
      >
        <MoreHorizontal size={20} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 w-56 origin-top-right rounded-2xl border-2 border-[#121117] bg-white p-1.5 shadow-none animate-[rita-pop_.16s_ease-out]"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={`flex h-11 w-full touch-manipulation items-center gap-3 rounded-lg px-3 text-left text-[15px] font-semibold transition-colors duration-150 disabled:opacity-40 ${
                item.danger
                  ? "text-[#b3213f] hover:bg-[#fdecef]"
                  : "text-[#121117] hover:bg-[#e7eefd]"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

/** Drag handle only where a mouse exists: native drag does nothing on touch screens. */
const GRIP =
  "hidden shrink-0 cursor-grab text-[#6a697c] active:cursor-grabbing [@media(pointer:fine)]:block";

/** Numbered subject list with checkbox selection, drag-reorder and a per-row menu. */
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
      <div className="grid min-h-[40vh] place-items-center rounded-2xl border-2 border-dashed border-[#dcdce5] bg-[#f4f4f8] text-center">
        <p className="px-6 text-[16px] font-medium text-[#4b4a5c]">
          No subjects yet — use “Add subject” to start your board.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {subjects.map((subject, i) => {
        const expanded = open === i;
        const selected = selection?.kind === "subject" && selection.si === i;
        const dropTarget = drag?.kind === "subject" && overSubject === i && drag.from !== i;
        const total = countFor ? subject.subs.reduce((n, _s, j) => n + countFor(i, j), 0) : 0;

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
              className={`group relative flex min-h-[72px] w-full cursor-pointer items-center gap-2.5 rounded-[14px] border-2 border-[#121117] py-2 pl-3 pr-1 text-left sm:pl-4 sm:pr-2 transition-colors duration-150 ${
                dropTarget ? "border-dashed" : ""
              } ${selected ? "bg-[#e7eefd]" : "bg-white hover:bg-[#f4f4f8]"}`}
            >
              <Box
                checked={selected}
                label={`Select ${subject.name}`}
                onToggle={() => onSelect(selected ? null : { kind: "subject", si: i })}
              />
              <GripVertical size={16} className={GRIP} aria-hidden />
              <span className="hidden w-6 shrink-0 text-[13px] font-bold tabular-nums text-[#6a697c] sm:block">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  title={subject.name}
                  className="line-clamp-2 break-words text-[17px] font-bold leading-snug text-[#121117]"
                >
                  {subject.name}
                </span>
                <span className="mt-0.5 block text-[13.5px] font-medium text-[#4b4a5c]">
                  {subject.subs.length} sub-topic{subject.subs.length === 1 ? "" : "s"}
                  {countFor && total > 0 ? ` · ${total} card${total === 1 ? "" : "s"}` : ""}
                </span>
              </span>

              <RowMenu
                name={subject.name}
                items={[
                  {
                    label: "Add sub-subject",
                    icon: <Plus size={17} />,
                    onClick: () => onAddSub(i),
                  },
                  {
                    label: "Rename",
                    icon: <Pencil size={17} />,
                    onClick: () => onEdit({ kind: "subject", si: i }),
                  },
                  {
                    label: "Move up",
                    icon: <ArrowUp size={17} />,
                    disabled: i === 0,
                    onClick: () => onMoveSubject(i, i - 1),
                  },
                  {
                    label: "Move down",
                    icon: <ArrowDown size={17} />,
                    disabled: i === subjects.length - 1,
                    onClick: () => onMoveSubject(i, i + 1),
                  },
                  {
                    label: "Remove…",
                    icon: <Trash2 size={17} />,
                    danger: true,
                    onClick: () => onRemove({ kind: "subject", si: i }),
                  },
                ]}
              />

              <span
                className="grid h-11 w-6 shrink-0 place-items-center text-[#4b4a5c]"
                aria-hidden
              >
                <ChevronDown
                  size={18}
                  className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                />
              </span>
            </div>

            {expanded && (
              <div className="mt-2 flex flex-col gap-2 pl-3 sm:pl-7">
                {subject.subs.map((sub, j) => {
                  const key = `${i}-${j}`;
                  const subSelected =
                    selection?.kind === "sub" && selection.si === i && selection.sj === j;
                  const subDrop =
                    drag?.kind === "sub" && drag.si === i && overSub === key && drag.from !== j;
                  const cards = countFor ? countFor(i, j) : 0;
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
                      className={`group relative flex min-h-[64px] cursor-pointer items-center gap-2.5 rounded-[12px] border-2 py-2 pl-3 pr-1 transition-colors sm:pl-4 sm:pr-2 duration-150 ${
                        subDrop ? "border-dashed border-[#121117]" : ""
                      } ${
                        subSelected
                          ? "border-[#121117] bg-[#e7eefd]"
                          : "border-[#dcdce5] bg-white hover:border-[#121117]"
                      }`}
                    >
                      <Box
                        checked={subSelected}
                        label={`Select ${sub.name}`}
                        onToggle={() =>
                          onSelect(subSelected ? null : { kind: "sub", si: i, sj: j })
                        }
                      />
                      <GripVertical size={14} className={GRIP} aria-hidden />
                      <span className="hidden w-6 shrink-0 text-[12.5px] font-bold tabular-nums text-[#6a697c] sm:block">
                        {String(j + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          title={sub.name}
                          className="line-clamp-2 break-words text-[15.5px] font-bold leading-snug text-[#121117]"
                        >
                          {sub.name}
                        </span>
                        {countFor && (
                          <span className="mt-0.5 block text-[13px] font-medium text-[#4b4a5c]">
                            {cards} card{cards === 1 ? "" : "s"}
                          </span>
                        )}
                      </span>
                      <RowMenu
                        name={sub.name}
                        items={[
                          {
                            label: "Rename",
                            icon: <Pencil size={17} />,
                            onClick: () => onEdit({ kind: "sub", si: i, sj: j }),
                          },
                          {
                            label: "Move up",
                            icon: <ArrowUp size={17} />,
                            disabled: j === 0,
                            onClick: () => onMoveSub(i, j, j - 1),
                          },
                          {
                            label: "Move down",
                            icon: <ArrowDown size={17} />,
                            disabled: j === subject.subs.length - 1,
                            onClick: () => onMoveSub(i, j, j + 1),
                          },
                          {
                            label: "Remove…",
                            icon: <Trash2 size={17} />,
                            danger: true,
                            onClick: () => onRemove({ kind: "sub", si: i, sj: j }),
                          },
                        ]}
                      />
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
                    className="flex h-12 items-center gap-2 rounded-xl border-2 border-dashed border-[#bdbdcc] px-3.5 text-[15px] font-semibold text-[#4b4a5c] hover:bg-[#f4f4f8]"
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
