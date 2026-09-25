import { useState } from "react";
import { type Stage, type Task } from "@/lib/todo-store";

const COLUMNS: { key: Stage; label: string; tone: string }[] = [
  { key: "todo", label: "To do", tone: "#6aa9d8" },
  { key: "doing", label: "Doing", tone: "#f0a95c" },
  { key: "done", label: "Done", tone: "#6ab887" },
];

const stageOf = (t: Task): Stage => (t.done ? "done" : (t.stage ?? "todo"));

/** Kanban view of one project — same tasks, dragged between three columns. */
export function TodoBoardView({
  tasks,
  onStage,
}: {
  tasks: Task[];
  onStage: (id: string, stage: Stage) => void;
}) {
  const [over, setOver] = useState<Stage | null>(null);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const rows = tasks.filter((t) => stageOf(t) === col.key);
        return (
          <div
            key={col.key}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(col.key);
            }}
            onDragLeave={() => setOver((s) => (s === col.key ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/rita-task");
              setOver(null);
              if (id) onStage(id, col.key);
            }}
            className={`rounded-2xl border p-3 transition-colors ${
              over === col.key ? "border-[#4c9a2a]/40 bg-[#eef6e9]" : "border-black/[0.07] bg-[#fbf5e9]"
            }`}
          >
            <p className="flex items-center gap-2 px-1 pb-3 text-[13px] font-black">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: col.tone }} />
              {col.label}
              <span className="ml-auto text-[12.5px] font-black tabular-nums text-[#a29a8d]">
                {rows.length}
              </span>
            </p>
            <div className="space-y-2">
              {rows.map((t) => (
                <div
                  key={t.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/rita-task", t.id)}
                  className="cursor-grab rounded-xl border border-black/[0.06] bg-white px-3 py-2.5 text-[14.5px] font-bold text-[#23201d] active:cursor-grabbing"
                >
                  <span className={t.done ? "text-[#a29a8d] line-through" : ""}>{t.title}</span>
                </div>
              ))}
              {rows.length === 0 && (
                <p className="px-1 py-4 text-[12.5px] font-bold text-[#b3aa9c]">
                  Drag a task here.
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
