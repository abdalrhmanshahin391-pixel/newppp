/** Page coverage is derived from actual lesson ranges, never a high-water cursor. */
export function curriculumCoverage(
  pageCount: number,
  lessons: { status: string; source_from_page: number; source_to_page: number }[],
) {
  const count = Math.max(0, Math.floor(pageCount));
  const coverage = Array.from({ length: count }, () => ({ lessons: 0, published: 0 }));
  for (const lesson of lessons) {
    if (lesson.status === "archived") continue;
    for (
      let n = Math.max(1, lesson.source_from_page);
      n <= Math.min(count, lesson.source_to_page);
      n++
    ) {
      coverage[n - 1].lessons++;
      if (lesson.status === "published") coverage[n - 1].published++;
    }
  }
  const gaps: { from: number; to: number }[] = [];
  for (let n = 0; n < count; n++) {
    if (coverage[n].lessons) continue;
    const from = n + 1;
    while (n + 1 < count && !coverage[n + 1].lessons) n++;
    gaps.push({ from, to: n + 1 });
  }
  return {
    coverage,
    gaps,
    covered: coverage.filter((p) => p.lessons).length,
    published: coverage.filter((p) => p.published).length,
    overlaps: coverage.filter((p) => p.lessons > 1).length,
  };
}
