// Reading the exercise / resources stops of a lesson path (rita_path_items). Server only.
import type { PathItem } from "./rita-path-layout";

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
      .select("id, kind, title, path_order")
      .eq("language", language ?? "en")
      .order("path_order");
    if (error) {
      if (!NOT_APPLIED.test(`${error.code ?? ""} ${error.message ?? ""}`))
        console.warn("Path items unavailable", error.message);
      return [];
    }
    const rows = (data ?? []) as { id: string; kind: string; title: string; path_order: number }[];
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
      kind: row.kind === "resources" || row.kind === "finish" ? row.kind : "exercises",
      title: row.title,
      path_order: Number(row.path_order),
      resource_count: counts[row.id] ?? 0,
    }));
  } catch (cause) {
    console.warn("Path items unavailable", cause);
    return [];
  }
}
