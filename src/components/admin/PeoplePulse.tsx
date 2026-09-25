import { useQuery } from "@tanstack/react-query";
import { Activity, Clock, Users, Radio } from "lucide-react";
import { getPeoplePulse, type PeoplePulse as Pulse, type OnlineRow } from "@/lib/people-analytics.functions";

const num = (n: number) => (n ?? 0).toLocaleString();
const time = (s: string) => new Date(s).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function ago(s: string) {
  const m = Math.floor((Date.now() - new Date(s).getTime()) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

/**
 * Live pulse of the website: who is here this minute, how many opened it today,
 * when today's sign-ins happened, and which plan everybody is on.
 * Refreshes itself every minute.
 */
export function PeoplePulse() {
  const { data, isFetching } = useQuery({
    queryKey: ["people-pulse"],
    refetchInterval: 60_000,
    queryFn: () => getPeoplePulse({}) as Promise<{ pulse: Pulse; online: OnlineRow[] }>,
  });

  const p = data?.pulse;
  const online = data?.online ?? [];
  const peak = Math.max(1, ...(p?.hourly ?? []).map((h) => h.logins));
  const totalPlans = Math.max(1, (p?.plan_mix ?? []).reduce((s, m) => s + Number(m.people), 0));
  const nowHour = new Date().getHours();
  const trend = p ? Number(p.opened_today) - Number(p.opened_yesterday) : 0;

  return (
    <section className="mt-8 rounded-3xl border-2 border-border bg-card p-5 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-2 text-lg font-black text-foreground">
          <Radio size={18} className={isFetching ? "animate-pulse text-primary" : "text-primary"} /> Live right now
        </h2>
        <span className="text-xs font-bold text-muted-foreground">
          {p ? `Updated ${time(p.generated_at)} · refreshes every minute` : "Reading the room…"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          icon={<Activity size={16} />}
          label="Here this minute"
          value={num(p?.online_now ?? 0)}
          hint={`${num(p?.online_15m ?? 0)} in the last 15 minutes`}
          accent
        />
        <Tile
          icon={<Clock size={16} />}
          label="Opened today"
          value={num(p?.opened_today ?? 0)}
          hint={`${trend >= 0 ? "+" : ""}${num(trend)} vs yesterday`}
        />
        <Tile icon={<Users size={16} />} label="Accounts in total" value={num(p?.total_users ?? 0)} hint="Everyone signed up" />
        <Tile
          icon={<Users size={16} />}
          label="On a paid plan"
          value={num((p?.plan_mix ?? []).filter((m) => m.slug !== "starter").reduce((s, m) => s + Number(m.people), 0))}
          hint={`${(p?.plan_mix ?? []).length} plans in use`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-muted-foreground">Today, hour by hour</h3>
          <div className="flex h-28 items-end gap-1">
            {(p?.hourly ?? []).map((h) => (
              <div key={h.hour} className="group relative flex-1">
                <div
                  className={`w-full rounded-t ${h.hour === nowHour ? "bg-primary" : "bg-primary/35"}`}
                  style={{ height: `${Math.max(3, (h.logins / peak) * 100)}%` }}
                />
                <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-foreground px-1.5 py-0.5 text-[10px] font-bold text-background opacity-0 group-hover:opacity-100">
                  {String(h.hour).padStart(2, "0")}:00 · {h.logins}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] font-bold text-muted-foreground">
            <span>00:00</span><span>12:00</span><span>23:00</span>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-muted-foreground">Who is on which plan</h3>
          <ul className="space-y-2">
            {(p?.plan_mix ?? []).map((m) => (
              <li key={m.slug} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 truncate font-bold text-foreground">{m.name}</span>
                <span className="h-2 flex-1 rounded-full bg-muted">
                  <span
                    className="block h-2 rounded-full bg-primary"
                    style={{ width: `${Math.round((Number(m.people) / totalPlans) * 100)}%` }}
                  />
                </span>
                <span className="w-14 text-right text-xs font-bold text-muted-foreground">{num(Number(m.people))}</span>
              </li>
            ))}
            {(p?.plan_mix ?? []).length === 0 && (
              <li className="text-sm text-muted-foreground">Nothing to show yet.</li>
            )}
          </ul>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-muted-foreground">
          Online in the last 15 minutes ({online.length})
        </h3>
        {online.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nobody is using the website at this moment.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {online.map((r) => (
              <li key={r.user_id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    Date.now() - new Date(r.last_seen_at).getTime() < 5 * 60_000 ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-foreground">
                    {r.full_name || r.username || r.email || "Someone"}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {r.plan_name} · {ago(r.last_seen_at)} · {r.minutes_active}m in this visit
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Tile({
  icon, label, value, hint, accent,
}: { icon: React.ReactNode; label: string; value: string; hint: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border-2 p-4 ${accent ? "border-primary/40 bg-primary/5" : "border-border bg-background"}`}>
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-2 text-3xl font-black tracking-tight text-foreground">{value}</div>
      <div className="mt-1 text-xs font-semibold text-muted-foreground">{hint}</div>
    </div>
  );
}
