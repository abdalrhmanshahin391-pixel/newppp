import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";
import { guardRedirect } from "@/lib/guard-redirect";
import {
  adminInspectPaddlePrices,
  adminListPlans,
  adminReconcileAllPaddlePrices,
  adminSyncPlanPrices,
  type AdminPlan,
  type PaddlePlanInspection,
} from "@/lib/plans-admin.functions";

export const Route = createFileRoute("/admin/paddle-sync")({
  head: () => ({
    meta: [
      { title: "Paddle Catalog Sync — RitaJet Admin" },
      { name: "description", content: "One-click synchronization of plan prices and 3-month billing cycles with Paddle." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPaddleSyncPage,
});

const money = (cents: number, currency = "USD") =>
  `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

function AdminPaddleSyncPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const listPlans = useServerFn(adminListPlans);
  const reconcileAll = useServerFn(adminReconcileAllPaddlePrices);
  const syncOne = useServerFn(adminSyncPlanPrices);
  const inspectPaddle = useServerFn(adminInspectPaddlePrices);

  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<Array<{ time: string; text: string; type: "info" | "success" | "warn" | "error" }>>([
    {
      time: new Date().toLocaleTimeString(),
      text: "Paddle Catalog Sync Center initialized. Click 'Sync All Plans to Paddle Now' to reconcile all pricing and billing intervals.",
      type: "info",
    },
  ]);

  const addLog = (text: string, type: "info" | "success" | "warn" | "error" = "info") => {
    setLogs((prev) => [
      { time: new Date().toLocaleTimeString(), text, type },
      ...prev.slice(0, 49),
    ]);
  };

  useEffect(() => {
    if (!loading && !isAdmin) guardRedirect(navigate);
  }, [loading, isAdmin, navigate]);

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: () => listPlans({}) as Promise<AdminPlan[]>,
    enabled: isAdmin,
  });

  const paidPlans = plans.filter((p) => p.slug !== "starter" && ((p.price_cents ?? 0) > 0 || (p.once_cents ?? 0) > 0));

  const handleSyncAll = async () => {
    setBusy(true);
    addLog("Initiating full catalog reconciliation with live Paddle...", "info");
    try {
      const res = (await reconcileAll({})) as {
        ok: boolean;
        env: string;
        results: Array<{ slug: string; name: string; sync: { done: string[]; failed: Array<{ id: string; reason: string }>; env: string } }>;
      };

      addLog(`Reconciliation completed in ${res.env} mode.`, "info");

      let totalDone = 0;
      let totalFailed = 0;

      for (const item of res.results) {
        if (item.sync?.done?.length) {
          totalDone += item.sync.done.length;
          for (const msg of item.sync.done) {
            addLog(`[${item.name}] ✓ ${msg}`, "success");
          }
        }
        if (item.sync?.failed?.length) {
          totalFailed += item.sync.failed.length;
          for (const f of item.sync.failed) {
            addLog(`[${item.name}] ✗ ${f.id}: ${f.reason}`, "error");
          }
        }
      }

      await qc.invalidateQueries({ queryKey: ["admin-plans"] });
      await qc.invalidateQueries({ queryKey: ["admin-paddle-inspect"] });

      if (totalDone > 0) {
        toast.success(`Successfully synchronized ${totalDone} price(s) and billing cycle(s) with Paddle!`);
      } else if (totalFailed === 0) {
        toast.info("All plans are already in sync with Paddle.");
      }

      if (totalFailed > 0) {
        toast.error(`${totalFailed} item(s) could not be updated in Paddle.`);
      }
    } catch (e: any) {
      addLog(`Reconciliation error: ${e?.message || "Catalog unreachable"}`, "error");
      toast.error(e?.message || "Could not reach payment catalog");
    } finally {
      setBusy(false);
    }
  };

  const handleSyncSinglePlan = async (slug: string, planName: string) => {
    setBusy(true);
    addLog(`Syncing plan "${planName}" to Paddle...`, "info");
    try {
      const res = (await syncOne({ data: { slug, environment: "auto" } })) as {
        done: string[];
        failed: Array<{ id: string; reason: string }>;
        env: string;
      };

      if (res.done?.length) {
        for (const msg of res.done) {
          addLog(`[${planName}] ✓ ${msg}`, "success");
        }
        toast.success(`Updated ${planName} in Paddle!`);
      }
      if (res.failed?.length) {
        for (const f of res.failed) {
          addLog(`[${planName}] ✗ ${f.id}: ${f.reason}`, "error");
        }
        toast.error(`Could not update ${planName}: ${res.failed[0]?.reason}`);
      }

      await qc.invalidateQueries({ queryKey: ["admin-plans"] });
      await qc.invalidateQueries({ queryKey: ["admin-paddle-inspect", slug] });
    } catch (e: any) {
      addLog(`[${planName}] Error: ${e?.message || "Sync failed"}`, "error");
      toast.error(e?.message || "Sync failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#23201d]">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 md:py-12">
        {/* Navigation Breadcrumb */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-[#8a8378]">
            <Link to="/admin" className="hover:text-[#23201d]">
              Admin
            </Link>
            <span>/</span>
            <Link to="/admin/plans" className="hover:text-[#23201d]">
              Rita Prices
            </Link>
            <span>/</span>
            <span className="text-[#23201d]">Paddle Sync Center</span>
          </div>

          <a
            href="https://vendors.paddle.com/prices"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3.5 py-1.5 text-xs font-black text-[#5c554b] shadow-sm hover:bg-black/5"
          >
            <ExternalLink size={13} />
            Open Paddle Vendor Dashboard
          </a>
        </div>

        {/* Header Title */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#2e7d32]/20 bg-[#e8f5e9] px-3 py-1 text-xs font-black text-[#2e7d32]">
              <span className="h-2 w-2 rounded-full bg-[#2e7d32] animate-pulse" />
              Live Paddle Catalog Coordination
            </div>
            <h1 className="mt-2 text-3xl font-black md:text-4xl">
              Paddle Catalog Sync Center
            </h1>
            <p className="mt-1 text-sm font-semibold text-[#8a8378]">
              One-click synchronization of your website prices, 3-Month recurring intervals, and product details with Paddle.
            </p>
          </div>
        </div>

        {/* HERO SYNC CARD - GIANT UNMISSABLE ACTION BUTTON */}
        <div className="mt-8 overflow-hidden rounded-[28px] border-2 border-black/10 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#fef7ee] px-3 py-1 text-xs font-black text-[#c05621]">
                <Sparkles size={13} /> Automated 3-Month Migration
              </div>
              <h2 className="mt-2 text-2xl font-black">
                Sync All Plans to Live Paddle
              </h2>
              <p className="mt-1 text-sm font-medium text-[#7a736a]">
                Scans <strong>Toolkit</strong>, <strong>Boost</strong>, <strong>Pro</strong>, and <strong>Ultimate</strong>.
                If any plan in Paddle is still set to the old 1-month cycle, it automatically creates the official <strong>3-Month recurring subscription</strong> ($10.00 for Toolkit, etc.), sets the yearly price, archives the legacy 1-month price in Paddle, and updates the database.
              </p>
            </div>

            <div className="shrink-0">
              <button
                type="button"
                disabled={busy}
                onClick={handleSyncAll}
                className="group relative inline-flex w-full items-center justify-center gap-3 rounded-full bg-[#8ec63f] px-8 py-4 text-base font-black text-white shadow-lg transition-all hover:bg-[#7db632] hover:shadow-xl active:scale-[0.98] disabled:opacity-60 md:w-auto"
              >
                <Zap
                  size={20}
                  className={`transition-transform group-hover:rotate-12 ${busy ? "animate-spin" : ""}`}
                />
                {busy ? "Synchronizing with Paddle..." : "⚡ Sync All Plans to Paddle Now"}
              </button>
            </div>
          </div>
        </div>

        {/* INDIVIDUAL PLAN CARDS GRID */}
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-[#a29a8d]">
              Active Paid Plans ({paidPlans.length})
            </h3>
            <button
              type="button"
              onClick={() => void qc.invalidateQueries({ queryKey: ["admin-paddle-inspect"] })}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#5c554b] hover:text-black"
            >
              <RefreshCw size={12} className={busy ? "animate-spin" : ""} /> Refresh Status
            </button>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {paidPlans.map((plan) => (
              <PlanSyncCard
                key={plan.slug}
                plan={plan}
                inspectServerFn={inspectPaddle}
                onSyncPlan={() => handleSyncSinglePlan(plan.slug, plan.name)}
                busy={busy}
              />
            ))}
          </div>
        </section>

        {/* REAL-TIME EXECUTION LOG CONSOLE */}
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal size={16} className="text-[#5c554b]" />
              <h3 className="text-sm font-black uppercase tracking-widest text-[#a29a8d]">
                Live Paddle API Activity Console
              </h3>
            </div>
            <button
              type="button"
              onClick={() =>
                setLogs([
                  {
                    time: new Date().toLocaleTimeString(),
                    text: "Log cleared.",
                    type: "info",
                  },
                ])
              }
              className="text-xs font-bold text-[#8a8378] hover:text-[#23201d]"
            >
              Clear Log
            </button>
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl border border-black/10 bg-[#1e1b18] p-4 text-xs font-mono text-white shadow-inner">
            <div className="flex items-center justify-between border-b border-white/10 pb-2 text-[11px] text-white/50">
              <span>Timestamp & Event</span>
              <span>Paddle Gateway Status</span>
            </div>
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-2">
              {logs.map((log, idx) => (
                <div key={idx} className="flex items-start gap-2.5 leading-relaxed">
                  <span className="shrink-0 text-white/40">[{log.time}]</span>
                  <span
                    className={
                      log.type === "success"
                        ? "text-[#a3e635] font-bold"
                        : log.type === "error"
                          ? "text-[#f87171] font-bold"
                          : log.type === "warn"
                            ? "text-[#fbbf24]"
                            : "text-[#e2e8f0]"
                    }
                  >
                    {log.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Direct link back to Plans editor */}
        <div className="mt-10 text-center">
          <Link
            to="/admin/plans"
            className="inline-flex items-center gap-2 text-sm font-bold text-[#5c554b] hover:text-[#23201d] hover:underline"
          >
            ← Return to full Plan Limits & Features editor
          </Link>
        </div>
      </main>
    </div>
  );
}

function PlanSyncCard({
  plan,
  inspectServerFn,
  onSyncPlan,
  busy,
}: {
  plan: AdminPlan;
  inspectServerFn: (args: { data: { slug: string } }) => Promise<PaddlePlanInspection>;
  onSyncPlan: () => void;
  busy: boolean;
}) {
  const { data: inspection, isLoading } = useQuery({
    queryKey: ["admin-paddle-inspect", plan.slug],
    queryFn: () => inspectServerFn({ data: { slug: plan.slug } }),
    staleTime: 10_000,
  });

  const isLifetime = (plan.billing_kind ?? "monthly") === "lifetime";
  const monthlyTarget = inspection?.targets.find((t) => t.key === "monthly");
  const yearlyTarget = inspection?.targets.find((t) => t.key === "yearly");
  const onceTarget = inspection?.targets.find((t) => t.key === "once");

  const isDesynced = inspection?.overallStatus === "desynced";
  const isInSync = inspection?.overallStatus === "in_sync";

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="text-lg font-black">{plan.name}</h4>
            <p className="text-xs font-semibold text-[#8a8378]">{plan.tagline || plan.slug}</p>
          </div>
          {isLoading ? (
            <span className="rounded-full bg-[#f1eee8] px-2.5 py-0.5 text-[11px] font-bold text-[#8a8378]">
              Checking...
            </span>
          ) : isInSync ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f5e9] px-2.5 py-0.5 text-[11px] font-black text-[#2e7d32]">
              <Check size={12} /> In Sync
            </span>
          ) : isDesynced ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#fef2f2] px-2.5 py-0.5 text-[11px] font-black text-[#dc2626]">
              <AlertTriangle size={12} /> Desynced
            </span>
          ) : (
            <span className="rounded-full bg-[#f1eee8] px-2.5 py-0.5 text-[11px] font-bold text-[#8a8378]">
              Not Configured
            </span>
          )}
        </div>

        {/* Pricing Comparison */}
        <div className="mt-4 space-y-2 text-xs">
          {isLifetime ? (
            <div className="rounded-xl bg-[#fbfaf8] p-3">
              <div className="flex justify-between font-bold">
                <span className="text-[#8a8378]">Website Price:</span>
                <span className="font-black text-[#23201d]">{money(plan.once_cents ?? 0, plan.currency)} once</span>
              </div>
              <div className="mt-1 flex justify-between font-bold">
                <span className="text-[#8a8378]">Paddle Live:</span>
                <span className={onceTarget?.status === "in_sync" ? "text-[#2e7d32]" : "text-[#dc2626]"}>
                  {onceTarget?.paddleCents !== undefined
                    ? `${money(onceTarget.paddleCents, onceTarget.paddleCurrency || plan.currency)} once`
                    : "Not in catalog"}
                </span>
              </div>
            </div>
          ) : (
            <>
              {/* 3-Month Subscription */}
              <div className="rounded-xl bg-[#fbfaf8] p-3">
                <div className="flex justify-between font-bold">
                  <span className="text-[#8a8378]">3-Month Website Price:</span>
                  <span className="font-black text-[#23201d]">{money(plan.price_cents, plan.currency)} / 3 mo</span>
                </div>
                <div className="mt-1 flex justify-between font-bold">
                  <span className="text-[#8a8378]">Paddle Live:</span>
                  <span className={monthlyTarget?.status === "in_sync" ? "text-[#2e7d32]" : "text-[#dc2626]"}>
                    {monthlyTarget?.paddleCents !== undefined
                      ? `${money(monthlyTarget.paddleCents, monthlyTarget.paddleCurrency || plan.currency)} (${
                          monthlyTarget.billingCycle?.frequency === 3
                            ? "every 3 months"
                            : monthlyTarget.billingCycle?.frequency === 1
                              ? "legacy 1-month"
                              : "custom cycle"
                        })`
                      : "Not in catalog"}
                  </span>
                </div>
              </div>

              {/* Yearly Subscription */}
              <div className="rounded-xl bg-[#fbfaf8] p-3">
                <div className="flex justify-between font-bold">
                  <span className="text-[#8a8378]">Yearly Website Price:</span>
                  <span className="font-black text-[#23201d]">{money(plan.yearly_cents, plan.currency)} / yr</span>
                </div>
                <div className="mt-1 flex justify-between font-bold">
                  <span className="text-[#8a8378]">Paddle Live:</span>
                  <span className={yearlyTarget?.status === "in_sync" ? "text-[#2e7d32]" : "text-[#dc2626]"}>
                    {yearlyTarget?.paddleCents !== undefined
                      ? `${money(yearlyTarget.paddleCents, yearlyTarget.paddleCurrency || plan.currency)} / yr`
                      : "Not in catalog"}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-black/[0.06]">
        <button
          type="button"
          disabled={busy}
          onClick={onSyncPlan}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-black/15 bg-white px-4 py-2 text-xs font-black text-[#23201d] shadow-sm hover:bg-black/5 disabled:opacity-50"
        >
          <Sparkles size={13} className="text-[#8ec63f]" />
          Sync {plan.name} to Paddle
        </button>
      </div>
    </div>
  );
}
