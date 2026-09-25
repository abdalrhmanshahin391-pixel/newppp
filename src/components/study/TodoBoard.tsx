import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  CheckCircle2,
  Columns3,
  Hash,
  Inbox,
  ListChecks,
  Lock,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { usePlan } from "@/hooks/usePlan";
import { TaskRow } from "@/components/study/todo/TodoRow";
import { QuickAdd } from "@/components/study/todo/TodoQuickAdd";
import { TodoUpcoming } from "@/components/study/todo/TodoUpcoming";
import { TodoDoneView } from "@/components/study/todo/TodoDoneView";
import { TodoBoardView } from "@/components/study/todo/TodoBoardView";
import {
  PRIORITIES,
  addDays,
  iso,
  today,
  uid,
  useTodos,
  type PriorityKey,
  type Task,
} from "@/lib/todo-store";
import { PromptDialog } from "@/components/study/SimpleDialogs";
import { nextDue } from "@/lib/todo-recurrence";
import type { Parsed } from "@/lib/todo-nlp";

const GOAL_KEY = "rita_todo_goal";

type View =
  | { kind: "inbox" }
  | { kind: "today" }
  | { kind: "upcoming" }
  | { kind: "done" }
  | { kind: "search" }
  | { kind: "project"; id: string }
  | { kind: "label"; name: string };

