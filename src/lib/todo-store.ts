import { toast } from "sonner";
import { usePlan } from "@/hooks/usePlan";
// Rita to-do storage. Local-first: one debounced localStorage write, an index
// by ISO day so a view only touches the days it renders, and a one-off
// migration from the old "inbox / today / upcoming" boxes to date-driven views.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const TASKS_KEY = "rita_todo_tasks";
const PROJECTS_KEY = "rita_todo_projects";

export type PriorityKey = "none" | "low" | "important" | "urgent";
export type Stage = "todo" | "doing" | "done";

export type Task = {
  id: string;
  title: string;
  note?: string;
  /** ISO date (yyyy-mm-dd). No date = Inbox. */
  due?: string;
  /** Optional clock time, "HH:MM". */
  time?: string;
  /** Repeat rule, see todo-recurrence.ts. */
  repeat?: string;
  done?: boolean;
  completedAt?: string;
  starred?: boolean;
  priority?: PriorityKey;
  parentId?: string;
  projectId?: string;
  labels?: string[];
  stage?: Stage;
  order: number;
};

export type Project = {
  id: string;
  name: string;
  color: string;
  favorite?: boolean;
};

export const PRIORITIES: { key: PriorityKey; label: string; bar: string; tint: string }[] = [
  { key: "none", label: "No flag", bar: "#ded6c7", tint: "transparent" },
  { key: "low", label: "Low", bar: "#6aa9d8", tint: "#eef5fb" },
  { key: "important", label: "Important", bar: "#f0a95c", tint: "#fdf1e2" },
  { key: "urgent", label: "Urgent", bar: "#d1795e", tint: "#fbeae4" },
];

const LEGACY_PRIORITY: Record<string, PriorityKey> = {
  blue: "low",
  orange: "important",
  red: "urgent",
};

export const priorityOf = (key?: PriorityKey) =>
  PRIORITIES.find((p) => p.key === (LEGACY_PRIORITY[key as string] ?? key ?? "none")) ??
  PRIORITIES[0];

export const PROJECT_COLORS = ["#6ab887", "#6aa9d8", "#f0a95c", "#d1795e", "#a58fd8", "#4c9a2a"];

/* ------------------------------------------------------------------ dates */

