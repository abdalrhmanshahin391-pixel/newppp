import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { FIX_WHERE_LABEL, STATUS_LABEL, type IssueRow } from "@/lib/rita-quality";

const PAGE = 20;

function Row({ row, titleOf }: { row: IssueRow; titleOf: (id: string) => string | undefined }) {
  const { issue, derived } = row;
  const suggested = issue.suggested_merge_into ? titleOf(issue.suggested_merge_into) : undefined;
  const hot = derived.status === "regressed" || derived.status === "failing";
  return (
    <li>
      {/* dir="auto": an Arabic title makes the whole row right-to-left, so it reads as one line. */}
      <Link
        dir="auto"
        to="/admin/rita-quality/$issueId"
        params={{ issueId: issue.id }}
        className="flex items-center gap-3 rounded-2xl border border-[var(--pp-line)] p-4 transition-colors hover:bg-[var(--pp-grey)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pp-ink)] sm:p-5"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-semibold leading-[1.35]">{issue.title}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-[var(--pp-muted)]">
            <bdi
              className={
                hot
                  ? "font-semibold text-[var(--pp-ink)]"
                  : derived.status === "open"
                    ? "font-semibold text-[var(--pp-accent-text)]"
                    : ""
              }
            >
              {STATUS_LABEL[derived.status]}
              {derived.status === "watching" ? ` (${derived.checked}/${derived.needed})` : ""}
            </bdi>
            <bdi>
              {row.reviews.length} {row.reviews.length === 1 ? "example" : "examples"}
            </bdi>
            <bdi>Fix in: {FIX_WHERE_LABEL[issue.fix_where] ?? issue.fix_where}</bdi>
          </span>
          {suggested ? (
            <span className="mt-1 block text-[14px] text-[var(--pp-ink)]">
              Maybe the same as: <bdi>{suggested}</bdi>
            </span>
          ) : null}
        </span>
        <ChevronRight
          size={20}
          aria-hidden="true"
          className="shrink-0 text-[var(--pp-muted)] rtl:rotate-180"
        />
      </Link>
    </li>
  );
}

/** A list of problem cards, biggest impact first (the order comes from buildIssueRows). */
export function IssueList({
  rows,
  allRows,
  limit,
  emptyText,
}: {
  rows: IssueRow[];
  /** Every issue, so a merge hint can name the card it points to. */
  allRows: IssueRow[];
  limit?: number;
  emptyText: string;
}) {
  const [shown, setShown] = useState(limit ?? PAGE);
  const titles = new Map(allRows.map((row) => [row.issue.id, row.issue.title]));
  const titleOf = (id: string) => titles.get(id);
  if (!rows.length) {
    return <p className="rounded-2xl bg-[var(--pp-grey)] p-5 text-[16px]">{emptyText}</p>;
  }
  return (
    <>
      <ul className="grid gap-3">
        {rows.slice(0, shown).map((row) => (
          <Row key={row.issue.id} row={row} titleOf={titleOf} />
        ))}
      </ul>
      {!limit && rows.length > shown ? (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="rita-btn rita-btn-soft rita-btn-sm mt-4"
        >
          Show {Math.min(PAGE, rows.length - shown)} more
        </button>
      ) : null}
    </>
  );
}
