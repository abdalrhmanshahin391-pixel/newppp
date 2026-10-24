import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { FIX_WHERE_LABEL, STATUS_LABEL, type IssueRow } from "@/lib/rita-quality";

const PAGE = 20;

function Row({ row, titleOf }: { row: IssueRow; titleOf: (id: string) => string | undefined }) {
  const { issue, derived } = row;
  const suggested = issue.suggested_merge_into ? titleOf(issue.suggested_merge_into) : undefined;
  return (
    <li>
      <Link
        to="/admin/rita-quality/$issueId"
        params={{ issueId: issue.id }}
        className="block rounded-2xl border border-[var(--pp-line)] p-4 transition-colors hover:bg-[var(--pp-grey)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pp-ink)] sm:p-5"
      >
        <p dir="auto" className="text-[17px] font-semibold leading-[1.35]">
          {issue.title}
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-[var(--pp-muted)]">
          <span
            className={
              derived.status === "regressed"
                ? "font-semibold text-[var(--pp-ink)]"
                : derived.status === "open"
                  ? "font-semibold text-[var(--pp-accent-text)]"
                  : ""
            }
          >
            {STATUS_LABEL[derived.status]}
            {derived.status === "watching" ? ` (${derived.checked}/${derived.needed})` : ""}
          </span>
          <span>
            {row.reviews.length} {row.reviews.length === 1 ? "example" : "examples"}
          </span>
          <span>Fix in: {FIX_WHERE_LABEL[issue.fix_where] ?? issue.fix_where}</span>
        </p>
        {suggested ? (
          <p dir="auto" className="mt-2 text-[14px] text-[var(--pp-ink)]">
            Maybe the same as: {suggested}
          </p>
        ) : null}
      </Link>
    </li>
  );
}

/** "Fix next": the issues that still need work, biggest impact first; closed ones fold away. */
export function IssueList({ rows }: { rows: IssueRow[] }) {
  const [shown, setShown] = useState(PAGE);
  const titles = new Map(rows.map((row) => [row.issue.id, row.issue.title]));
  const titleOf = (id: string) => titles.get(id);
  const working = rows.filter(
    (row) => !["not_an_issue", "merged", "resolved"].includes(row.derived.status),
  );
  const closed = rows.filter((row) => ["not_an_issue", "resolved"].includes(row.derived.status));
  return (
    <section aria-labelledby="fix-next-title" className="mt-10">
      <h2 id="fix-next-title" className="text-[22px] font-semibold">
        Fix next
      </h2>
      {working.length === 0 ? (
        <p className="mt-3 rounded-2xl bg-[var(--pp-grey)] p-5 text-[16px]">
          No open problems. Reviews of new conversations will add cards here.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {working.slice(0, shown).map((row) => (
            <Row key={row.issue.id} row={row} titleOf={titleOf} />
          ))}
        </ul>
      )}
      {working.length > shown ? (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="rita-btn rita-btn-secondary rita-btn-sm mt-4"
        >
          Show {Math.min(PAGE, working.length - shown)} more
        </button>
      ) : null}
      {closed.length ? (
        <details className="mt-6">
          <summary className="min-h-[44px] cursor-pointer py-2 text-[15px] font-semibold text-[var(--pp-muted)]">
            Solved or dismissed ({closed.length})
          </summary>
          <ul className="mt-3 grid gap-3">
            {closed.map((row) => (
              <Row key={row.issue.id} row={row} titleOf={titleOf} />
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
