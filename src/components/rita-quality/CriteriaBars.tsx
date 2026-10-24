import { CRITERION_IDS } from "@/lib/rita-tutor-contract";
import type { BuildHealth } from "@/lib/rita-quality";

const LABEL: Record<string, string> = {
  answered_question: "Answers the question",
  language_facts: "Language facts are true",
  dialect_and_address: "Jordanian wording, any gender",
  voice_fit: "Made for the ear",
  teaching: "Teaching",
  continuity: "Remembers the conversation",
  reply_language: "Right language",
};

/** Rita against the reference reply on each of the seven criteria (1 to 5), weakest first. */
export function CriteriaBars({ health }: { health: BuildHealth }) {
  const rows = CRITERION_IDS.flatMap((id) =>
    health.criteria[id] ? [{ id, ...health.criteria[id] }] : [],
  ).sort((a, b) => a.rita - a.reference - (b.rita - b.reference));
  if (!rows.length) return null;
  return (
    <section aria-labelledby="criteria-title" className="mt-10">
      <h2 id="criteria-title" className="text-[22px] font-semibold">
        Where she is weakest
      </h2>
      <p className="mt-1 text-[14px] text-[var(--pp-muted)]">
        Score out of 5 on this build: Rita (blue) next to the reference reply (grey).
      </p>
      <ul className="mt-4 grid gap-4 lg:grid-cols-2">
        {rows.map((row) => (
          <li key={row.id}>
            <p className="flex items-baseline justify-between gap-3 text-[15px] font-semibold">
              <span>{LABEL[row.id] ?? row.id}</span>
              <span className="text-[14px] font-normal text-[var(--pp-muted)]">
                Rita {row.rita} · reference {row.reference}
              </span>
            </p>
            <div className="mt-2 grid gap-1" aria-hidden="true">
              <div className="h-2 rounded-full bg-[var(--pp-grey)]">
                <div
                  className="h-2 rounded-full bg-[var(--pp-accent)]"
                  style={{ width: `${(row.rita / 5) * 100}%` }}
                />
              </div>
              <div className="h-2 rounded-full bg-[var(--pp-grey)]">
                <div
                  className="h-2 rounded-full bg-[var(--pp-line)]"
                  style={{ width: `${(row.reference / 5) * 100}%` }}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
