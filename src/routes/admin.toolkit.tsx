import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, Flame, Gift, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { guardRedirect } from "@/lib/guard-redirect";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/legacy-client";
import { updateSiteSettings } from "@/lib/site-settings.functions";

export const Route = createFileRoute("/admin/toolkit")({
  head: () => ({
    meta: [
      { title: "Free toolkit — Administration Site" },
      { name: "description", content: "Turn the free study toolkit on or off and hand out redeem codes." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Free toolkit — Administration Site" },
      { property: "og:description", content: "Manage the free toolkit offer and its codes." },
    ],
  }),
  component: AdminToolkit,
});

const inputCls = "w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm text-foreground";

type Offer = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  accent: string;
  badge: string;
  bullets: string[];
  plan_slug: string;
  duration_days: number;
  requires_code: boolean;
  is_active: boolean;
  sort: number;
};

type Code = {
  id: string;
  code: string;
  plan_slug: string;
  label: string | null;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
};

function AdminToolkit() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ code: "", plan_slug: "pack-study", label: "", max_uses: "", offer_id: "" });
  const [newOffer, setNewOffer] = useState({ slug: "", title: "", subtitle: "", plan_slug: "pack-study", duration_days: "90" });

  useEffect(() => {
    if (!loading && !isAdmin) guardRedirect(navigate);
  }, [loading, isAdmin, navigate]);

  const settings = useQuery({
    enabled: isAdmin,
    queryKey: ["toolkit-settings"],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("site_settings")
        .select("toolkit_free_enabled,toolkit_free_plan,offers_page_enabled")
        .maybeSingle();
      return (data ?? {}) as {
        toolkit_free_enabled?: boolean;
        toolkit_free_plan?: string;
        offers_page_enabled?: boolean;
      };
    },
  });

  const plans = useQuery({
    enabled: isAdmin,
    queryKey: ["toolkit-plans"],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("plans").select("slug,name").order("sort");
      return (data ?? []) as { slug: string; name: string }[];
    },
  });

  const offers = useQuery({
    enabled: isAdmin,
    queryKey: ["admin-offers"],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("special_offers").select("*").order("sort");
      return (data ?? []) as Offer[];
    },
  });

  const codes = useQuery({
    enabled: isAdmin,
    queryKey: ["toolkit-codes"],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("toolkit_codes")
        .select("*")
        .order("created_at", { ascending: false });
      return (data ?? []) as Code[];
    },
  });

  if (loading || !isAdmin) return <div className="min-h-screen bg-muted/40" />;

  async function saveSetting(values: {
    toolkit_free_enabled?: boolean;
    toolkit_free_plan?: string;
    offers_page_enabled?: boolean;
  }) {
    try {
      await updateSiteSettings({ data: values });
      qc.invalidateQueries({ queryKey: ["toolkit-settings"] });
      toast.success("Saved.");
    } catch (e: any) {
      toast.error(e?.message || "Could not save");
    }
  }

  async function createCode() {
    const code = form.code.trim();
    if (!code) return toast.error("Write a code first.");
    setBusy(true);
    const { error } = await (supabase.from as any)("toolkit_codes").insert({
      code,
      plan_slug: form.plan_slug,
      label: form.label.trim() || null,
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      offer_id: form.offer_id || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setForm({ code: "", plan_slug: form.plan_slug, label: "", max_uses: "", offer_id: form.offer_id });
    qc.invalidateQueries({ queryKey: ["toolkit-codes"] });
  }

  async function patchCode(id: string, values: Partial<Code>) {
    await (supabase.from as any)("toolkit_codes").update(values).eq("id", id);
    qc.invalidateQueries({ queryKey: ["toolkit-codes"] });
  }

  async function removeCode(id: string) {
    if (!confirm("Delete this code?")) return;
    await (supabase.from as any)("toolkit_codes").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["toolkit-codes"] });
  }

  async function createOffer() {
    const slug = newOffer.slug.trim().toLowerCase();
    if (!slug || !newOffer.title.trim()) return toast.error("Give the offer a short name and a title.");
    const { error } = await (supabase.from as any)("special_offers").insert({
      slug,
      title: newOffer.title.trim(),
      subtitle: newOffer.subtitle.trim() || null,
      plan_slug: newOffer.plan_slug,
      duration_days: Number(newOffer.duration_days || 90),
    });
    if (error) return toast.error(error.message);
    setNewOffer({ slug: "", title: "", subtitle: "", plan_slug: newOffer.plan_slug, duration_days: "90" });
    qc.invalidateQueries({ queryKey: ["admin-offers"] });
  }

  async function patchOffer(id: string, values: Partial<Offer>) {
    await (supabase.from as any)("special_offers").update(values).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-offers"] });
  }

  async function removeOffer(id: string) {
    if (!confirm("Delete this offer? Claims stay on the students who already got it.")) return;
    await (supabase.from as any)("special_offers").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-offers"] });
  }

  const freeOn = !!settings.data?.toolkit_free_enabled;

  return (
    <div className="min-h-screen bg-muted/40 text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-5 pt-28 pb-20">
        <Link to="/admin" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-muted-foreground">
          <ArrowLeft size={15} /> Administration site
        </Link>
        <h1 className="mb-1 inline-flex items-center gap-3 text-3xl font-black tracking-tight">
          <Gift size={26} className="text-primary" /> Free toolkit
        </h1>
        <p className="mb-8 text-sm text-muted-foreground">
          The public page lives at <span className="font-bold">/toolkit</span>. Give it away for free, or hand out
          codes only.
        </p>

        <div className="mb-6 flex items-center justify-between rounded-2xl border-2 border-emerald-800/30 bg-emerald-50 p-4 text-emerald-950">
          <div>
            <p className="text-sm font-black">Looking for the new Offer Center?</p>
            <p className="text-xs text-emerald-800">
              Manage plans, duration, promo codes, background placeholders (YSMU), and student announcements.
            </p>
          </div>
          <Link
            to="/admin/offers"
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-800 px-4 py-2 text-xs font-black text-white shadow-xs hover:bg-emerald-900"
          >
            <Gift size={14} /> Open Offer Center →
          </Link>
        </div>

        <section className="rounded-2xl border-2 border-border bg-card p-6">
          <label className="flex items-center gap-3 text-sm font-bold">
            <input
              type="checkbox"
              checked={freeOn}
              onChange={(e) => saveSetting({ toolkit_free_enabled: e.target.checked })}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            Anyone signed in can claim the toolkit for free
          </label>
          <label className="mt-5 block text-xs font-black uppercase tracking-wider text-muted-foreground">
            What they get
            <select
              className={`${inputCls} mt-1`}
              value={settings.data?.toolkit_free_plan ?? "pack-study"}
              onChange={(e) => saveSetting({ toolkit_free_plan: e.target.value })}
            >
              {(plans.data ?? []).map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="mt-8 rounded-2xl border-2 border-border bg-card p-6">
          <h2 className="mb-3 inline-flex items-center gap-2 text-lg font-black">
            <Flame size={18} className="text-destructive" /> Special offers page
          </h2>
          <label className="flex items-start gap-3 rounded-2xl border-2 border-border bg-muted/40 p-4 text-sm font-bold">
            <input
              type="checkbox"
              checked={settings.data?.offers_page_enabled ?? true}
              onChange={(e) => saveSetting({ offers_page_enabled: e.target.checked })}
              className="mt-1 h-5 w-5 accent-[var(--primary)]"
            />
            <span>
              Special offers are live
              <span className="mt-1 block text-xs font-semibold text-muted-foreground">
                Turn this off to remove the offers page from the whole website — the header link, the
                footer link, the plan page and the page itself all disappear at once.
              </span>
            </span>
          </label>

          <div className="mt-6 grid gap-3 md:grid-cols-5">
            <input
              className={inputCls}
              placeholder="short name (toolkit)"
              value={newOffer.slug}
              onChange={(e) => setNewOffer({ ...newOffer, slug: e.target.value })}
            />
            <input
              className={inputCls}
              placeholder="Title"
              value={newOffer.title}
              onChange={(e) => setNewOffer({ ...newOffer, title: e.target.value })}
            />
            <input
              className={inputCls}
              placeholder="One line under the title"
              value={newOffer.subtitle}
              onChange={(e) => setNewOffer({ ...newOffer, subtitle: e.target.value })}
            />
            <select
              className={inputCls}
              value={newOffer.plan_slug}
              onChange={(e) => setNewOffer({ ...newOffer, plan_slug: e.target.value })}
            >
              {(plans.data ?? []).map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              className={inputCls}
              type="number"
              min={1}
              placeholder="Days (90)"
              value={newOffer.duration_days}
              onChange={(e) => setNewOffer({ ...newOffer, duration_days: e.target.value })}
            />
          </div>
          <button
            onClick={createOffer}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
          >
            <Plus size={15} /> Add offer
          </button>

          <div className="mt-5 space-y-3">
            {(offers.data ?? []).map((o) => (
              <div key={o.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    className={`${inputCls} max-w-xs`}
                    value={o.title}
                    onChange={(e) => patchOffer(o.id, { title: e.target.value })}
                  />
                  <input
                    className={`${inputCls} max-w-[9rem]`}
                    value={o.accent}
                    onChange={(e) => patchOffer(o.id, { accent: e.target.value })}
                    aria-label="Accent colour"
                  />
                  <input
                    className={`${inputCls} max-w-[11rem]`}
                    value={o.badge}
                    onChange={(e) => patchOffer(o.id, { badge: e.target.value })}
                    aria-label="Ribbon text"
                  />
                  <input
                    className={`${inputCls} max-w-[7rem]`}
                    type="number"
                    value={o.duration_days}
                    onChange={(e) => patchOffer(o.id, { duration_days: Number(e.target.value) })}
                    aria-label="Days"
                  />
                  <label className="flex items-center gap-2 text-xs font-bold">
                    <input
                      type="checkbox"
                      checked={o.requires_code}
                      onChange={(e) => patchOffer(o.id, { requires_code: e.target.checked })}
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                    Needs a code
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold">
                    <input
                      type="checkbox"
                      checked={o.is_active}
                      onChange={(e) => patchOffer(o.id, { is_active: e.target.checked })}
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                    Live
                  </label>
                  <button onClick={() => removeOffer(o.id)} className="ms-auto text-destructive" aria-label="Delete offer">
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <input
                    className={inputCls}
                    placeholder="Picture URL"
                    value={o.image_url ?? ""}
                    onChange={(e) => patchOffer(o.id, { image_url: e.target.value || null })}
                  />
                  <input
                    className={inputCls}
                    placeholder="Subtitle"
                    value={o.subtitle ?? ""}
                    onChange={(e) => patchOffer(o.id, { subtitle: e.target.value || null })}
                  />
                  <select
                    className={inputCls}
                    value={o.plan_slug}
                    onChange={(e) => patchOffer(o.id, { plan_slug: e.target.value })}
                  >
                    {(plans.data ?? []).map((p) => (
                      <option key={p.slug} value={p.slug}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  className={`${inputCls} mt-3`}
                  rows={3}
                  placeholder="One line per bullet"
                  defaultValue={(o.bullets ?? []).join("\n")}
                  onBlur={(e) =>
                    patchOffer(o.id, {
                      bullets: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean),
                    })
                  }
                />
              </div>
            ))}
            {(offers.data ?? []).length === 0 && (
              <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No offers yet.
              </p>
            )}
          </div>
        </section>

        <h2 className="mt-10 mb-3 text-lg font-black">Redeem codes</h2>
        <section className="rounded-2xl border-2 border-border bg-card p-6">
          <div className="grid gap-3 md:grid-cols-4">
            <input
              className={inputCls}
              placeholder="LamineYamal"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}

            />
            <select
              className={inputCls}
              value={form.plan_slug}
              onChange={(e) => setForm({ ...form, plan_slug: e.target.value })}
            >
              {(plans.data ?? []).map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              className={inputCls}
              placeholder="Note (workshop, teacher…)"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
            <input
              className={inputCls}
              type="number"
              min={1}
              placeholder="Max uses"
              value={form.max_uses}
              onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
            />
            <select
              className={inputCls}
              value={form.offer_id}
              onChange={(e) => setForm({ ...form, offer_id: e.target.value })}
            >
              <option value="">Any offer</option>
              {(offers.data ?? []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={createCode}
            disabled={busy}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Create code
          </button>
        </section>

        <div className="mt-5 space-y-2">
          {(codes.data ?? []).map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <input
                defaultValue={c.code}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (!next || next === c.code) return;
                  patchCode(c.id, { code: next });
                  toast.success("Code renamed");
                }}
                className="h-9 w-44 rounded-lg border border-border bg-background px-3 font-black tracking-wider"
                aria-label="Code"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(c.code);
                  toast.success("Copied");
                }}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Copy code"
              >
                <Copy size={14} />
              </button>
              <input
                type="number"
                min={1}
                defaultValue={c.max_uses ?? ""}
                placeholder="No limit"
                onBlur={(e) => {
                  const raw = e.target.value.trim();
                  patchCode(c.id, { max_uses: raw ? Number(raw) : null });
                }}
                className="h-9 w-28 rounded-lg border border-border bg-background px-3 text-xs font-bold"
                aria-label="Max uses"
              />
              <span className="text-xs font-bold text-muted-foreground">
                {c.plan_slug} · used {c.used_count}
                {c.max_uses ? ` / ${c.max_uses}` : ""}
                {c.label ? ` · ${c.label}` : ""}
              </span>

              <label className="ms-auto flex items-center gap-2 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={c.is_active}
                  onChange={(e) => patchCode(c.id, { is_active: e.target.checked })}
                  className="h-4 w-4 accent-[var(--primary)]"
                />
                Live
              </label>
              <button onClick={() => removeCode(c.id)} className="text-destructive" aria-label="Delete code">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {(codes.data ?? []).length === 0 && (
            <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No codes yet.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
