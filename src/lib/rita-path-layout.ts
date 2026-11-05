// The learner's lesson path mixes two kinds of stops: lessons (rita_lessons, integer path_order)
// and path items an admin places between them (rita_path_items: exercises or resources, with a
// fractional path_order in the same number space). Pure: merging, moving and the orders to save.

export type PathItemKind = "exercises" | "resources";

export type PathItem = {
  id: string;
  kind: PathItemKind;
  title: string;
  path_order: number;
  resource_count: number;
};

export type PathRef = { type: "lesson" | "item"; id: string };

/** One list in path order: by path_order, lessons without an order at the end in their order. */
export function mergePath<L extends { id: string; path_order: number | null }>(
  lessons: L[],
  items: PathItem[],
): ({ type: "lesson"; lesson: L } | { type: "item"; item: PathItem })[] {
  const ordered = lessons.filter((lesson) => lesson.path_order != null);
  const unordered = lessons.filter((lesson) => lesson.path_order == null);
  const nodes: {
    order: number;
    tie: number;
    node: { type: "lesson"; lesson: L } | { type: "item"; item: PathItem };
  }[] = [
    ...ordered.map((lesson, index) => ({
      order: Number(lesson.path_order),
      tie: index,
      node: { type: "lesson" as const, lesson },
    })),
    ...items.map((item, index) => ({
      order: Number(item.path_order),
      tie: 10_000 + index,
      node: { type: "item" as const, item },
    })),
  ];
  nodes.sort((a, b) => a.order - b.order || a.tie - b.tie);
  return [
    ...nodes.map((entry) => entry.node),
    ...unordered.map((lesson) => ({ type: "lesson" as const, lesson })),
  ];
}

/** Swaps two stops (the admin dropped one onto the other). The same list when either is missing. */
export function swapRefs(list: PathRef[], a: string, b: string): PathRef[] {
  const from = list.findIndex((ref) => ref.id === a);
  const to = list.findIndex((ref) => ref.id === b);
  if (from < 0 || to < 0 || from === to) return list;
  const next = list.slice();
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** Puts a stop at `index` (0 = before the first, list.length = at the end). */
export function insertRef(list: PathRef[], index: number, ref: PathRef): PathRef[] {
  const at = Math.max(0, Math.min(list.length, Math.round(index)));
  return [...list.slice(0, at), ref, ...list.slice(at)];
}

/**
 * The orders to save for a new layout. Lessons keep the integer slots they already hold (sorted),
 * handed out in the new order, so lessons of other books and languages are never renumbered.
 * Items get fractions between the lesson before and the lesson after them.
 */
export function layoutOrders(
  list: PathRef[],
  lessonSlots: Record<string, number>,
): { lessons: { id: string; path_order: number }[]; items: { id: string; path_order: number }[] } {
  const lessonIds = list.filter((ref) => ref.type === "lesson").map((ref) => ref.id);
  const known = lessonIds.map((id) => lessonSlots[id]).filter((slot) => Number.isFinite(slot));
  let top = known.length ? Math.max(...known) : 0;
  // A lesson without a slot gets one after the last used slot.
  const slots = lessonIds
    .map((id) => (Number.isFinite(lessonSlots[id]) ? lessonSlots[id] : (top += 1)))
    .sort((a, b) => a - b);
  const lessons = lessonIds.map((id, index) => ({ id, path_order: slots[index] }));
  const slotOf = new Map(lessons.map((lesson) => [lesson.id, lesson.path_order]));

  const items: { id: string; path_order: number }[] = [];
  let index = 0;
  let before = slots.length ? slots[0] - 1 : 0;
  while (index < list.length) {
    const ref = list[index];
    if (ref.type === "lesson") {
      before = slotOf.get(ref.id) ?? before;
      index += 1;
      continue;
    }
    // A run of items between `before` and the next lesson.
    const run: string[] = [];
    while (index < list.length && list[index].type === "item") {
      run.push(list[index].id);
      index += 1;
    }
    const nextLesson = index < list.length ? slotOf.get(list[index].id) : undefined;
    const after = nextLesson ?? before + 1;
    run.forEach((id, k) => {
      const value = before + ((after - before) * (k + 1)) / (run.length + 1);
      items.push({ id, path_order: Math.round(value * 1e6) / 1e6 });
    });
  }
  return { lessons, items };
}

/** Where the admin's browser uploads a resources stop's PDF (the server checks this shape). */
export function pathItemPdfPath(itemId: string, fileId: string): string {
  return `path-items/${itemId}/${fileId}.pdf`;
}
