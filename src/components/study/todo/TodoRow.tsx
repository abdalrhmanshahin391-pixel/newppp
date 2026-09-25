import { useState } from "react";
import {
  CalendarDays,
  Check,
  Clock,
  CornerDownRight,
  Pencil,
  Plus,
  Repeat,
  Star,
  Tag,
  Trash2,
} from "lucide-react";
import { priorityOf, relDate, type Project, type Task } from "@/lib/todo-store";
import { repeatLabel } from "@/lib/todo-recurrence";

export type RowProps = {
  task: Task;
  subtasks?: Task[];
  selected: string[];
  projects: Project[];
  onToggleSelect: (id: string) => void;
  onPatch: (id: string, p: Partial<Task>) => void;
  onRemove: (id: string) => void;
  onComplete: (task: Task) => void;
  onAddSub: (parentId: string, title: string) => void;
  hideDue?: boolean;
  draggable?: boolean;
};

export function TaskRow({
  task,
  subtasks = [],
  selected,
  projects,
  onToggleSelect,
  onPatch,
  onRemove,
  onComplete,
  onAddSub,
  hideDue,
  draggable,
}: RowProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [subOpen, setSubOpen] = useState(false);
  const [subText, setSubText] = useState("");
  const tone = priorityOf(task.priority);
  const isSelected = selected.includes(task.id);
  const project = projects.find((p) => p.id === task.projectId);
  const doneSubs = subtasks.filter((s) => s.done).length;
  const repeat = repeatLabel(task.repeat);

  const commit = () => {
    const clean = title.trim();
    setEditing(false);
    if (!clean) {
      setTitle(task.title);
      return;
    }
    if (clean !== task.title) onPatch(task.id, { title: clean });
  };

  return (
    <div className="mb-2">
      <div
        role="button"
        tabIndex={0}
        draggable={draggable && !editing}
        onDragStart={(e) => e.dataTransfer.setData("text/rita-task", task.id)}
        onClick={() => {
          if (!editing) onToggleSelect(task.id);
        }}
        onKeyDown={(e) => {
          if (editing) return;
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            onToggleSelect(task.id);
          }
        }}
        className={`group relative flex cursor-pointer items-start gap-3 overflow-hidden rounded-2xl border py-3.5 pl-4 pr-2 text-[#23201d] transition-all ${
          isSelected
            ? "border-[#4c9a2a]/50 shadow-[0_0_0_2px_rgba(76,154,42,0.18)]"
            : "border-black/[0.06]"
        }`}
        style={{
          background: task.done ? "#faf8f3" : tone.tint === "transparent" ? "#fff" : tone.tint,
        }}
      >
        <span
          className="absolute inset-y-0 left-0 w-1.5"
          style={{ background: tone.key === "none" ? "transparent" : tone.bar }}
        />

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (task.done) onPatch(task.id, { done: false, completedAt: undefined });
            else onComplete(task);
          }}
          aria-label={task.done ? "Mark as not done" : "Mark as done"}
          className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-transform active:scale-90"
          style={{
            borderColor: task.done ? "#4c9a2a" : tone.key === "none" ? "#ded6c7" : tone.bar,
            background: task.done ? "#4c9a2a" : "#fff",
          }}
        >
          {task.done && <Check size={13} strokeWidth={4} color="#fff" />}
        </button>

        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              value={title}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") commit();
                if (e.key === "Escape") {
                  setTitle(task.title);
                  setEditing(false);
                }
              }}
              className="w-full rounded-lg border border-black/10 bg-white px-2 py-1 text-[16.5px] font-bold text-[#23201d] outline-none"
            />
          ) : (
            <span
              className={`block text-[16.5px] font-bold leading-snug ${
                task.done ? "text-[#a29a8d] line-through" : "text-[#23201d]"
              }`}
            >
              {task.title}
            </span>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {!hideDue && task.due && (() => {
              const rel = relDate(task.due);
              return (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-extrabold"
                  style={{ background: rel.bg, color: rel.ink }}
                >
                  <CalendarDays size={12} />
                  {rel.text}
                </span>
              );
            })()}
            {task.time && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[12px] font-extrabold text-[#8a7f6c]">
                <Clock size={12} />
                {task.time}
              </span>
            )}
            {repeat && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[12px] font-extrabold text-[#4c9a2a]">
                <Repeat size={12} />
                {repeat}
              </span>
            )}
            {project && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-extrabold text-white"
                style={{ background: project.color }}
              >
                {project.name}
              </span>
            )}
            {(task.labels ?? []).map((l) => (
              <span
                key={l}
                className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[12px] font-extrabold text-[#8a7f6c]"
              >
                <Tag size={11} />@{l}
              </span>
            ))}
            {subtasks.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[12px] font-extrabold text-[#8a7f6c]">
                {doneSubs}/{subtasks.length}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSubOpen((v) => !v);
          }}
          aria-label="Add sub-task"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[#a29a8d] transition hover:bg-black/[0.05]"
        >
          <CornerDownRight size={16} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
          aria-label="Rename task"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[#a29a8d] transition hover:bg-black/[0.05]"
        >
          <Pencil size={16} />
        </button>
        {task.starred && (
          <span className="grid h-9 w-9 shrink-0 place-items-center" title="Starred">
            <Star size={16} fill="#f0a95c" style={{ color: "#f0a95c" }} />
          </span>
        )}

      </div>

      {(subtasks.length > 0 || subOpen) && (
        <div className="ml-8 mt-1.5 space-y-1.5 border-l-2 border-dashed border-black/[0.08] pl-4">
          {subtasks.map((s) => (
            <div key={s.id} className="group/sub flex items-center gap-2.5">
              <button
                type="button"
                onClick={() =>
                  onPatch(s.id, {
                    done: !s.done,
                    completedAt: s.done ? undefined : new Date().toISOString(),
                  })
                }
                aria-label="Toggle sub-task"
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-transform active:scale-90"
                style={{
                  borderColor: s.done ? "#4c9a2a" : "#ded6c7",
                  background: s.done ? "#4c9a2a" : "#fff",
                }}
              >
                {s.done && <Check size={11} strokeWidth={4} color="#fff" />}
              </button>
              <span
                className={`flex-1 text-[14.5px] font-semibold ${
                  s.done ? "text-[#b3aa9c] line-through" : "text-[#3c372f]"
                }`}
              >
                {s.title}
              </span>
              <button
                type="button"
                onClick={() => onRemove(s.id)}
                aria-label="Delete sub-task"
                className="grid h-7 w-7 place-items-center rounded-lg text-[#c8bfae] opacity-0 transition hover:text-[#d1795e] group-hover/sub:opacity-100"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {subOpen && (
            <div className="flex items-center gap-2 pt-0.5">
              <Plus size={14} className="text-[#a29a8d]" />
              <input
                autoFocus
                value={subText}
                onChange={(e) => setSubText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && subText.trim()) {
                    onAddSub(task.id, subText);
                    setSubText("");
                  }
                  if (e.key === "Escape") setSubOpen(false);
                }}
                onBlur={() => setSubOpen(false)}
                placeholder="Sub-task, then Enter"
                className="w-full bg-transparent text-[14.5px] font-semibold outline-none placeholder:text-[#b3aa9c]"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
