import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Flame,
  Gift,
  KeyRound,
  Loader2,
  Megaphone,
  Plus,
  Save,
  Sparkles,
  Timer,
  Trash2,
  Eye,
  EyeOff,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { guardRedirect } from "@/lib/guard-redirect";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import {
  getOfferCenterData,
  saveOfferCenterConfig,
  type OfferCenterOffer,
  type OfferCenterPlan,
  type OfferCenterCode,
  type OfferCenterAnnouncement,
} from "@/lib/offer-center.functions";

export const Route = createFileRoute("/admin/offers")({
  head: () => ({
    meta: [
      { title: "Offer Center — Administration Site" },
      { name: "description", content: "Manage special student offers, promo codes, plans, and announcements." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminOfferCenter,
});

const inputCls =
  "w-full rounded-xl border border-black/15 bg-background px-3.5 py-2 text-sm font-medium text-foreground transition-all focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600";

const PRESET_DURATIONS = [
  { label: "1 Month", days: 30 },
  { label: "3 Months (Recommended)", days: 90 },
  { label: "6 Months", days: 180 },
  { label: "1 Year", days: 365 },
];

function AdminOfferCenter() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !isAdmin) guardRedirect(navigate);
  }, [loading, isAdmin, navigate]);

  const { data, isLoading } = useQuery({
    enabled: isAdmin,
    queryKey: ["admin-offer-center"],
    queryFn: () => getOfferCenterData(),
  });

  const [selectedOfferId, setSelectedOfferId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Form states with sensible defaults so nothing is ever blank
  const [title, setTitle] = useState("The Rita Toolkit — free right now");
  const [subtitle, setSubtitle] = useState(
    "Every study tool that costs us nothing to run, unlocked on your account for three months.",
  );
  const [badge, setBadge] = useState("FREE FOR 3 MONTHS");
  const [bullets, setBullets] = useState<string[]>([
    "Unlimited flashcards",
    "Unlimited to-do tasks",
    "Unlimited calendar entries",
    "Unlimited classrooms you create",
    "Join unlimited classrooms",
  ]);
  const [planSlug, setPlanSlug] = useState("toolkit");
  const [durationDays, setDurationDays] = useState(90);
  const [requiresCode, setRequiresCode] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [accent, setAccent] = useState("#2f7d55");
  const [imageUrl, setImageUrl] = useState("");

  // Code state
  const [promoCode, setPromoCode] = useState("YSMU");
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  const [maxUses, setMaxUses] = useState<string>("");

  // Announcement state
  const [annEnabled, setAnnEnabled] = useState(false);
  const [annTitle, setAnnTitle] = useState("🎁 Special Offer: The Rita Toolkit is free right now!");
  const [annBody, setAnnBody] = useState("Claim your free 3 months access with code YSMU.");
  const [annBtnLabel, setAnnBtnLabel] = useState("Claim offer →");
  const [annStyle, setAnnStyle] = useState<"ribbon" | "strip" | "floating">("ribbon");

  // Global offers page toggle
  const [pageEnabled, setPageEnabled] = useState(true);

  // New perk input
  const [newPerk, setNewPerk] = useState("");

  // Sync loaded data into state
  useEffect(() => {
    if (!data) return;
    setPageEnabled(data.offersPageEnabled);

    if (data.offers.length > 0) {
      const activeOffer =
        (selectedOfferId ? data.offers.find((o) => o.id === selectedOfferId) : null) ||
        data.offers.find((o) => o.slug === "toolkit") ||
        data.offers[0];

      if (activeOffer) {
        setSelectedOfferId(activeOffer.id);
        if (activeOffer.title) setTitle(activeOffer.title);
        if (activeOffer.subtitle !== undefined && activeOffer.subtitle !== null) {
          setSubtitle(activeOffer.subtitle);
        }
        if (activeOffer.badge) setBadge(activeOffer.badge);
        if (activeOffer.bullets && activeOffer.bullets.length > 0) {
          setBullets([...activeOffer.bullets]);
        }
        setPlanSlug(activeOffer.plan_slug || data.plans[0]?.slug || "toolkit");
        setDurationDays(activeOffer.duration_days || 90);
        setRequiresCode(activeOffer.requires_code ?? true);
        setIsActive(activeOffer.is_active ?? true);
        setAccent(activeOffer.accent || "#2f7d55");
        setImageUrl(activeOffer.image_url || "");

        const linkedCode =
          data.codes.find((c) => c.offer_id === activeOffer.id && c.is_active) ||
          data.codes.find((c) => c.offer_id === activeOffer.id) ||
          data.codes.find((c) => c.plan_slug === (activeOffer.plan_slug || "toolkit") && c.is_active) ||
          data.codes[0];

        if (linkedCode) {
          setPromoCode(linkedCode.code);
          setShowPlaceholder(linkedCode.label !== "hide_placeholder");
          setMaxUses(linkedCode.max_uses ? String(linkedCode.max_uses) : "");
        }
      }
    } else if (data.plans.length > 0) {
      setPlanSlug((p) => p || data.plans.find((pl) => pl.slug === "toolkit")?.slug || data.plans[0]?.slug || "toolkit");
    }

    if (data.announcement) {
      setAnnEnabled(data.announcement.enabled);
      if (data.announcement.title) setAnnTitle(data.announcement.title);
      if (data.announcement.body) setAnnBody(data.announcement.body);
      if (data.announcement.button_label) setAnnBtnLabel(data.announcement.button_label);
      if (data.announcement.style) {
        setAnnStyle(data.announcement.style === "strip" ? "strip" : data.announcement.style === "floating" ? "floating" : "ribbon");
      }
    }
  }, [data]);

  if (loading || !isAdmin) return <div className="min-h-screen bg-muted/40" />;

  const handleSelectOffer = (id: string) => {
    setSelectedOfferId(id);
    const o = data?.offers.find((item) => item.id === id);
    if (!o) return;
    setTitle(o.title || "The Rita Toolkit — free right now");
    setSubtitle(o.subtitle || "");
    setBadge(o.badge || "FREE FOR 3 MONTHS");
    setBullets(o.bullets && o.bullets.length > 0 ? [...o.bullets] : []);
    setPlanSlug(o.plan_slug || "toolkit");
    setDurationDays(o.duration_days || 90);
    setRequiresCode(o.requires_code ?? true);
    setIsActive(o.is_active ?? true);
    setAccent(o.accent || "#2f7d55");
    setImageUrl(o.image_url || "");
    const linkedCode =
      data?.codes.find((c) => c.offer_id === o.id && c.is_active) ||
      data?.codes.find((c) => c.offer_id === o.id) ||
      data?.codes.find((c) => c.plan_slug === (o.plan_slug || "toolkit") && c.is_active) ||
      data?.codes[0];
    if (linkedCode) {
      setPromoCode(linkedCode.code);
      setShowPlaceholder(linkedCode.label !== "hide_placeholder");
      setMaxUses(linkedCode.max_uses ? String(linkedCode.max_uses) : "");
    }
  };

  const handleAddPerk = () => {
    const p = newPerk.trim();
    if (!p) return;
    setBullets((b) => [...b, p]);
    setNewPerk("");
  };

  const handleRemovePerk = (idx: number) => {
    setBullets((b) => b.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    let targetId = selectedOfferId || data?.offers?.[0]?.id;
    if (!targetId) {
      const existing = data?.offers?.find((o) => o.slug === "toolkit");
      if (existing) targetId = existing.id;
    }

    const finalTitle = title.trim() || "The Rita Toolkit — free right now";
    const finalCode = promoCode.trim().toUpperCase() || "YSMU";
    const finalPlan = planSlug || "toolkit";

    setPromoCode(finalCode);
    setSaving(true);
    try {
      const payload = {
        offer: {
          id: targetId,
          title: finalTitle,
          subtitle: subtitle.trim() || null,
          badge: badge.trim() || "FREE FOR 3 MONTHS",
          bullets,
          plan_slug: finalPlan,
          duration_days: durationDays,
          requires_code: requiresCode,
          is_active: isActive,
          accent,
          image_url: imageUrl || null,
        },
        primaryCode: {
          code: finalCode,
          showPlaceholder,
          maxUses: maxUses ? Number(maxUses) : null,
        },
        announcement: {
          enabled: annEnabled,
          title: annTitle.trim() || "🎁 Special Offer: The Rita Toolkit is free right now!",
          body: annBody.trim() || "Claim your free 3 months access with code " + finalCode + ".",
          button_label: annBtnLabel.trim() || "Claim offer →",
          style: annStyle,
          accent,
        },
        offersPageEnabled: pageEnabled,
      };

      // 1. TanStack Start server function save (runs as verified admin)
      let srvSaved = false;
      try {
        const srvRes = await saveOfferCenterConfig({ data: payload });
        if (srvRes?.offerId) {
          targetId = srvRes.offerId;
          setSelectedOfferId(srvRes.offerId);
        }
        srvSaved = true;
      } catch (srvErr) {
        console.warn("Server action failed, proceeding with direct client save:", srvErr);
      }

      // 2. Direct browser client save (authenticated admin session in Supabase)
      try {
        let existingOfferId = targetId;
        const { data: exOffer } = targetId
          ? await (supabase.from as any)("special_offers").select("id").eq("id", targetId).maybeSingle()
          : { data: null };

        const offerFields = {
          title: payload.offer.title,
          subtitle: payload.offer.subtitle,
          badge: payload.offer.badge,
          bullets: payload.offer.bullets,
          plan_slug: payload.offer.plan_slug,
          duration_days: payload.offer.duration_days,
          requires_code: payload.offer.requires_code,
          is_active: payload.offer.is_active,
          accent: payload.offer.accent,
          image_url: payload.offer.image_url,
          updated_at: new Date().toISOString(),
        };

        if (exOffer?.id) {
          existingOfferId = exOffer.id;
          await (supabase.from as any)("special_offers").update(offerFields).eq("id", exOffer.id);
        } else {
          const { data: bySlug } = await (supabase.from as any)("special_offers").select("id").eq("slug", "toolkit").maybeSingle();
          if (bySlug?.id) {
            existingOfferId = bySlug.id;
            await (supabase.from as any)("special_offers").update(offerFields).eq("id", bySlug.id);
          } else {
            const { data: ins } = await (supabase.from as any)("special_offers").insert({ slug: "toolkit", ...offerFields }).select("id").maybeSingle();
            if (ins?.id) existingOfferId = ins.id;
          }
        }

        if (existingOfferId) {
          setSelectedOfferId(existingOfferId);
        }

        const codeFields = {
          code: finalCode,
          offer_id: existingOfferId || targetId,
          plan_slug: finalPlan,
          label: showPlaceholder ? "show_placeholder" : "hide_placeholder",
          is_active: true,
          max_uses: maxUses ? Number(maxUses) : null,
        };

        const { data: exCodeByOffer } = existingOfferId
          ? await (supabase.from as any)("toolkit_codes").select("id").eq("offer_id", existingOfferId).maybeSingle()
          : { data: null };

        const { data: exCodeByStr } = await (supabase.from as any)("toolkit_codes")
          .select("id")
          .ilike("code", finalCode)
          .maybeSingle();

        const { data: exCodeByPlan } = await (supabase.from as any)("toolkit_codes")
          .select("id")
          .eq("plan_slug", finalPlan)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const exCode = exCodeByOffer || exCodeByStr || exCodeByPlan;

        if (exCode?.id) {
          await (supabase.from as any)("toolkit_codes").update(codeFields).eq("id", exCode.id);
        } else {
          await (supabase.from as any)("toolkit_codes").insert(codeFields);
        }

        const { data: exSiteAnn } = await (supabase.from as any)("site_announcements")
          .select("id")
          .or("href.eq./offers,href.eq.https://www.ritajet.com/offers")
          .limit(1)
          .maybeSingle();

        if (annEnabled) {
          const siteAnnData = {
            title: payload.announcement.title,
            body: payload.announcement.body,
            href: "/offers",
            href_label: payload.announcement.button_label,
            style: annStyle,
            accent,
            active: true,
            pinned: true,
            urgent: false,
            sort: 0,
            paths: [],
            frequency: "always",
            updated_at: new Date().toISOString(),
          };
          if (exSiteAnn?.id) {
            await (supabase.from as any)("site_announcements").update(siteAnnData).eq("id", exSiteAnn.id);
          } else {
            await (supabase.from as any)("site_announcements").insert(siteAnnData);
          }
        } else if (exSiteAnn?.id) {
          await (supabase.from as any)("site_announcements").update({ active: false }).eq("id", exSiteAnn.id);
        }

        const { data: exRitax } = await (supabase.from as any)("announcements")
          .select("id")
          .or("primary_href.eq./offers,name.ilike.%Special Offer%")
          .limit(1)
          .maybeSingle();

        if (exRitax?.id) {
          await (supabase.from as any)("announcements").update({ status: "paused" }).eq("id", exRitax.id);
        }

        await (supabase.from as any)("site_settings").update({ offers_page_enabled: pageEnabled }).eq("id", true);
      } catch (clientErr) {
        console.error("Direct client update error:", clientErr);
        if (!srvSaved) throw clientErr;
      }

      toast.success("Offer Center changes saved and published!");

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-offer-center"] }),
        qc.invalidateQueries({ queryKey: ["offers-list"] }),
        qc.invalidateQueries({ queryKey: ["public-offer-meta"] }),
        qc.invalidateQueries({ queryKey: ["toolkit-codes"] }),
        qc.invalidateQueries({ queryKey: ["admin-offers"] }),
        qc.invalidateQueries({ queryKey: ["site-announcements"] }),
        qc.invalidateQueries({ queryKey: ["site-announcements-all"] }),
        qc.invalidateQueries({ queryKey: ["toolkit-settings"] }),
      ]);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save Offer Center changes.");
    } finally {
      setSaving(false);
    }
  };

  const currentPlan = data?.plans.find((p) => p.slug === planSlug);
  const durationMonths = Math.round(durationDays / 30);

  return (
    <div className="min-h-screen bg-[#f7f5ef] text-[#23201d]">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-4 py-10 md:px-8">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/10 pb-6">
          <div>
            <Link
              to="/admin"
              className="inline-flex items-center gap-2 text-[13px] font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft size={14} /> Administration Site
            </Link>
            <h1 className="mt-2 flex items-center gap-3 font-display text-3xl font-black md:text-4xl text-[#1a1714]">
              <Gift className="text-emerald-700" size={32} /> Offer Center
              <span className="text-xl font-bold text-muted-foreground">· مركز العروض</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Select plans, set offer copy and perks, configure duration, choose the promo code and background
              placeholder, and broadcast announcements to all students.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/offers"
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3.5 py-2 text-xs font-bold text-[#332f29] shadow-xs hover:bg-black/5"
            >
              <ExternalLink size={13} /> View Live Page
            </Link>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-5 py-2.5 text-sm font-black text-white shadow-sm hover:bg-emerald-900 active:scale-98 disabled:opacity-50 transition-all"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save & Publish
            </button>
          </div>
        </div>

        {/* Global Page Killswitch */}
        <div className="mt-6 flex items-center justify-between rounded-2xl border border-emerald-900/10 bg-emerald-50/70 p-4">
          <div className="flex items-center gap-3">
            <Sparkles className="text-emerald-800" size={20} />
            <div>
              <p className="text-sm font-black text-emerald-950">Public Offers Page (/offers) Active</p>
              <p className="text-xs text-emerald-800/80">
                When enabled, students can visit /offers to claim their special study packages.
              </p>
            </div>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={pageEnabled}
              onChange={(e) => setPageEnabled(e.target.checked)}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-black/20 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-700 peer-checked:after:translate-x-full peer-focus:outline-none" />
          </label>
        </div>

        {/* Offer Selector if multiple offers exist */}
        {data && data.offers.length > 1 && (
          <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-2">
            <span className="text-xs font-bold text-muted-foreground mr-1">Select Offer:</span>
            {data.offers.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => handleSelectOffer(o.id)}
                className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${
                  selectedOfferId === o.id
                    ? "bg-emerald-800 text-white shadow-xs"
                    : "border border-black/10 bg-white text-muted-foreground hover:bg-black/5"
                }`}
              >
                {o.title || o.slug}
              </button>
            ))}
          </div>
        )}

        {/* Main Grid: Settings & Live Preview */}
        <div className="mt-8 grid gap-8 lg:grid-cols-12">
          {/* Left Column: Form Controls (7 cols) */}
          <div className="space-y-6 lg:col-span-7">
            {/* 1. Plan & Status Card */}
            <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 font-display text-base font-black">
                <Ticket className="text-emerald-700" size={18} /> 1. Plan to Unlock & Status
              </h2>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground">
                    Target Plan (What the offer unlocks)
                  </label>
                  <select
                    className={`${inputCls} mt-1.5`}
                    value={planSlug || "toolkit"}
                    onChange={(e) => setPlanSlug(e.target.value)}
                  >
                    {(data?.plans ?? []).map((p) => (
                      <option key={p.slug} value={p.slug}>
                        {p.name} ({p.slug})
                      </option>
                    ))}
                    {!data?.plans?.some((p) => p.slug === (planSlug || "toolkit")) && (
                      <option value={planSlug || "toolkit"}>
                        {planSlug ? `${planSlug} (${planSlug})` : "Toolkit (toolkit)"}
                      </option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground">
                    Offer Status
                  </label>
                  <div className="mt-1.5 flex items-center gap-3 rounded-xl border border-black/10 px-3.5 py-2">
                    <input
                      type="checkbox"
                      id="offer-active"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="h-4 w-4 rounded accent-emerald-700"
                    />
                    <label htmlFor="offer-active" className="text-xs font-bold cursor-pointer">
                      {isActive ? "🟢 Live & Claimable" : "⏸️ Paused / Inactive"}
                    </label>
                  </div>
                </div>
              </div>
            </section>

            {/* 2. Free Duration Selector */}
            <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 font-display text-base font-black">
                <Timer className="text-emerald-700" size={18} /> 2. Free Duration (How long will it be free?)
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Determines how many days/months of free access students receive once they claim the offer.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {PRESET_DURATIONS.map((preset) => (
                  <button
                    key={preset.days}
                    type="button"
                    onClick={() => setDurationDays(preset.days)}
                    className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                      durationDays === preset.days
                        ? "bg-emerald-800 text-white shadow-xs"
                        : "border border-black/10 bg-[#faf8f3] text-[#3a352e] hover:bg-black/5"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-3">
                <label className="text-xs font-bold text-muted-foreground">Custom Days:</label>
                <input
                  type="number"
                  min={1}
                  max={3650}
                  className={`${inputCls} max-w-[120px]`}
                  value={durationDays}
                  onChange={(e) => setDurationDays(Math.max(1, Number(e.target.value)))}
                />
                <span className="text-xs font-semibold text-emerald-800">
                  ≈ {durationMonths > 0 ? `${durationMonths} month${durationMonths > 1 ? "s" : ""}` : `${durationDays} days`} of free access
                </span>
              </div>
            </section>

            {/* 3. Promo Code & Background Placeholder Setting */}
            <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 font-display text-base font-black">
                <KeyRound className="text-emerald-700" size={18} /> 3. Promo Code & Input Box Placeholder (YSMU)
              </h2>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground">
                    Promo / Claim Code
                  </label>
                  <input
                    type="text"
                    className={`${inputCls} mt-1.5 font-black uppercase tracking-widest text-emerald-900`}
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="e.g. YSMU"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Students will use this code on the /offers page to redeem.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground">
                    Code Enforcement
                  </label>
                  <div className="mt-1.5 flex items-center gap-2.5 rounded-xl border border-black/10 px-3.5 py-2">
                    <input
                      type="checkbox"
                      id="req-code"
                      checked={requiresCode}
                      onChange={(e) => setRequiresCode(e.target.checked)}
                      className="h-4 w-4 rounded accent-emerald-700"
                    />
                    <label htmlFor="req-code" className="text-xs font-bold cursor-pointer">
                      Require code to unlock
                    </label>
                  </div>
                </div>
              </div>

              {/* Crucial requested feature: Choose if code is in background of box */}
              <div className="mt-5 rounded-2xl border-2 border-emerald-800/15 bg-[#faf8f1] p-4.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-800 mt-0.5">
                      {showPlaceholder ? <Eye size={18} /> : <EyeOff size={18} />}
                    </div>
                    <div>
                      <label className="text-sm font-black text-[#1a1714]">
                        Show code in background of the input box ({promoCode || "YSMU"})
                      </label>
                      <p className="mt-0.5 text-xs text-[#524b42] leading-relaxed">
                        {showPlaceholder ? (
                          <span className="font-semibold text-emerald-800">
                            ✓ The code &ldquo;{promoCode || "YSMU"}&rdquo; will appear in the background of the box
                            (as a placeholder hint), exactly like in your picture!
                          </span>
                        ) : (
                          <span className="font-semibold text-[#665f54]">
                            ✗ The input box will show a neutral &ldquo;Enter promo code&rdquo; hint without revealing the
                            code in the background. Students must type it manually.
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex cursor-pointer items-center shrink-0">
                    <input
                      type="checkbox"
                      checked={showPlaceholder}
                      onChange={(e) => setShowPlaceholder(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-black/20 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-700 peer-checked:after:translate-x-full peer-focus:outline-none" />
                  </label>
                </div>
              </div>
            </section>

            {/* 4. Offer Copy, Perks & What to Do */}
            <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
              <h2 className="flex items-center gap-2 font-display text-base font-black">
                <Sparkles className="text-emerald-700" size={18} /> 4. Offer Details & What is Included
              </h2>

              <div className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground">
                      Offer Title
                    </label>
                    <input
                      type="text"
                      className={`${inputCls} mt-1.5`}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground">
                      Ribbon Badge Text
                    </label>
                    <input
                      type="text"
                      className={`${inputCls} mt-1.5`}
                      value={badge}
                      onChange={(e) => setBadge(e.target.value)}
                      placeholder="e.g. FREE FOR 3 MONTHS"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground">
                    Offer Subtitle
                  </label>
                  <textarea
                    rows={2}
                    className={`${inputCls} mt-1.5`}
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                  />
                </div>

                {/* Bullets / Perks */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground mb-2">
                    Included Benefits & Perks (Checkmark List)
                  </label>
                  <div className="space-y-2">
                    {bullets.map((b, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Check size={16} className="text-emerald-700 shrink-0" strokeWidth={3} />
                        <input
                          type="text"
                          className={inputCls}
                          value={b}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBullets((list) => list.map((item, i) => (i === idx ? val : item)));
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemovePerk(idx)}
                          className="p-1.5 text-black/40 hover:text-destructive transition-colors"
                          aria-label="Remove perk"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add perk form */}
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="Add new perk (e.g. Unlimited flashcards)"
                      value={newPerk}
                      onChange={(e) => setNewPerk(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddPerk();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddPerk}
                      className="inline-flex items-center gap-1 rounded-xl bg-black/5 hover:bg-black/10 px-4 py-2 text-xs font-bold shrink-0 transition-colors"
                    >
                      <Plus size={14} /> Add
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* 5. Broadcast Student Announcement */}
            <section className="rounded-3xl border-2 border-emerald-900/20 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-black/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-800">
                    <Megaphone size={19} />
                  </div>
                  <div>
                    <h2 className="font-display text-base font-black">
                      5. Broadcast Announcement to All Students
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Display a top banner across the whole site to notify students of this offer.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={annEnabled}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setAnnEnabled(on);
                      if (on) {
                        if (!annTitle.trim()) setAnnTitle("🎁 Special Offer: The Rita Toolkit is free right now!");
                        if (!annBody.trim()) setAnnBody("Claim your free 3 months access with code " + (promoCode || "YSMU") + ".");
                      }
                    }}
                    className="peer sr-only"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-black/20 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-700 peer-checked:after:translate-x-full peer-focus:outline-none" />
                </label>
              </div>

              {annEnabled && (
                <div className="mt-4 space-y-4 animate-in fade-in duration-200">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground">
                        Banner Headline
                      </label>
                      <input
                        type="text"
                        className={`${inputCls} mt-1.5`}
                        value={annTitle}
                        onChange={(e) => setAnnTitle(e.target.value)}
                        placeholder="e.g. 🎁 Special Offer Available!"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground">
                        Button Label
                      </label>
                      <input
                        type="text"
                        className={`${inputCls} mt-1.5`}
                        value={annBtnLabel}
                        onChange={(e) => setAnnBtnLabel(e.target.value)}
                        placeholder="e.g. Claim offer →"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground">
                      Banner Subtitle / Message
                    </label>
                    <input
                      type="text"
                      className={`${inputCls} mt-1.5`}
                      value={annBody}
                      onChange={(e) => setAnnBody(e.target.value)}
                      placeholder="e.g. Free 3-month access to the full study toolkit with code YSMU."
                    />
                  </div>

                  {/* Announcement banner live preview */}
                  <div className="mt-3 rounded-xl border border-emerald-800/20 bg-[#2f7d55] px-4 py-2 text-white shadow-xs flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-black">{annTitle || "Special Offer"}</span>
                      <span className="opacity-90">{annBody}</span>
                    </div>
                    <span className="rounded-full bg-white/20 px-2.5 py-0.5 font-bold shrink-0">
                      {annBtnLabel}
                    </span>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Right Column: Real-Time Live Preview Matching Picture (5 cols) */}
          <div className="lg:col-span-5">
            <div className="sticky top-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                  Live Public Preview (/offers)
                </span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                  What students will see
                </span>
              </div>

              {/* Exact Card Preview Matching media_1789295665981.png */}
              <div className="relative overflow-hidden rounded-[30px] border border-black/10 bg-white p-7 shadow-[0_24px_50px_-34px_rgba(43,38,32,0.45)]">
                {/* Badge */}
                {badge && (
                  <span className="inline-flex items-center rounded-full bg-[#e8f5ed] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#2f7d55]">
                    {badge}
                  </span>
                )}

                {/* Title */}
                <h2 className="mt-4 font-display text-2xl font-black leading-tight text-[#1a1714]">
                  {title || "The Rita Toolkit — free right now"}
                </h2>

                {/* Subtitle */}
                {subtitle && (
                  <p className="mt-2 text-[14px] leading-relaxed text-[#595247]">{subtitle}</p>
                )}

                {/* Bullets List */}
                <ul className="mt-5 space-y-2.5">
                  {bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[13.5px] font-semibold text-[#3a342c]">
                      <Check size={16} strokeWidth={3} className="mt-0.5 shrink-0 text-[#2f7d55]" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>

                {/* Timer Duration Pill */}
                <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#f6f0e6] px-3.5 py-1.5 text-[12px] font-semibold text-[#696154]">
                  <Timer size={13} /> Valid{" "}
                  {durationMonths > 0
                    ? `${durationMonths} month${durationMonths > 1 ? "s" : ""}`
                    : `${durationDays} days`}{" "}
                  from the moment you claim
                </p>

                {/* Code input box matching picture */}
                <div className="mt-6">
                  {requiresCode && (
                    <label className="mb-3 flex items-center gap-2 rounded-2xl border border-black/10 bg-[#fdf7ee] px-4 py-2.5">
                      <KeyRound size={15} className="shrink-0 text-muted-foreground" />
                      <input
                        readOnly
                        placeholder={showPlaceholder ? promoCode || "YSMU" : "Enter promo code"}
                        className="w-full bg-transparent text-[14px] font-bold tracking-wider text-[#2b2620] placeholder:text-[#b6ada0] focus:outline-none"
                      />
                    </label>
                  )}

                  <button
                    type="button"
                    disabled
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2f7d55] px-5 py-3 text-[14px] font-black text-white shadow-xs"
                  >
                    <Gift size={16} /> Get it free
                  </button>

                  <p className="mt-3 text-center text-[11px] text-muted-foreground">
                    Target Plan: <span className="font-bold text-[#1a1714]">{currentPlan?.name || planSlug}</span>
                  </p>
                </div>
              </div>

              {/* Codes in circulation */}
              <div className="rounded-2xl border border-black/10 bg-white p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                    Active Code for this Offer
                  </span>
                  <span className="font-mono text-xs font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">
                    {promoCode || "NONE"}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="flex justify-between">
                    <span>Background Placeholder:</span>
                    <span className="font-bold">{showPlaceholder ? "Visible in box" : "Hidden"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Target Plan:</span>
                    <span className="font-bold">{currentPlan?.name || planSlug}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Free Access:</span>
                    <span className="font-bold">{durationDays} days</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
