import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Archive,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Layers,
  Plus,
  Sparkles,
  Tag,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";
import { guardRedirect } from "@/lib/guard-redirect";
import {
  adminCreateDiscount,
  adminListDiscounts,
  adminListPaddlePrices,
  adminUpdateDiscount,
} from "@/lib/promo.functions";
import { adminListPlans } from "@/lib/plans-admin.functions";
import { getPaddleEnvironment } from "@/lib/paddle";

export const Route = createFileRoute("/admin/promo-codes")({
  head: () => ({
    meta: [
      { title: "Promo codes — RitaJet admin" },
      {
        name: "description",
        content: "Create fast, simple discount codes that apply across all plans or specific plans at checkout.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Promo codes — RitaJet admin" },
    ],
  }),
  component: PromoCodesPage,
});

type Env = "sandbox" | "live";

const SYMBOL: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JOD: "JD " };
const money = (cents: number, currency = "USD") =>
  `${SYMBOL[currency] ?? `${currency} `}${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;

function PromoCodesPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [env, setEnv] = useState<Env>(() => getPaddleEnvironment());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const list = useServerFn(adminListDiscounts);
  const listPlans = useServerFn(adminListPlans);
  const listPrices = useServerFn(adminListPaddlePrices);
  const create = useServerFn(adminCreateDiscount);
  const update = useServerFn(adminUpdateDiscount);

  useEffect(() => {
    if (!loading && !isAdmin) guardRedirect(navigate);
  }, [loading, isAdmin, navigate]);

  const codes = useQuery({
    queryKey: ["promo-codes", env],
    queryFn: () => list({ data: { environment: env } }),
    enabled: isAdmin,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: () => listPlans({}),
    enabled: isAdmin,
  });

  const { data: paddlePrices = [] } = useQuery({
    queryKey: ["admin-paddle-prices", env],
    queryFn: () => listPrices({ data: { environment: env } }),
    enabled: isAdmin,
  });

  const [selectedTargetKey, setSelectedTargetKey] = useState("all");
  const [planDropdownOpen, setPlanDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setPlanDropdownOpen(false);
      }
    }
    if (planDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [planDropdownOpen]);

  const planOptions = useMemo(() => {
    const list: Array<{
      key: string;
      label: string;
      planName: string;
      interval: "All" | "3 Months" | "Yearly" | "One-Time";
      priceFormatted: string;
      paddlePriceId: string | null;
      category: "all" | "three_months" | "yearly" | "once";
    }> = [
      {
        key: "all",
        label: "All plans (Universal)",
        planName: "All plans",
        interval: "All",
        priceFormatted: "Any plan",
        paddlePriceId: null,
        category: "all",
      },
    ];

    // 3-Month Subscription Plans
    plans
      .filter((p) => (p.billing_kind ?? "monthly") !== "lifetime" && p.price_cents > 0)
      .forEach((p) => {
        list.push({
          key: `${p.slug}:three_months`,
          label: `${p.name} — 3 Months`,
          planName: p.name,
          interval: "3 Months",
          priceFormatted: `${money(p.price_cents, p.currency)} / 3 mo`,
          paddlePriceId: p.paddle_price_monthly,
          category: "three_months",
        });
      });

    // Yearly Subscription Plans
    plans
      .filter((p) => (p.billing_kind ?? "monthly") !== "lifetime" && p.yearly_cents > 0)
      .forEach((p) => {
        list.push({
          key: `${p.slug}:yearly`,
          label: `${p.name} — Yearly`,
          planName: p.name,
          interval: "Yearly",
          priceFormatted: `${money(p.yearly_cents, p.currency)} / year`,
          paddlePriceId: p.paddle_price_yearly,
          category: "yearly",
        });
      });

    // One-time Credit Packs
    plans
      .filter((p) => (p.billing_kind ?? "monthly") === "lifetime" && (p.once_cents ?? 0) > 0)
      .forEach((p) => {
        list.push({
          key: `${p.slug}:once`,
          label: `${p.name} — One-Time Pack`,
          planName: p.name,
          interval: "One-Time",
          priceFormatted: `${money(p.once_cents ?? 0, p.currency)} once`,
          paddlePriceId: p.paddle_price_once,
          category: "once",
        });
      });

    return list;
  }, [plans]);

  const selectedTarget = planOptions.find((o) => o.key === selectedTargetKey) || planOptions[0]!;
  const threeMonthsOptions = planOptions.filter((o) => o.category === "three_months");
  const yearlyOptions = planOptions.filter((o) => o.category === "yearly");
  const onceOptions = planOptions.filter((o) => o.category === "once");

  const [form, setForm] = useState({
    code: "",
    type: "percentage" as "percentage" | "flat",
    amount: 20,
    recur: true,
    usage_limit: "",
    expires_at: "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = form.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleanCode.length < 3) {
      toast.error("Code must be at least 3 letters/numbers");
      return;
    }

    const target = planOptions.find((o) => o.key === selectedTargetKey);
    const restrictTo =
      target && target.key !== "all" && target.paddlePriceId
        ? [target.paddlePriceId]
        : [];

    if (selectedTargetKey !== "all" && (!target || !target.paddlePriceId)) {
      toast.error(
        `The selected plan (${target?.planName || "plan"}) does not have a checkout price ID set yet. Please set one in Admin > Plans first.`,
      );
      return;
    }

    setSaving(true);
    try {
      const description =
        selectedTargetKey !== "all" && target
          ? `${cleanCode} (${target.planName} - ${target.interval})`
          : `${cleanCode} discount`;

      await create({
        data: {
          environment: env,
          code: cleanCode,
          description,
          type: form.type,
          amount: Number(form.amount),
          currency_code: "USD",
          recur: form.recur,
          maximum_recurring_intervals: null,
          usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
          expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
          restrict_to: restrictTo,
        },
      });
      toast.success(
        selectedTargetKey !== "all" && target
          ? `Promo code ${cleanCode} created for ${target.planName} (${target.interval})!`
          : `Promo code ${cleanCode} created for all plans!`,
      );
      setForm({
        code: "",
        type: "percentage",
        amount: 20,
        recur: true,
        usage_limit: "",
        expires_at: "",
      });
      setSelectedTargetKey("all");
      setShowAdvanced(false);
      qc.invalidateQueries({ queryKey: ["promo-codes", env] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create that code");
    } finally {
      setSaving(false);
    }
  };

  const copyCode = (codeText: string, id: string) => {
    if (!codeText) return;
    navigator.clipboard.writeText(codeText);
    setCopiedId(id);
    toast.success(`Copied "${codeText}" to clipboard`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const act = async (id: string, patch: Record<string, unknown>) => {
    try {
      await update({ data: { environment: env, id, ...(patch as any) } });
      qc.invalidateQueries({ queryKey: ["promo-codes", env] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update that code");
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "#fbf5e9", color: "#23201d" }}>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-12 md:px-8">
        {/* Header & Mode Switch */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/70 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-[#7a4b16]">
              <Tag size={13} /> Admin
            </span>
            <h1 className="mt-3 font-display text-3xl font-black md:text-4xl">Promo codes</h1>
            <p className="mt-1 text-[14.5px] text-[#5c554b]">
              Create discount codes that apply directly to checkout across all plans.
            </p>
          </div>
          <div className="inline-flex rounded-full border border-black/[0.08] bg-white p-1 shadow-sm">
            {(["sandbox", "live"] as Env[]).map((e) => (
              <button
                key={e}
                onClick={() => setEnv(e)}
                className={`rounded-full px-4 py-1.5 text-[13px] font-black transition-colors ${
                  env === e ? "bg-[#23201d] text-white" : "text-[#6b655c] hover:bg-black/[0.05]"
                }`}
              >
                {e === "sandbox" ? "Test mode" : "Live mode"}
              </button>
            ))}
          </div>
        </div>

        {/* Simplified 1-Click Creator */}
        <section className="mt-8 rounded-[24px] border border-black/[0.08] bg-white p-6 shadow-sm md:p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-[#8ec63f]/20 text-[#4c7c1a]">
                <Sparkles size={16} />
              </div>
              <h2 className="font-display text-xl font-black">Quick create code</h2>
            </div>
            {selectedTarget.category === "all" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eaf4dd] px-3 py-1 text-[12px] font-bold text-[#3d6515]">
                <Layers size={13} /> Applies to all plans
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff4e5] px-3 py-1 text-[12px] font-bold text-[#a4540d]">
                <Layers size={13} /> Restricted to {selectedTarget.planName} ({selectedTarget.interval})
              </span>
            )}
          </div>

          <form onSubmit={submit} className="mt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Code Name */}
              <div>
                <label className="text-[11px] font-black uppercase tracking-[0.16em] text-[#a29a8d]">
                  Code name
                </label>
                <div className="mt-1.5 relative">
                  <input
                    className="w-full rounded-xl border-2 border-black/10 bg-white px-3.5 py-2.5 text-base font-black tracking-wider uppercase outline-none focus:border-[#8ec63f]"
                    value={form.code}
                    maxLength={32}
                    onChange={(e) =>
                      setForm({ ...form, code: e.target.value.replace(/[^A-Za-z0-9]/g, "") })
                    }
                    placeholder="e.g. SAVE20"
                    required
                  />
                </div>
                <p className="mt-1 text-[11.5px] text-[#a29a8d]">Only letters and numbers</p>
              </div>

              {/* Discount Amount & Type */}
              <div>
                <label className="text-[11px] font-black uppercase tracking-[0.16em] text-[#a29a8d]">
                  Discount value
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    className="w-full rounded-xl border-2 border-black/10 bg-white px-3.5 py-2.5 text-base font-black outline-none focus:border-[#8ec63f]"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                    required
                  />
                  <div className="inline-flex shrink-0 rounded-xl border border-black/10 bg-muted/40 p-1">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, type: "percentage" })}
                      className={`rounded-lg px-3 py-1 text-[13px] font-black transition-all ${
                        form.type === "percentage"
                          ? "bg-white text-foreground shadow-sm"
                          : "text-muted-foreground"
                      }`}
                    >
                      % Percent
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, type: "flat" })}
                      className={`rounded-lg px-3 py-1 text-[13px] font-black transition-all ${
                        form.type === "flat"
                          ? "bg-white text-foreground shadow-sm"
                          : "text-muted-foreground"
                      }`}
                    >
                      $ USD
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-[11.5px] text-[#a29a8d]">
                  {form.type === "percentage"
                    ? `Students will receive ${form.amount}% off at checkout`
                    : `Students will receive $${form.amount} off at checkout`}
                </p>
              </div>
            </div>

            {/* Applies to Plan Dropdown Selector */}
            <div ref={dropdownRef} className="relative mt-4">
              <label className="text-[11px] font-black uppercase tracking-[0.16em] text-[#a29a8d]">
                Applies to plan
              </label>
              <button
                type="button"
                onClick={() => setPlanDropdownOpen((v) => !v)}
                className="mt-1.5 flex w-full items-center justify-between rounded-xl border-2 border-black/10 bg-white px-3.5 py-3 text-left text-sm font-bold outline-none transition-colors hover:border-black/20 focus:border-[#8ec63f]"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {selectedTarget.category === "all" ? (
                    <>
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-800 text-[13px]">
                        🌐
                      </span>
                      <span className="text-[14.5px] font-black text-[#23201d] truncate">All plans (Universal)</span>
                    </>
                  ) : (
                    <>
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-black/5 text-[13px]">
                        📦
                      </span>
                      <span className="text-[14.5px] font-black text-[#23201d] truncate">
                        RitaJet {selectedTarget.planName}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-black shrink-0 ${
                          selectedTarget.category === "three_months"
                            ? "bg-amber-100 text-amber-900 border border-amber-200"
                            : selectedTarget.category === "yearly"
                              ? "bg-emerald-100 text-emerald-900 border border-emerald-200"
                              : "bg-blue-100 text-blue-900 border border-blue-200"
                        }`}
                      >
                        {selectedTarget.interval}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2.5 text-[#7a736a] shrink-0 ms-2">
                  {selectedTarget.category !== "all" && (
                    <span className="text-[13px] font-semibold text-[#8c8275]">{selectedTarget.priceFormatted}</span>
                  )}
                  <ChevronDown
                    size={17}
                    className={`transition-transform duration-200 ${planDropdownOpen ? "rotate-180" : ""}`}
                  />
                </div>
              </button>

              {/* Dropdown Menu */}
              {planDropdownOpen && (
                <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-black/10 bg-white p-2 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                  {/* Universal Option */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTargetKey("all");
                      setPlanDropdownOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors ${
                      selectedTargetKey === "all" ? "bg-[#f3efe6]" : "hover:bg-black/[0.04]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-100 text-emerald-800 text-[13px]">
                        🌐
                      </span>
                      <div>
                        <p className="text-[14px] font-black text-[#23201d]">All plans (Universal)</p>
                        <p className="text-[11.5px] text-[#7a736a]">Valid on any plan or pack at checkout</p>
                      </div>
                    </div>
                    {selectedTargetKey === "all" && <Check size={16} className="text-[#3d5c14]" />}
                  </button>

                  {/* 3-Month Plans */}
                  {threeMonthsOptions.length > 0 && (
                    <>
                      <div className="my-2 border-t border-black/[0.06]" />
                      <p className="px-3 py-1 text-[10.5px] font-black uppercase tracking-wider text-[#a29a8d]">
                        3-Month Subscription Plans
                      </p>
                      {threeMonthsOptions.map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => {
                            setSelectedTargetKey(opt.key);
                            setPlanDropdownOpen(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors ${
                            selectedTargetKey === opt.key ? "bg-[#f3efe6]" : "hover:bg-black/[0.04]"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-[13.5px] font-bold text-[#23201d]">RitaJet {opt.planName}</span>
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-black text-amber-900 border border-amber-200">
                              3 Months
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-semibold text-[#8c8275]">{opt.priceFormatted}</span>
                            {selectedTargetKey === opt.key && <Check size={15} className="text-[#3d5c14]" />}
                          </div>
                        </button>
                      ))}
                    </>
                  )}

                  {/* Yearly Plans */}
                  {yearlyOptions.length > 0 && (
                    <>
                      <div className="my-2 border-t border-black/[0.06]" />
                      <p className="px-3 py-1 text-[10.5px] font-black uppercase tracking-wider text-[#a29a8d]">
                        Yearly Subscription Plans
                      </p>
                      {yearlyOptions.map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => {
                            setSelectedTargetKey(opt.key);
                            setPlanDropdownOpen(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors ${
                            selectedTargetKey === opt.key ? "bg-[#f3efe6]" : "hover:bg-black/[0.04]"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-[13.5px] font-bold text-[#23201d]">RitaJet {opt.planName}</span>
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10.5px] font-black text-emerald-900 border border-emerald-200">
                              Yearly
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-semibold text-[#8c8275]">{opt.priceFormatted}</span>
                            {selectedTargetKey === opt.key && <Check size={15} className="text-[#3d5c14]" />}
                          </div>
                        </button>
                      ))}
                    </>
                  )}

                  {/* One-Time Packs */}
                  {onceOptions.length > 0 && (
                    <>
                      <div className="my-2 border-t border-black/[0.06]" />
                      <p className="px-3 py-1 text-[10.5px] font-black uppercase tracking-wider text-[#a29a8d]">
                        One-Time Credit Packs
                      </p>
                      {onceOptions.map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => {
                            setSelectedTargetKey(opt.key);
                            setPlanDropdownOpen(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors ${
                            selectedTargetKey === opt.key ? "bg-[#f3efe6]" : "hover:bg-black/[0.04]"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-[13.5px] font-bold text-[#23201d]">RitaJet {opt.planName}</span>
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10.5px] font-black text-blue-900 border border-blue-200">
                              Pack
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-semibold text-[#8c8275]">{opt.priceFormatted}</span>
                            {selectedTargetKey === opt.key && <Check size={15} className="text-[#3d5c14]" />}
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* Note */}
              <p className="mt-1.5 text-[12px] font-medium text-[#6b655c]">
                {selectedTarget.category === "all" ? (
                  <span>🌐 <strong>Universal:</strong> Students can use this promo code on any RitaJet plan at checkout.</span>
                ) : (
                  <span>🎯 <strong>Single-Plan Target:</strong> This code will ONLY work when purchasing <strong>RitaJet {selectedTarget.planName} ({selectedTarget.interval})</strong>. It will be rejected on any other plan or billing cycle.</span>
                )}
              </p>
            </div>

            {/* Recur checkbox */}
            <div className="mt-4">
              <label className="flex items-center gap-2 text-[13.5px] font-bold text-[#4a453d] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.recur}
                  onChange={(e) => setForm({ ...form, recur: e.target.checked })}
                  className="h-4 w-4 rounded accent-[#8ec63f]"
                />
                Apply discount to recurring renewals as well
              </label>
            </div>

            {/* Expandable Advanced Options */}
            <div className="mt-5 border-t border-black/[0.06] pt-4">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1.5 text-[12.5px] font-bold text-[#7a736a] hover:text-black"
              >
                {showAdvanced ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                {showAdvanced ? "Hide limits & expiration" : "Optional limits & expiration"}
              </button>

              {showAdvanced && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 animate-in fade-in duration-200">
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-[0.16em] text-[#a29a8d]">
                      Max uses (leave blank for unlimited)
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#8ec63f]"
                      value={form.usage_limit}
                      onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
                      placeholder="e.g. 50"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-[0.16em] text-[#a29a8d]">
                      Expiration date (leave blank for never)
                    </label>
                    <input
                      type="date"
                      className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#8ec63f]"
                      value={form.expires_at}
                      onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Create CTA */}
            <div className="mt-6 flex items-center justify-between border-t border-black/[0.06] pt-5">
              <span className="text-[13px] font-semibold text-[#6b655c]">
                Ready to publish in Paddle ({env === "sandbox" ? "Test" : "Live"})
              </span>
              <button
                type="submit"
                disabled={saving || form.code.trim().length < 3}
                className="inline-flex items-center gap-2 rounded-full bg-[#23201d] px-6 py-3 text-[14px] font-black text-white transition-opacity hover:opacity-90 active:scale-95 disabled:opacity-40"
              >
                <Plus size={16} />{" "}
                {saving
                  ? "Creating…"
                  : selectedTargetKey !== "all" && selectedTarget
                    ? `Create code for ${selectedTarget.planName} (${selectedTarget.interval})`
                    : "Create code for all plans"}
              </button>
            </div>
          </form>
        </section>

        {/* List of Existing Codes */}
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-black">All active & past codes</h2>
            <span className="text-[13px] font-bold text-[#7a736a]">
              {(codes.data?.length ?? 0)} code{(codes.data?.length ?? 0) === 1 ? "" : "s"}
            </span>
          </div>

          {codes.isLoading ? (
            <p className="mt-4 text-[#6b655c]">Loading promo codes…</p>
          ) : codes.error ? (
            <p className="mt-4 text-[#a4321f]">
              {(codes.error as Error).message || "Could not load codes."}
            </p>
          ) : (codes.data?.length ?? 0) === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-black/15 bg-white/40 p-8 text-center text-[#6b655c]">
              No promo codes found in {env === "sandbox" ? "Test mode" : "Live mode"}. Create one above!
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {codes.data!.map((d) => {
                const badge = (() => {
                  if (!d.restrict_to || d.restrict_to.length === 0) {
                    return (
                      <span className="hidden rounded-full bg-black/[0.05] px-2.5 py-0.5 text-[11px] font-bold text-[#6b655c] sm:inline-block">
                        All plans
                      </span>
                    );
                  }
                  const id = d.restrict_to[0]!;
                  const pp = paddlePrices.find((p) => p.id === id || p.externalId === id);
                  const extId = pp?.externalId || id;
                  const matchedPlan = plans.find(
                    (p) =>
                      p.paddle_price_monthly === extId ||
                      p.paddle_price_yearly === extId ||
                      p.paddle_price_once === extId ||
                      p.paddle_price_monthly === id ||
                      p.paddle_price_yearly === id ||
                      p.paddle_price_once === id,
                  );
                  if (matchedPlan) {
                    const is3m =
                      matchedPlan.paddle_price_monthly === extId ||
                      matchedPlan.paddle_price_monthly === id;
                    const isYearly =
                      matchedPlan.paddle_price_yearly === extId ||
                      matchedPlan.paddle_price_yearly === id;
                    const intervalLabel = is3m ? "3 Months" : isYearly ? "Yearly" : "Pack";
                    const bgClass = is3m
                      ? "bg-amber-100 text-amber-900 border border-amber-300/70"
                      : isYearly
                        ? "bg-emerald-100 text-emerald-900 border border-emerald-300/70"
                        : "bg-blue-100 text-blue-900 border border-blue-300/70";

                    return (
                      <span
                        className={`hidden rounded-full px-2.5 py-0.5 text-[11px] font-black sm:inline-block ${bgClass}`}
                      >
                        {matchedPlan.name} · {intervalLabel}
                      </span>
                    );
                  }
                  return (
                    <span className="hidden rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 sm:inline-block">
                      Single plan
                    </span>
                  );
                })();

                return (
                  <div
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/[0.07] bg-white px-5 py-4 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-display text-[18px] font-black tracking-wider text-[#23201d]">
                        {d.code ?? "—"}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyCode(d.code ?? "", d.id)}
                        className="grid h-7 w-7 place-items-center rounded-lg text-[#7a736a] transition-colors hover:bg-black/[0.06] hover:text-black"
                        title="Copy code"
                      >
                        {copiedId === d.id ? (
                          <Check size={14} className="text-green-600" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                      <span className="rounded-full bg-[#e6f4d8] px-3 py-1 text-[12px] font-black text-[#3d5c14]">
                        {d.type === "percentage"
                          ? `${d.amount}% off`
                          : `$${(Number(d.amount) / 100).toFixed(2)} off`}
                      </span>
                      {badge}
                    </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-medium text-[#6b655c]">
                      {d.times_used}
                      {d.usage_limit ? ` / ${d.usage_limit}` : ""} used
                      {d.expires_at
                        ? ` · ends ${new Date(d.expires_at).toLocaleDateString()}`
                        : ""}
                    </span>

                    <span
                      className={`rounded-full px-3 py-1 text-[11.5px] font-black ${
                        d.status === "active"
                          ? "bg-[#e6f4d8] text-[#3d5c14]"
                          : "bg-black/[0.06] text-[#6b655c]"
                      }`}
                    >
                      {d.status}
                    </span>

                    {d.status === "active" && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            act(d.id, { enabled_for_checkout: !d.enabled_for_checkout })
                          }
                          className="rounded-full border border-black/10 px-3 py-1 text-[12px] font-bold text-[#6b655c] transition-colors hover:bg-black/[0.05]"
                        >
                          {d.enabled_for_checkout ? "Pause" : "Resume"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!confirm(`Archive ${d.code}? Students will no longer be able to use it.`))
                              return;
                            act(d.id, { status: "archived" });
                          }}
                          className="grid h-8 w-8 place-items-center rounded-xl text-[#8e8579] transition-colors hover:bg-red-50 hover:text-red-600"
                          title="Archive code"
                        >
                          <Archive size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

