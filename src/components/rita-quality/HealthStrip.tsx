import { change, SMALL_SAMPLE, type BuildHealth } from "@/lib/rita-quality";

type Stat = {
  label: string;
  value: string;
  note: string;
  delta: ReturnType<typeof change>;
  unit: string;
};

const seconds = (ms: number | null) => (ms === null ? null : Math.round(ms / 100) / 10);
const whole = (n: number | null) => (n === null ? null : Math.round(n));

function Delta({
  delta,
  unit,
  previous,
}: {
  delta: Stat["delta"];
  unit: string;
  previous: string;
}) {
  if (!delta) return null;
  if (delta.delta === 0) {
    return <span className="text-[var(--pp-muted)]">Same as version {previous}</span>;
  }
  const size = `${Math.abs(delta.delta)}${unit}`;
  return (
    <span className={delta.better ? "font-semibold text-[var(--pp-accent-text)]" : "font-semibold"}>
      {delta.better ? "Better" : "Worse"} by {size}
      <span className="font-normal text-[var(--pp-muted)]"> than {previous}</span>
    </span>
  );
}

/**
 * Four numbers for the newest version, each against the version before it. A version with few
 * reviewed replies says so instead of looking certain.
 */
export function HealthStrip({ builds }: { builds: BuildHealth[] }) {
  const current = builds.at(-1);
  if (!current) return null;
  const previous = builds.length > 1 ? builds.at(-2) : undefined;
  const prevName = previous ? previous.build.slice(0, 7) : "";
  const stats: Stat[] = [
    {
      label: "Quality",
      value: current.quality === null ? "—" : `${whole(current.quality)}%`,
      note: "How close Rita is to a good tutor",
      delta: change(whole(current.quality), whole(previous?.quality ?? null)),
      unit: " points",
    },
    {
      label: "Replies with a problem",
      value: `${whole(current.problemRate)}%`,
      note: `${current.reviewed} replies reviewed`,
      delta: change(whole(current.problemRate), whole(previous?.problemRate ?? null), true),
      unit: " points",
    },
    {
      label: "Cut off",
      value: current.cutOffRate === null ? "—" : `${whole(current.cutOffRate)}%`,
      note: "Replies stopped by the voice system",
      delta: change(whole(current.cutOffRate), whole(previous?.cutOffRate ?? null), true),
      unit: " points",
    },
    {
      label: "Time to first sound",
      value: current.firstAudioP50 === null ? "—" : `${seconds(current.firstAudioP50)}s`,
      note:
        current.firstAudioP95 === null
          ? "Typical"
          : `Typical · slowest 1 in 20: ${seconds(current.firstAudioP95)}s`,
      delta: change(seconds(current.firstAudioP50), seconds(previous?.firstAudioP50 ?? null), true),
      unit: "s",
    },
  ];
  return (
    <section aria-labelledby="health-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="health-title" className="text-[20px] font-semibold">
          How Rita is doing
        </h2>
        <p className="text-[14px] text-[var(--pp-muted)]">
          Version <span className="font-mono">{current.build.slice(0, 7)}</span>
        </p>
      </div>
      {current.smallSample ? (
        <p role="note" className="mt-2 rounded-xl bg-[var(--pp-grey)] px-4 py-2 text-[14px]">
          Only {current.reviewed} replies reviewed on this version (under {SMALL_SAMPLE}): treat
          these numbers as a first look.
        </p>
      ) : null}
      <dl className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl bg-[var(--pp-grey)] p-4">
            <dt className="text-[14px] font-semibold text-[var(--pp-muted)]">{stat.label}</dt>
            <dd className="mt-1 text-[32px] font-semibold leading-none tabular-nums">
              {stat.value}
            </dd>
            <dd className="mt-2 text-[13px] leading-[1.4] text-[var(--pp-muted)]">{stat.note}</dd>
            {previous ? (
              <dd className="mt-1 text-[13px] leading-[1.4]">
                <Delta delta={stat.delta} unit={stat.unit} previous={prevName} />
              </dd>
            ) : null}
          </div>
        ))}
      </dl>
    </section>
  );
}
