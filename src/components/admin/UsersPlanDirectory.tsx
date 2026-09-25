import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2, Search, Users as UsersIcon } from "lucide-react";
import { adminUsersWithPlans, type AdminUserPlanRow } from "@/lib/admin-users.functions";

function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

function when(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Pinned at the top of Users & Roles: the whole of Rita's membership with the
 * plan each person is on and any kit they claimed.
 */
export function UsersPlanDirectory() {
  const listFn = useServerFn(adminUsersWithPlans);
  const [query, setQuery] = useState("");
  const [plan, setPlan] = useState("all");
  const [kitOnly, setKitOnly] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-users-with-plans"],
    queryFn: () => listFn({}) as Promise<AdminUserPlanRow[]>,
    staleTime: 30_000,
  });

  const rows = data ?? [];

  const planCounts = useMemo(() => {
    const map = new Map<string, { name: string; n: number }>();
    for (const r of rows) {
      const cur = map.get(r.plan_slug) ?? { name: r.plan_name, n: 0 };
      cur.n += 1;
      map.set(r.plan_slug, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [rows]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (plan !== "all" && r.plan_slug !== plan) return false;
      if (kitOnly && !r.kit_slug) return false;
      if (!q) return true;
      return [r.full_name, r.username, r.email].some((v) => (v ?? "").toLowerCase().includes(q));
    });
  }, [rows, query, plan, kitOnly]);

  function exportCsv() {
    const head = ["Name", "Username", "Email", "Joined", "Last seen", "Plan", "Kit", "Kit ends", "Roles"];
    const body = shown.map((r) => [
      r.full_name ?? "",
      r.username ?? "",
      r.email ?? "",
      when(r.created_at),
      when(r.last_seen),
      r.plan_name,
      r.kit_name ?? "",
      r.kit_expires_at ? when(r.kit_expires_at) : "",
      (r.roles ?? []).join(" / "),
    ]);
    const csv = [head, ...body]
      .map((line) => line.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "rita-users.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="mb-10 rounded-3xl border border-border bg-card p-5 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-2 text-lg font-black">
          <UsersIcon size={18} /> All users of Rita
          <span className="text-sm font-bold text-muted-foreground">({rows.length})</span>
        </h2>
        <button
          onClick={exportCsv}
          className="ms-auto inline-flex h-9 items-center gap-2 rounded-full border border-border px-4 text-xs font-black hover:bg-muted"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {planCounts.map(([slug, info]) => (
          <button
            key={slug}
            onClick={() => setPlan(plan === slug ? "all" : slug)}
            className={`rounded-full border px-3 py-1.5 text-xs font-black transition-colors ${
              plan === slug ? "border-transparent bg-primary text-primary-foreground" : "border-border hover:bg-muted"
            }`}
          >
            {info.name} · {info.n}
          </button>
        ))}
        <button
          onClick={() => setKitOnly((v) => !v)}
          className={`rounded-full border px-3 py-1.5 text-xs font-black transition-colors ${
            kitOnly ? "border-transparent bg-primary text-primary-foreground" : "border-border hover:bg-muted"
          }`}
        >
          Claimed a kit · {rows.filter((r) => r.kit_slug).length}
        </button>
      </div>

      <div className="relative mt-4">
        <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, username or email"
          className="h-11 w-full rounded-xl border border-border bg-background ps-10 pe-4 text-sm font-semibold"
        />
      </div>

      {isLoading && (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={15} className="animate-spin" /> Loading everyone…
        </p>
      )}
      {error && (
        <p className="mt-6 text-sm font-bold text-destructive">{(error as Error).message}</p>
      )}

      {!isLoading && !error && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead>
              <tr className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pe-3">Person</th>
                <th className="py-2 pe-3">Plan</th>
                <th className="py-2 pe-3">Kit</th>
                <th className="py-2 pe-3">Joined</th>
                <th className="py-2">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const left = daysLeft(r.kit_expires_at);
                return (
                  <tr key={r.id} className="border-t border-border/70">
                    <td className="py-2.5 pe-3">
                      <span className="font-bold">{r.full_name || r.username || "—"}</span>
                      <span className="block text-xs text-muted-foreground">{r.email}</span>
                    </td>
                    <td className="py-2.5 pe-3">
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-black">{r.plan_name}</span>
                      {(r.roles ?? []).includes("admin") && (
                        <span className="ms-1 text-xs font-black text-primary">admin</span>
                      )}
                    </td>
                    <td className="py-2.5 pe-3 text-xs font-bold">
                      {r.kit_name ? (
                        <>
                          {r.kit_name}
                          {left !== null && (
                            <span className="block text-muted-foreground">{left} days left</span>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pe-3 text-xs text-muted-foreground">{when(r.created_at)}</td>
                    <td className="py-2.5 text-xs text-muted-foreground">{when(r.last_seen)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {shown.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nobody matches that.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