export const iso = (d: Date) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return z.toISOString().slice(0, 10);
};
export const today = () => iso(new Date());
export const addDays = (dateIso: string, n: number) => {
  const d = new Date(`${dateIso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return iso(d);
};
export const dateOf = (dateIso: string) => new Date(`${dateIso}T00:00:00`);

export function dayLabel(dateIso: string) {
  const d = dateOf(dateIso);
  const nice = d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const weekday = d.toLocaleDateString(undefined, { weekday: "long" });
  if (dateIso === today()) return `${nice} · Today · ${weekday}`;
  if (dateIso === addDays(today(), 1)) return `${nice} · Tomorrow · ${weekday}`;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return sameYear ? `${nice} · ${weekday}` : `${nice} ${d.getFullYear()} · ${weekday}`;
}

export const shortDate = (dateIso: string) =>
  dateOf(dateIso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(dateOf(dateIso).getFullYear() === new Date().getFullYear() ? {} : { year: "numeric" }),
  });

/**
 * Todoist-style date chip: a relative word where one reads naturally, plus the
 * colour that tells overdue from today from later at a glance.
 */
export function relDate(dateIso: string): { text: string; ink: string; bg: string } {
  const t = today();
  const overdue = { ink: "#a8462c", bg: "#fbeae4" };
  const now = { ink: "#3d7a1c", bg: "#eaf4e1" };
  const later = { ink: "#8a7f6c", bg: "#f4f1ea" };
  if (dateIso === t) return { text: "Today", ...now };
  if (dateIso === addDays(t, -1)) return { text: "Yesterday", ...overdue };
  if (dateIso === addDays(t, 1)) return { text: "Tomorrow", ...later };
  if (dateIso < t) return { text: shortDate(dateIso), ...overdue };
  const weekday = dateOf(dateIso).toLocaleDateString(undefined, { weekday: "short" });
  if (dateIso <= addDays(t, 6)) return { text: `${weekday} ${shortDate(dateIso)}`, ...later };
  return { text: shortDate(dateIso), ...later };
}

export const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;


/* --------------------------------------------------------------- migration */

type LegacyTask = Partial<Task> & { list?: string; due?: string };

function migrate(raw: unknown): Task[] {
  if (!Array.isArray(raw)) return [];
  return (raw as LegacyTask[])
    .filter((t) => t && typeof t.title === "string")
    .map((t, i) => {
      const legacyList = t.list;
      // Old model: the box decided the view. New model: the date does.
      let due = t.due;
      if (!due && legacyList === "today") due = today();
      const task: Task = {
        id: t.id ?? uid(),
        title: t.title as string,
        order: typeof t.order === "number" ? t.order : i,
      };
      if (t.note) task.note = t.note;
      if (due) task.due = due;
      if (t.time) task.time = t.time;
      if (t.repeat) task.repeat = t.repeat;
      if (t.done) task.done = true;
      if (t.completedAt) task.completedAt = t.completedAt;
      else if (t.done) task.completedAt = new Date().toISOString();
      if (t.starred) task.starred = true;
      if (t.priority) task.priority = LEGACY_PRIORITY[t.priority as string] ?? t.priority;
      if (t.parentId) task.parentId = t.parentId;
      if (t.projectId) task.projectId = t.projectId;
      if (t.labels?.length) task.labels = t.labels;
      if (t.stage) task.stage = t.stage;
      return task;
    });
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/* ------------------------------------------------------------------- hook */

export type TodoApi = ReturnType<typeof useTodos>;

export function useTodos() {
  const { maxTodoTasks, maxCalendarItems } = usePlan();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTasks(migrate(read<unknown>(TASKS_KEY, [])));
    setProjects(read<Project[]>(PROJECTS_KEY, []));
    setHydrated(true);
  }, []);

  // Debounced write — typing fast never blocks the UI thread with JSON work.
  useEffect(() => {
    if (!hydrated) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
        window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
      } catch {
        /* quota — ignore */
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [tasks, projects, hydrated]);

  /**
   * Tasks grouped by ISO day, so a rendered day is an O(1) lookup. Finished
   * tasks stay in their day — they simply sink to the bottom of it.
   */
  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.due || t.parentId) continue;
      const arr = map.get(t.due);
      if (arr) arr.push(t);
      else map.set(t.due, [t]);
    }
    for (const arr of map.values())
      arr.sort((a, b) => Number(!!a.done) - Number(!!b.done) || a.order - b.order);
    return map;
  }, [tasks]);

  const childrenOf = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.parentId) continue;
      const arr = map.get(t.parentId);
      if (arr) arr.push(t);
      else map.set(t.parentId, [t]);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.order - b.order);
    return map;
  }, [tasks]);

  const add = useCallback(
    (task: Partial<Task> & { title: string }) => {
      const clean = task.title.trim();
      if (!clean) return null;

      // Plan caps: undated tasks count as to-do, dated ones as calendar entries.
      const dated = !!task.due;
      const cap = dated ? maxCalendarItems : maxTodoTasks;
      if (cap !== null) {
        const used = tasks.filter((t) => (t.due ? dated : !dated)).length;
        if (used >= cap) {
          toast.error(
            dated
              ? `Your plan includes ${cap} calendar entries. Open the Plans page to add more.`
              : `Your plan includes ${cap} to-do tasks. Open the Plans page to add more.`,
          );
          return null;
        }
      }

      const full: Task = { order: Date.now(), ...task, title: clean, id: task.id ?? uid() };
      setTasks((t) => [...t, full]);
      return full;
    },
    [tasks, maxCalendarItems, maxTodoTasks],
  );

  const patch = useCallback(
    (id: string, p: Partial<Task>) =>
      setTasks((t) => t.map((x) => (x.id === id ? { ...x, ...p } : x))),
    [],
  );

  const patchMany = useCallback(
    (ids: string[], p: Partial<Task>) =>
      setTasks((t) => t.map((x) => (ids.includes(x.id) ? { ...x, ...p } : x))),
    [],
  );

  /** Removes the tasks and any sub-tasks under them. Returns what went, for undo. */
  const remove = useCallback((ids: string[]) => {
    let gone: Task[] = [];
    setTasks((t) => {
      gone = t.filter((x) => ids.includes(x.id) || (x.parentId && ids.includes(x.parentId)));
      return t.filter((x) => !gone.includes(x));
    });
    return () => setTasks((t) => [...t, ...gone]);
  }, []);

  const restore = useCallback((rows: Task[]) => setTasks((t) => [...t, ...rows]), []);

  const addProject = useCallback((name: string) => {
    const clean = name.trim();
    if (!clean) return;
    setProjects((p) => [
      ...p,
      { id: uid(), name: clean, color: PROJECT_COLORS[p.length % PROJECT_COLORS.length] },
    ]);
  }, []);

  const patchProject = useCallback(
    (id: string, p: Partial<Project>) =>
      setProjects((list) => list.map((x) => (x.id === id ? { ...x, ...p } : x))),
    [],
  );

  const removeProject = useCallback((id: string) => {
    setProjects((list) => list.filter((x) => x.id !== id));
    setTasks((t) => t.map((x) => (x.projectId === id ? { ...x, projectId: undefined } : x)));
  }, []);

  const labels = useMemo(() => {
    const set = new Set<string>();
    for (const t of tasks) for (const l of t.labels ?? []) set.add(l);
    return [...set].sort();
  }, [tasks]);

  return {
    tasks,
    setTasks,
    projects,
    labels,
    hydrated,
    byDay,
    childrenOf,
    add,
    patch,
    patchMany,
    remove,
    restore,
    addProject,
    patchProject,
    removeProject,
  };
}