/** A Todoist-shaped planner in Rita's cream palette — dates drive every view. */
export function TodoBoard() {
  const plan = usePlan();
  const api = useTodos();
  const [view, setView] = useState<View>({ kind: "today" });
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [boardMode, setBoardMode] = useState(false);
  const [goal, setGoal] = useState(5);
  const [showDone, setShowDone] = useState(true);
  const [railOpen, setRailOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(GOAL_KEY);
    if (raw) setGoal(Math.max(1, Math.min(20, Number(raw) || 5)));
  }, []);
  useEffect(() => {
    window.localStorage.setItem(GOAL_KEY, String(goal));
  }, [goal]);

  useEffect(() => setSelected([]), [view]);

  const locked = (kind: View["kind"]) =>
    !plan.todoFull && kind !== "inbox" && kind !== "search" && kind !== "today";

  useEffect(() => {
    if (locked(view.kind)) setView({ kind: "inbox" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.todoFull]);

  // Keyboard: Q to add, / to search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /input|textarea/i.test(el.tagName)) return;
      if (e.key === "q" || e.key === "Q") {
        e.preventDefault();
        document.getElementById("rita-quick-add")?.click();
        window.setTimeout(() => document.getElementById("rita-quick-add")?.focus(), 20);
      }
      if (e.key === "/") {
        e.preventDefault();
        document.getElementById("rita-todo-search")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const open = useMemo(() => api.tasks.filter((t) => !t.done && !t.parentId), [api.tasks]);
  const rows = useMemo(() => api.tasks.filter((t) => !t.parentId), [api.tasks]);

  /** Finished tasks stay in place, greyed out, sunk to the bottom of their group. */
  const arrange = (list: Task[]) =>
    (showDone ? list : list.filter((t) => !t.done))
      .slice()
      .sort((a, b) => Number(!!a.done) - Number(!!b.done) || a.order - b.order);

  const counts = useMemo(
    () => ({
      inbox: open.filter((t) => !t.due).length,
      today: open.filter((t) => t.due && t.due <= today()).length,
      upcoming: open.filter((t) => t.due && t.due > today()).length,
    }),
    [open],
  );

  const overdue = useMemo(() => open.filter((t) => t.due && t.due < today()), [open]);
  const overdueRows = arrange(rows.filter((t) => t.due && t.due < today()));
  const todayTasks = arrange(rows.filter((t) => t.due === today()));
  const inboxTasks = arrange(rows.filter((t) => !t.due));

  /** Upcoming days, honouring the “show completed” switch. */
  const byDay = useMemo(() => {
    if (showDone) return api.byDay;
    const map = new Map<string, Task[]>();
    for (const [day, list] of api.byDay) {
      const live = list.filter((t) => !t.done);
      if (live.length) map.set(day, live);
    }
    return map;
  }, [api.byDay, showDone]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return api.tasks.filter(
      (t) => t.title.toLowerCase().includes(q) || (t.note ?? "").toLowerCase().includes(q),
    );
  }, [api.tasks, query]);

  const projectTasks = (id: string) => arrange(rows.filter((t) => t.projectId === id));
  const labelTasks = (name: string) => arrange(rows.filter((t) => (t.labels ?? []).includes(name)));

  /* ------------------------------------------------------------- actions */

  const addFromParsed = (parsed: Parsed, extra: Partial<Task> = {}) => {
    // What the student typed always wins over the view's default date.
    const { due: fallbackDue, ...rest } = extra;
    api.add({
      title: parsed.title,
      ...(fallbackDue ? { due: fallbackDue } : {}),
      ...(parsed.due ? { due: parsed.due } : {}),
      ...(parsed.time ? { time: parsed.time } : {}),
      ...(parsed.repeat ? { repeat: parsed.repeat } : {}),
      ...(parsed.priority ? { priority: parsed.priority } : {}),
      ...(parsed.labels ? { labels: parsed.labels } : {}),
      ...rest,
    });
  };

  const complete = (task: Task) => {
    const stamp = new Date().toISOString();
    const next = task.due ? nextDue(task.due, task.repeat) : null;
    if (next) {
      // Repeating: log this run, then move the live task to its next date.
      api.add({ ...task, id: uid(), done: true, completedAt: stamp, repeat: undefined });
      api.patch(task.id, { due: next });
      toast.success(`Done — next one on ${next}`);
      return;
    }
    api.patch(task.id, { done: true, completedAt: stamp, stage: "done" });
  };

  const removeMany = (ids: string[]) => {
    const undo = api.remove(ids);
    setSelected((s) => s.filter((id) => !ids.includes(id)));
    toast(ids.length === 1 ? "Task deleted" : `${ids.length} tasks deleted`, {
      action: { label: "Undo", onClick: undo },
    });
  };

  const toggleSelect = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const rowFor = (task: Task, hideDue?: boolean) => (
    <TaskRow
      key={task.id}
      task={task}
      subtasks={api.childrenOf.get(task.id) ?? []}
      selected={selected}
      projects={api.projects}
      onToggleSelect={toggleSelect}
      onPatch={api.patch}
      onRemove={(id) => removeMany([id])}
      onComplete={complete}
      onAddSub={(parentId, title) => api.add({ title, parentId })}
      hideDue={hideDue}
      draggable
    />
  );

  /* ---------------------------------------------------------------- chrome */

  const title =
    view.kind === "project"
      ? (api.projects.find((p) => p.id === view.id)?.name ?? "Project")
      : view.kind === "label"
        ? `@${view.name}`
        : view.kind === "done"
          ? "Done"
          : view.kind === "search"
            ? "Search"
            : view.kind === "inbox"
              ? "Inbox"
              : view.kind === "today"
                ? "Today"
                : "Upcoming";

  const openHere =
    view.kind === "today"
      ? overdue.length + todayTasks.length
      : view.kind === "inbox"
        ? inboxTasks.length
        : view.kind === "upcoming"
          ? counts.upcoming
          : view.kind === "search"
            ? searchResults.length
            : view.kind === "project"
              ? projectTasks(view.id).filter((t) => !t.done).length
              : view.kind === "label"
                ? labelTasks(view.name).filter((t) => !t.done).length
                : api.tasks.filter((t) => t.done).length;

  const navItem = (
    active: boolean,
    icon: React.ReactNode,
    label: string,
    onClick: () => void,
    count?: number,
    isLocked?: boolean,
  ) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      aria-current={active}
      className={`flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-[14.5px] font-bold transition-colors ${
        active ? "bg-white text-[#23201d]" : "text-[#4a453d] hover:bg-white/70"
      } ${isLocked ? "opacity-50" : ""}`}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {isLocked ? (
        <Lock size={14} className="text-[#a29a8d]" />
      ) : (
        !!count && (
          <span className="text-[13px] font-black tabular-nums text-[#a29a8d]">{count}</span>
        )
      )}
    </button>
  );

  const go = (v: View) => {
    if (locked(v.kind)) {
      toast.info("That view is part of the paid plans.");
      return;
    }
    setView(v);
    setQuery("");
  };

  return (
    <div className="min-h-screen bg-[#fbf5e9] text-[#23201d]">
      <SiteHeader />

      <div data-tour="todo-header" className="border-b border-black/5">
        <div className="mx-auto flex max-w-[90rem] items-center gap-3 px-4 py-3 md:px-8">
          <button
            type="button"
            onClick={() => setRailOpen((r) => !r)}
            className="flex h-10 items-center gap-2 rounded-full border border-black/10 bg-white px-4 text-[13px] font-extrabold lg:hidden"
          >
            <ListChecks size={15} /> Lists
          </button>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b3aa9c]">
              To-do list
            </p>
            <p className="truncate text-[16px] font-black leading-tight">Keep the day light</p>
          </div>
          <Link
            to="/learn"
            className="ml-auto hidden h-10 items-center rounded-full border border-black/10 bg-white px-5 text-[13px] font-extrabold transition-colors hover:bg-black/[0.03] sm:flex"
          >
            All study tools
          </Link>
        </div>
      </div>

      <div className="mx-auto grid max-w-[90rem] gap-6 px-4 py-6 md:px-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside data-tour="todo-nav" className={`${railOpen ? "" : "hidden lg:block"} lg:sticky lg:top-6 lg:self-start`}>
          <div className="flex items-center gap-2 rounded-2xl px-3 py-2.5">

            <Search size={16} className="shrink-0 text-[#a29a8d]" />
            <input
              id="rita-todo-search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setView(e.target.value.trim() ? { kind: "search" } : { kind: "today" });
              }}
              placeholder="Search  /"
              className="w-full bg-transparent text-[14.5px] font-semibold text-[#23201d] outline-none placeholder:text-[#a29a8d]"
            />
          </div>

          <nav className="mt-1 space-y-0.5">
            {navItem(
              view.kind === "inbox",
              <Inbox size={17} style={{ color: "#f0a95c" }} />,
              "Inbox",
              () => go({ kind: "inbox" }),
              counts.inbox,
            )}
            {navItem(
              view.kind === "today",
              <Star size={17} style={{ color: "#6ab887" }} />,
              "Today",
              () => go({ kind: "today" }),
              counts.today,
              locked("today"),
            )}
            {navItem(
              view.kind === "upcoming",
              <CalendarDays size={17} style={{ color: "#6aa9d8" }} />,
              "Upcoming",
              () => go({ kind: "upcoming" }),
              counts.upcoming,
              locked("upcoming"),
            )}
          </nav>

          <div className="mt-5">
            <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#b3aa9c]">
              Projects
            </p>
            <div className="space-y-0.5">
              {api.projects.map((p) =>
                navItem(
                  view.kind === "project" && view.id === p.id,
                  <span className="h-3 w-3 rounded-full" style={{ background: p.color }} />,
                  p.name,
                  () => go({ kind: "project", id: p.id }),
                  projectTasks(p.id).filter((t) => !t.done).length,
                  locked("project"),
                ),
              )}
              <button
                type="button"
                onClick={() => {
                  if (locked("project")) {
                    toast.info("Projects are part of the paid plans.");
                    return;
                  }
                  setProjectOpen(true);
                }}
                className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-[13.5px] font-bold text-[#a29a8d] hover:bg-white/70 hover:text-[#4c9a2a]"
              >
                <Plus size={15} /> New project
              </button>
            </div>
          </div>

          {api.labels.length > 0 && (
            <div className="mt-4">
              <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#b3aa9c]">
                Labels
              </p>
              <div className="flex flex-wrap gap-1.5 px-2">
                {api.labels.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => go({ kind: "label", name: l })}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-extrabold transition-colors ${
                      view.kind === "label" && view.name === l
                        ? "bg-[#23201d] text-white"
                        : "bg-white text-[#8a7f6c] hover:bg-white/70"
                    }`}
                  >
                    <Hash size={11} />
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        <main className="min-w-0">
          <div data-tour="todo-tasks" className="flex max-h-[80vh] min-h-[78vh] flex-col rounded-[28px] bg-white p-5 md:p-8">
            <div className="shrink-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1
                  className="font-display font-black leading-[1.05] tracking-tight"
                  style={{ fontSize: "clamp(1.7rem, 3vw, 2.3rem)" }}
                >
                  {title}
                </h1>
                {view.kind === "project" && (
                  <button
                    type="button"
                    onClick={() => setBoardMode((b) => !b)}
                    className="ml-auto flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-3 py-1.5 text-[12.5px] font-extrabold text-[#3c372f] hover:bg-[#fbf5e9]"
                  >
                    {boardMode ? <ListChecks size={14} /> : <Columns3 size={14} />}
                    {boardMode ? "List view" : "Board view"}
                  </button>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <p className="text-[13.5px] font-semibold text-[#a29a8d]">
                  {openHere} task{openHere === 1 ? "" : "s"} left
                </p>
                {view.kind !== "done" && (
                  <button
                    type="button"
                    onClick={() => setShowDone((s) => !s)}
                    className="flex items-center gap-1.5 rounded-full border border-black/[0.08] px-3 py-1 text-[12px] font-extrabold text-[#6d675e] hover:bg-[#fbf5e9]"
                  >
                    <CheckCircle2 size={13} className="text-[#4c9a2a]" />
                    {showDone ? "Hide completed" : "Show completed"}
                  </button>
                )}
              </div>

              <SelectionBar
                count={selected.length}
                onDone={() => {
                  for (const id of selected) {
                    const t = api.tasks.find((x) => x.id === id);
                    if (t && !t.done) complete(t);
                  }
                  setSelected([]);
                  toast.success("Nice — marked done");
                }}
                onStar={(starred) => api.patchMany(selected, { starred })}
                onPriority={(p) => api.patchMany(selected, { priority: p })}

                onDue={(days) =>
                  api.patchMany(selected, {
                    due: days === null ? undefined : addDays(today(), days),
                  })
                }
                onDate={(date) => api.patchMany(selected, { due: date })}
                onDelete={() => removeMany(selected)}
                onClear={() => setSelected([])}
              />
            </div>

            <div className="mt-5 flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">
              {view.kind === "search" && (
                <div className="flex flex-col">
                  {searchResults.length === 0 ? (
                    <p className="py-10 text-center text-[15px] font-bold text-[#a29a8d]">
                      Nothing matches “{query}”.
                    </p>
                  ) : (
                    searchResults.map((t) => rowFor(t))
                  )}
                </div>
              )}

              {view.kind === "inbox" && (
                <div className="flex flex-col">
                  {inboxTasks.map((t) => rowFor(t))}
                  {inboxTasks.length === 0 && (
                    <p className="py-8 text-[15px] font-bold text-[#a29a8d]">
                      Inbox is clear — anything without a date lands here.
                    </p>
                  )}
                  <QuickAdd id="rita-quick-add" onAdd={(p) => addFromParsed(p)} />
                </div>
              )}

              {view.kind === "today" && (
                <div className="flex flex-col">
                  {overdue.length > 0 && (
                    <section className="mb-5">
                      <div className="flex items-center gap-3 border-b border-[#d1795e]/30 pb-2">
                        <h2 className="text-[14px] font-black text-[#a8462c]">
                          Overdue · {overdue.length}
                        </h2>
                        <button
                          type="button"
                          onClick={() => {
                            api.patchMany(
                              overdue.map((t) => t.id),
                              { due: today() },
                            );
                            toast.success("Moved to today");
                          }}
                          className="ml-auto rounded-full bg-[#fbeae4] px-3 py-1.5 text-[12.5px] font-extrabold text-[#a8462c]"
                        >
                          Move all to today
                        </button>
                      </div>
                      <div className="flex flex-col pt-2">{overdueRows.map((t) => rowFor(t))}</div>
                    </section>
                  )}
                  {todayTasks.map((t) => rowFor(t, true))}
                  {todayTasks.length === 0 && overdue.length === 0 && (
                    <p className="py-8 text-[15px] font-bold text-[#a29a8d]">
                      Nothing due today — add something below.
                    </p>
                  )}
                  <QuickAdd id="rita-quick-add" onAdd={(p) => addFromParsed(p, { due: today() })} />
                </div>
              )}

              {view.kind === "upcoming" && (
                <TodoUpcoming
                  byDay={byDay}
                  overdue={overdue}
                  onRescheduleOverdue={() => {
                    api.patchMany(
                      overdue.map((t) => t.id),
                      { due: today() },
                    );
                    toast.success("Moved to today");
                  }}
                  renderRow={(t) => rowFor(t, true)}
                  onAdd={(day, parsed) => addFromParsed(parsed, { due: parsed.due ?? day })}
                  onDropTask={(id, day) => {
                    api.patch(id, { due: day });
                    toast.success(`Moved to ${day}`);
                  }}
                />
              )}

              {view.kind === "done" && (
                <TodoDoneView
                  tasks={api.tasks}
                  goal={goal}
                  onGoal={setGoal}
                  onUndo={(id) => api.patch(id, { done: false, completedAt: undefined })}
                />
              )}

              {view.kind === "project" &&
                (boardMode ? (
                  <TodoBoardView
                    tasks={projectTasks(view.id)}
                    onStage={(id, stage) =>
                      api.patch(id, {
                        stage,
                        done: stage === "done",
                        completedAt: stage === "done" ? new Date().toISOString() : undefined,
                      })
                    }
                  />
                ) : (
                  <div className="flex flex-col">
                    {projectTasks(view.id).map((t) => rowFor(t))}
                    <QuickAdd
                      id="rita-quick-add"
                      onAdd={(p) => addFromParsed(p, { projectId: view.id })}
                    />
                  </div>
                ))}

              {view.kind === "label" && (
                <div className="flex flex-col">
                  {labelTasks(view.name).map((t) => rowFor(t))}
                  {labelTasks(view.name).length === 0 && (
                    <p className="py-8 text-[15px] font-bold text-[#a29a8d]">
                      No tasks with @{view.name}.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <PromptDialog
        open={projectOpen}
        onOpenChange={setProjectOpen}
        title="New project"
        description="A folder for related tasks."
        label="Project name"
        placeholder="e.g. Finals week"
        confirmLabel="Create project"
        onSubmit={(v) => api.addProject(v)}
      />
    </div>
  );
}

/** Toolbar that appears above the list once one or more tasks are selected. */
function SelectionBar({
  count,
  onDone,
  onStar,
  onPriority,
  onDue,
  onDate,
  onDelete,
  onClear,
}: {
  count: number;
  onDone: () => void;
  onStar: (starred: boolean) => void;
  onPriority: (p: PriorityKey) => void;
  onDue: (days: number | null) => void;
  onDate: (date: string) => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  if (count === 0) {
    return null;
  }

  const chip =
    "flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-3 py-1.5 text-[12.5px] font-extrabold text-[#3c372f] transition-colors hover:bg-[#fbf5e9]";
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-black/[0.07] bg-[#fbf5e9] px-3 py-2.5">
      <span className="rounded-full bg-[#23201d] px-3 py-1.5 text-[12.5px] font-black text-white">
        {count} selected
      </span>

      <button type="button" onClick={onDone} className={chip}>
        <CheckCircle2 size={14} className="text-[#4c9a2a]" /> Done
      </button>

      <button type="button" onClick={() => onStar(true)} className={chip}>
        <Star size={14} fill="#f0a95c" style={{ color: "#f0a95c" }} /> Star
      </button>
      <button type="button" onClick={() => onStar(false)} className={chip}>
        <Star size={14} className="text-[#a29a8d]" /> Unstar
      </button>

      <span className="mx-0.5 h-6 w-px bg-black/10" />


      {PRIORITIES.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => onPriority(p.key)}
          className={chip}
          title={`Flag as ${p.label}`}
        >
          <span className="h-3 w-3 rounded-full" style={{ background: p.bar }} />
          {p.label}
        </button>
      ))}

      <span className="mx-0.5 h-6 w-px bg-black/10" />

      <button type="button" onClick={() => onDue(0)} className={chip}>
        <CalendarDays size={14} className="text-[#6aa9d8]" /> Today
      </button>
      <button type="button" onClick={() => onDue(1)} className={chip}>
        Tomorrow
      </button>
      <button type="button" onClick={() => onDue(7)} className={chip}>
        Next week
      </button>
      <label className={chip}>
        Pick date
        <input
          type="date"
          min={iso(new Date(2000, 0, 1))}
          onChange={(e) => e.target.value && onDate(e.target.value)}
          className="w-[7.5rem] bg-transparent text-[12.5px] font-extrabold outline-none"
        />
      </label>
      <button type="button" onClick={() => onDue(null)} className={chip}>
        Clear date
      </button>

      <span className="mx-0.5 h-6 w-px bg-black/10" />

      <button
        type="button"
        onClick={onDelete}
        className="flex items-center gap-1.5 rounded-full border border-[#d1795e]/40 bg-white px-3 py-1.5 text-[12.5px] font-extrabold text-[#a8462c] transition-colors hover:bg-[#fbeae4]"
      >
        <Trash2 size={14} /> Delete
      </button>
      <button
        type="button"
        onClick={onClear}
        className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-bold text-[#6d675e] hover:bg-white"
      >
        <X size={14} /> Clear selection
      </button>
    </div>
  );
}
