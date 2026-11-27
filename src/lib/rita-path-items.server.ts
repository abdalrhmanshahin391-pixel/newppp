// Reading the exercise / resources stops of a lesson path (rita_path_items). Server only.
import { mergePath, type PathItem } from "./rita-path-layout";

const NOT_APPLIED = /could not find|does not exist|schema cache|PGRST20[0-9]|42P01/i;

/**
 * The stops placed on a language's path, with how many files and links each holds. Before the
 * migration is applied there are none, and the path works as before.
 */
export async function pathItemsFor(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  language: string | null,
): Promise<PathItem[]> {
  try {
    const { data, error } = await db
      .from("rita_path_items")
      .select("*")
      .eq("language", language ?? "en")
      .order("path_order");
    if (error) {
      if (!NOT_APPLIED.test(`${error.code ?? ""} ${error.message ?? ""}`))
        console.warn("Path items unavailable", error.message);
      return [];
    }
    const rows = (data ?? []) as {
      id: string;
      kind: string;
      title: string;
      path_order: number;
      map_level?: PathItem["map_level"] | null;
      quiz_count?: number;
      film_lines?: number[];
      clip_ids?: string[] | null;
      gif_lines?: number[];
      exercise_mode?: string | null;
      clip_exercises?: string[] | null;
    }[];
    const counts: Record<string, number> = {};
    const resourceIds = rows.filter((row) => row.kind === "resources").map((row) => row.id);
    if (resourceIds.length) {
      const { data: resources } = await db
        .from("rita_path_item_resources")
        .select("item_id")
        .in("item_id", resourceIds);
      for (const row of (resources ?? []) as { item_id: string }[])
        counts[row.item_id] = (counts[row.item_id] ?? 0) + 1;
    }
    return rows.map((row) => ({
      id: row.id,
      kind:
        row.kind === "resources" || row.kind === "finish" || row.kind === "unit"
          ? row.kind
          : "exercises",
      title: row.title,
      path_order: Number(row.path_order),
      map_level: row.map_level ?? undefined,
      film_lines: row.film_lines ?? [],
      ...(Array.isArray(row.clip_ids) ? { clip_ids: row.clip_ids } : {}),
      gif_lines: row.gif_lines ?? [],
      quiz_count: row.quiz_count ?? 0,
      exercise_mode:
        row.exercise_mode === "quiz" || row.exercise_mode === "clips" ? row.exercise_mode : null,
      clip_exercises: Array.isArray(row.clip_exercises) ? row.clip_exercises : null,
      resource_count: counts[row.id] ?? 0,
    }));
  } catch (cause) {
    console.warn("Path items unavailable", cause);
    return [];
  }
}

export type PathNode = { type: "lesson" | "item"; id: string; title: string; kind?: string };

/**
 * The path of one language as the admin sees it (lessons that are not archived and the stops
 * between them), in order, with titles. Errors are returned for the caller to report.
 */
export async function adminPathNodes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  language: string,
): Promise<{ nodes: PathNode[]; error: { message?: string; code?: string } | null }> {
  const [lessonResult, itemResult] = await Promise.all([
    db
      .from("rita_lessons")
      .select("id, title, title_ar, path_order, curriculum:rita_curricula!inner(target_language)")
      .neq("status", "archived")
      .eq("curriculum.target_language", language)
      .order("path_order"),
    db
      .from("rita_path_items")
      .select("id, kind, title, path_order")
      .eq("language", language)
      .order("path_order"),
  ]);
  const error = lessonResult.error ?? itemResult.error ?? null;
  if (error) return { nodes: [], error };
  const lessons = (
    (lessonResult.data ?? []) as {
      id: string;
      title: string;
      title_ar: string | null;
      path_order: number | null;
    }[]
  ).filter((row) => row.path_order != null);
  const items = (
    (itemResult.data ?? []) as {
      id: string;
      kind: string;
      title: string;
      path_order: number;
    }[]
  ).map((row) => ({
    ...row,
    kind: (row.kind === "resources" || row.kind === "finish" || row.kind === "unit"
      ? row.kind
      : "exercises") as PathItem["kind"],
    resource_count: 0,
  }));
  return {
    nodes: mergePath(lessons, items).map((node) =>
      node.type === "lesson"
        ? {
            type: "lesson" as const,
            id: node.lesson.id,
            title: node.lesson.title_ar || node.lesson.title,
          }
        : { type: "item" as const, id: node.item.id, title: node.item.title, kind: node.item.kind },
    ),
    error: null,
  };
}
