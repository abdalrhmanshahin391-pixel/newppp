import type { BuildHealth } from "@/lib/rita-quality";

/** Every build side by side, newest first: the quickest way to see whether a release helped. */
export function BuildTable({ builds }: { builds: BuildHealth[] }) {
  if (builds.length < 2) return null;
  const rows = [...builds].reverse();
  return (
    <section aria-labelledby="builds-title" className="mt-10">
      <h2 id="builds-title" className="text-[22px] font-semibold">
        Build by build
      </h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[420px] text-start text-[15px]">
          <thead>
            <tr className="text-[13px] text-[var(--pp-muted)]">
              <th scope="col" className="py-2 pe-3 text-start font-semibold">
                Build
              </th>
              <th scope="col" className="py-2 pe-3 text-end font-semibold">
                Replies
              </th>
              <th scope="col" className="py-2 pe-3 text-end font-semibold">
                Quality
              </th>
              <th scope="col" className="py-2 pe-3 text-end font-semibold">
                Problems
              </th>
              <th scope="col" className="py-2 text-end font-semibold">
                Cut off
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.build} className="border-t border-[var(--pp-line)]">
                <th scope="row" className="py-3 pe-3 text-start font-mono text-[14px] font-normal">
                  {row.build.slice(0, 7)}
                  {row.smallSample ? (
                    <span className="ms-2 font-sans text-[12px] text-[var(--pp-muted)]">
                      small sample
                    </span>
                  ) : null}
                </th>
                <td className="py-3 pe-3 text-end">{row.reviewed}</td>
                <td className="py-3 pe-3 text-end">
                  {row.quality === null ? "—" : `${row.quality}%`}
                </td>
                <td className="py-3 pe-3 text-end">{row.problemRate}%</td>
                <td className="py-3 text-end">
                  {row.cutOffRate === null ? "—" : `${row.cutOffRate}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
