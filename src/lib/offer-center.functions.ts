import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";

export type OfferCenterOffer = {
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

export type OfferCenterPlan = {
  slug: string;
  name: string;
  price_cents: number;
  currency: string;
  sort: number;
};

export type OfferCenterCode = {
  id: string;
  code: string;
  plan_slug: string;
  label: string | null;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  offer_id: string | null;
  created_at: string;
};

export type OfferCenterAnnouncement = {
  id?: string;
  enabled: boolean;
  title: string;
  body: string;
  button_label: string;
  style: "ribbon" | "strip" | "floating" | "toast" | "spotlight";
  accent: string;
};

export type OfferCenterData = {
  offers: OfferCenterOffer[];
  plans: OfferCenterPlan[];
  codes: OfferCenterCode[];
  announcement: OfferCenterAnnouncement;
  offersPageEnabled: boolean;
};

async function assertAdmin(context: any) {
  const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (roleErr || !isAdmin) throw new Error("Forbidden: Admin access required");
}

/** Admin-only: Load all offer center details (offers, plans, codes, announcement, settings) */
export const getOfferCenterData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OfferCenterData> => {
    await assertAdmin(context);
    let sb: any = context.supabase;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
      if (supabaseAdmin) sb = supabaseAdmin;
    } catch {
      // fallback to context.supabase
    }

    const [offersRes, plansRes, codesRes, siteAnnRes, ritaxRes, settingsRes] = await Promise.all([
      (sb.from as any)("special_offers").select("*").order("sort").catch(() => ({ data: null })),
      (sb.from as any)("plans").select("slug,name,price_cents,currency,sort").order("sort").catch(() => ({ data: null })),
      (sb.from as any)("toolkit_codes").select("*").order("created_at", { ascending: false }).catch(() => ({ data: null })),
      (sb.from as any)("site_announcements")
        .select("*")
        .or("href.eq./offers,href.eq.https://www.ritajet.com/offers")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .catch(() => ({ data: null })),
      (sb.from as any)("announcements")
        .select("*")
        .or("primary_href.eq./offers,name.ilike.%Special Offer%")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .catch(() => ({ data: null })),
      (sb.from as any)("site_settings").select("offers_page_enabled").maybeSingle().catch(() => ({ data: null })),
    ]);

    let offers = (offersRes?.data ?? []) as OfferCenterOffer[];
    let codes = (codesRes?.data ?? []) as OfferCenterCode[];

    // Auto-seed or locate default toolkit offer
    if (offers.length === 0) {
      try {
        const { data: existingOffer } = await (sb.from as any)("special_offers")
          .select("*")
          .eq("slug", "toolkit")
          .maybeSingle();

        if (existingOffer) {
          offers = [existingOffer];
        } else {
          const defaultOffer = {
            slug: "toolkit",
            title: "The Rita Toolkit — free right now",
            subtitle: "Every study tool that costs us nothing to run, unlocked on your account for three months.",
            badge: "FREE FOR 3 MONTHS",
            bullets: [
              "Unlimited flashcards",
              "Unlimited to-do tasks",
              "Unlimited calendar entries",
              "Unlimited classrooms you create",
              "Join unlimited classrooms",
            ],
            plan_slug: "toolkit",
            duration_days: 90,
            requires_code: true,
            is_active: true,
            accent: "#2f7d55",
            sort: 0,
          };
          const { data: inserted } = await (sb.from as any)("special_offers")
            .insert(defaultOffer)
            .select("*")
            .maybeSingle();

          if (inserted) {
            offers = [inserted];
          }
        }

        if (offers[0]?.id && codes.length === 0) {
          const { data: codeInserted } = await (sb.from as any)("toolkit_codes")
            .insert({
              code: "YSMU",
              offer_id: offers[0].id,
              plan_slug: "toolkit",
              label: "show_placeholder",
              is_active: true,
            })
            .select("*")
            .maybeSingle();
          if (codeInserted) {
            codes = [codeInserted];
          }
        }
      } catch (err) {
        console.warn("Could not auto-seed default special offer:", err);
      }
    }

    // Ensure any unlinked codes are linked to the primary offer
    if (offers.length > 0 && codes.length > 0) {
      const primaryOfferId = offers[0].id;
      for (const c of codes) {
        if (!c.offer_id) {
          c.offer_id = primaryOfferId;
          await (sb.from as any)("toolkit_codes").update({ offer_id: primaryOfferId }).eq("id", c.id).catch(() => undefined);
        }
      }
    }

    const sAnn = siteAnnRes?.data;
    const rAnn = ritaxRes?.data;
    const isLive = !!sAnn?.active || rAnn?.status === "live";

    const announcement: OfferCenterAnnouncement = {
      id: sAnn?.id || rAnn?.id,
      enabled: isLive,
      title: sAnn?.title || rAnn?.title || "🎁 Special Offer: The Rita Toolkit is free right now!",
      body: sAnn?.body || rAnn?.body || "Claim your free 3 months access with promo code.",
      button_label: sAnn?.href_label || rAnn?.primary_label || "Claim offer →",
      style: (sAnn?.style as any) || (rAnn?.layout === "modal" ? "spotlight" : rAnn?.layout === "sheet" ? "floating" : "ribbon"),
      accent: sAnn?.accent || rAnn?.accent || "#2f7d55",
    };

    return {
      offers,
      plans: (plansRes?.data ?? []) as OfferCenterPlan[],
      codes,
      announcement,
      offersPageEnabled: settingsRes?.data?.offers_page_enabled ?? true,
    };
  });

/** Admin-only: Save offer configuration, promo code, background placeholder setting, and announcement */
export const saveOfferCenterConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      offer: Partial<OfferCenterOffer> & { id?: string };
      primaryCode: {
        code: string;
        showPlaceholder: boolean;
        maxUses?: number | null;
      };
      announcement: OfferCenterAnnouncement;
      offersPageEnabled?: boolean;
    }) => {
      if (!data?.offer) throw new Error("Offer data is required");
      return data;
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let sb: any = context.supabase;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
      if (supabaseAdmin) sb = supabaseAdmin;
    } catch {
      // fallback to context.supabase
    }

    // 1. Update or upsert the special_offer in database
    const { offer, primaryCode, announcement, offersPageEnabled } = data;
    const offerPatch: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (offer.title !== undefined) offerPatch.title = offer.title.trim();
    if (offer.subtitle !== undefined) offerPatch.subtitle = offer.subtitle ? offer.subtitle.trim() : null;
    if (offer.badge !== undefined) offerPatch.badge = offer.badge.trim();
    if (offer.bullets !== undefined) offerPatch.bullets = offer.bullets;
    if (offer.plan_slug !== undefined) offerPatch.plan_slug = offer.plan_slug;
    if (offer.duration_days !== undefined) offerPatch.duration_days = Number(offer.duration_days);
    if (offer.requires_code !== undefined) offerPatch.requires_code = !!offer.requires_code;
    if (offer.is_active !== undefined) offerPatch.is_active = !!offer.is_active;
    if (offer.accent !== undefined) offerPatch.accent = offer.accent;
    if (offer.image_url !== undefined) offerPatch.image_url = offer.image_url;

    let targetOfferId = offer.id;
    let existingOffer: any = null;

    if (targetOfferId) {
      const { data: byId } = await (sb.from as any)("special_offers")
        .select("id, slug")
        .eq("id", targetOfferId)
        .maybeSingle();
      existingOffer = byId;
    }

    if (!existingOffer) {
      const { data: bySlug } = await (sb.from as any)("special_offers")
        .select("id, slug")
        .eq("slug", offer.slug || "toolkit")
        .maybeSingle();
      existingOffer = bySlug;
    }

    if (existingOffer?.id) {
      targetOfferId = existingOffer.id;
      const { error: offerErr } = await (sb.from as any)("special_offers")
        .update(offerPatch)
        .eq("id", targetOfferId);
      if (offerErr) throw offerErr;
    } else {
      const { data: inserted, error: offerErr } = await (sb.from as any)("special_offers")
        .insert({
          id: targetOfferId || crypto.randomUUID(),
          slug: offer.slug || "toolkit",
          ...offerPatch,
        })
        .select("id")
        .maybeSingle();
      if (offerErr) throw offerErr;
      if (inserted?.id) targetOfferId = inserted.id;
    }

    // 2. Sync / Upsert primary promo code in toolkit_codes
    const codeClean = (primaryCode.code || "").trim().toUpperCase() || "YSMU";
    if (targetOfferId) {
      const codeLabel = primaryCode.showPlaceholder ? "show_placeholder" : "hide_placeholder";
      const codeFields = {
        code: codeClean,
        offer_id: targetOfferId,
        plan_slug: offer.plan_slug || "toolkit",
        label: codeLabel,
        is_active: true,
        max_uses: primaryCode.maxUses ?? null,
      };

      // Check existing code by offer_id
      const { data: existingByOffer } = await (sb.from as any)("toolkit_codes")
        .select("id, code, offer_id")
        .eq("offer_id", targetOfferId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Check existing code by code string
      const { data: existingByCode } = await (sb.from as any)("toolkit_codes")
        .select("id, code, offer_id")
        .ilike("code", codeClean)
        .limit(1)
        .maybeSingle();

      // Check existing code by plan_slug
      const { data: existingByPlan } = await (sb.from as any)("toolkit_codes")
        .select("id, code, offer_id")
        .eq("plan_slug", offer.plan_slug || "toolkit")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const codeTarget = existingByOffer || existingByCode || existingByPlan;

      if (codeTarget?.id) {
        const { error: codeErr } = await (sb.from as any)("toolkit_codes")
          .update(codeFields)
          .eq("id", codeTarget.id);
        if (codeErr) throw codeErr;
      } else {
        const { error: codeErr } = await (sb.from as any)("toolkit_codes")
          .insert(codeFields);
        if (codeErr) throw codeErr;
      }
    }

    // 3. Sync Announcement in BOTH public.site_announcements AND public.announcements (RitaX)
    // 3A. Sync public.site_announcements (top banner bar)
    try {
      const { data: existingSiteAnn } = await (sb.from as any)("site_announcements")
        .select("id")
        .or("href.eq./offers,href.eq.https://www.ritajet.com/offers")
        .limit(1)
        .maybeSingle();

      if (announcement.enabled) {
        const sitePayload = {
          title: announcement.title.trim() || "🎁 Special Offer: The Rita Toolkit is free right now!",
          body: announcement.body.trim() || "Claim your free 3 months access with promo code " + (codeClean || "YSMU") + ".",
          href: "/offers",
          href_label: announcement.button_label.trim() || "Claim offer →",
          style: announcement.style || "ribbon",
          accent: announcement.accent || "#2f7d55",
          active: true,
          pinned: true,
          urgent: false,
          sort: 0,
          paths: [],
          trigger: "open",
          delay_seconds: 0,
          frequency: "always",
          updated_at: new Date().toISOString(),
        };

        if (existingSiteAnn?.id) {
          await (sb.from as any)("site_announcements")
            .update(sitePayload)
            .eq("id", existingSiteAnn.id);
        } else {
          await (sb.from as any)("site_announcements").insert(sitePayload);
        }
      } else if (existingSiteAnn?.id) {
        await (sb.from as any)("site_announcements")
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq("id", existingSiteAnn.id);
      }
    } catch (siteErr) {
      console.error("Failed to sync site_announcements:", siteErr);
    }

    // 3B. Deactivate duplicate RitaX announcement so it doesn't conflict with site banner
    try {
      const { data: existingRitax } = await (sb.from as any)("announcements")
        .select("id")
        .or("primary_href.eq./offers,name.ilike.%Special Offer%")
        .limit(1)
        .maybeSingle();

      if (existingRitax?.id) {
        await (sb.from as any)("announcements")
          .update({ status: "paused", updated_at: new Date().toISOString() })
          .eq("id", existingRitax.id);
      }
    } catch (ritaxErr) {
      console.error("Failed to sync RitaX announcements:", ritaxErr);
    }

    // 4. Update site_settings offers_page_enabled if supplied
    if (offersPageEnabled !== undefined) {
      try {
        await (sb.from as any)("site_settings")
          .update({ offers_page_enabled: !!offersPageEnabled })
          .eq("id", true);
      } catch (settingsErr) {
        console.warn("Could not update site_settings:", settingsErr);
      }
    }

    return { ok: true, offerId: targetOfferId };
  });

/** Public endpoint: Returns metadata for public `/offers` cards (placeholder code if enabled, etc.) */
export const getPublicOfferMeta = createServerFn({ method: "GET" }).handler(
  async (): Promise<Record<string, { code: string | null; showPlaceholder: boolean }>> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
      const [offersRes, codesRes] = await Promise.all([
        (supabaseAdmin.from as any)("special_offers").select("id, slug, is_active"),
        (supabaseAdmin.from as any)("toolkit_codes")
          .select("id, offer_id, code, label, is_active, plan_slug")
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
      ]);

      const offers = (offersRes?.data ?? []) as any[];
      const codes = (codesRes?.data ?? []) as any[];

      const result: Record<string, { code: string | null; showPlaceholder: boolean }> = {};
      if (Array.isArray(codes)) {
        for (const c of codes) {
          if (!c.offer_id) continue;
          const show = c.label === "show_placeholder";
          if (!result[c.offer_id] || show) {
            result[c.offer_id] = {
              code: show ? c.code : null,
              showPlaceholder: show,
            };
          }
        }
      }

      // Ensure active offer has metadata even if code's offer_id was null
      const activeOffer = offers.find((o) => o.slug === "toolkit" && o.is_active) || offers[0];
      const primaryCode = codes[0];
      if (activeOffer?.id && primaryCode && !result[activeOffer.id]) {
        const show = primaryCode.label !== "hide_placeholder";
        result[activeOffer.id] = {
          code: show ? primaryCode.code : null,
          showPlaceholder: show,
        };
      }

      return result;
    } catch {
      return {};
    }
  },
);

/** Claim an offer for the currently authenticated user (robust server-side claim with promo code & plan fallback) */
export const claimOfferAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { offerId: string; code?: string }) => {
    if (!data?.offerId) throw new Error("Offer ID is required");
    return data;
  })
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    if (!userId) throw new Error("Please sign in first to claim this offer.");

    let sb: any = context.supabase;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
      if (supabaseAdmin) sb = supabaseAdmin;
    } catch {
      // fallback
    }

    // 1. Try atomic database RPC claim_offer first
    const codeStrInput = (data.code || "").trim().toUpperCase();
    try {
      const { data: rpcRes, error: rpcErr } = await (context.supabase.rpc as any)("claim_offer", {
        _offer_id: data.offerId,
        _code: codeStrInput || null,
      });
      if (!rpcErr && rpcRes) {
        return {
          ok: true,
          alreadyClaimed: false,
          message: "Offer successfully claimed! Your study tools are unlocked.",
          ...rpcRes,
        };
      }
      if (rpcErr?.message?.toLowerCase().includes("already claimed")) {
        return {
          ok: true,
          alreadyClaimed: true,
          message: "You already claimed this offer! It is active on your account.",
        };
      }
    } catch {
      // fallback to manual lookup below
    }

    // 2. Fetch the special offer
    const { data: offer, error: offerErr } = await (sb.from as any)("special_offers")
      .select("*")
      .eq("id", data.offerId)
      .maybeSingle();

    if (offerErr || !offer || !offer.is_active) {
      throw new Error("That offer is not available.");
    }

    // 3. Check if user already claimed this offer
    const { data: existingClaim } = await (sb.from as any)("toolkit_claims")
      .select("id, expires_at, plan_slug")
      .eq("user_id", userId)
      .eq("offer_id", offer.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingClaim) {
      return {
        ok: true,
        alreadyClaimed: true,
        message: "You already claimed this offer! It is active on your account.",
        expires_at: existingClaim.expires_at,
        plan: existingClaim.plan_slug,
      };
    }

    // 4. Resolve code to use
    let codeStr = codeStrInput;
    let codeRow: any = null;

    if (offer.requires_code || codeStr) {
      // If user did not provide code, search for active code linked to this offer
      if (!codeStr) {
        const { data: autoCode } = await (sb.from as any)("toolkit_codes")
          .select("*")
          .eq("offer_id", offer.id)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (autoCode) {
          codeStr = autoCode.code;
          codeRow = autoCode;
        } else {
          const { data: latestActive } = await (sb.from as any)("toolkit_codes")
            .select("*")
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (latestActive) {
            codeStr = latestActive.code;
            codeRow = latestActive;
          }
        }
      }

      if (!codeStr) {
        throw new Error("This offer needs a promo code.");
      }

      // If codeRow not found yet, look it up by code string (case-insensitive)
      if (!codeRow) {
        const { data: foundCode } = await (sb.from as any)("toolkit_codes")
          .select("*")
          .ilike("code", codeStr)
          .limit(1)
          .maybeSingle();
        codeRow = foundCode;
      }

      if (!codeRow || !codeRow.is_active) {
        throw new Error("That code does not work.");
      }

      // If codeRow is unlinked or linked to old offer, link it to this active offer
      if (!codeRow.offer_id) {
        await (sb.from as any)("toolkit_codes").update({ offer_id: offer.id }).eq("id", codeRow.id);
      }

      if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
        throw new Error("That code has expired.");
      }

      if (
        codeRow.max_uses !== null &&
        codeRow.max_uses !== undefined &&
        (codeRow.used_count || 0) >= codeRow.max_uses
      ) {
        throw new Error("That code is used up.");
      }

      // Increment used_count
      await (sb.from as any)("toolkit_codes")
        .update({ used_count: (codeRow.used_count || 0) + 1 })
        .eq("id", codeRow.id);
    }

    // 5. Resolve plan
    const targetPlanSlug = codeRow?.plan_slug || offer.plan_slug;
    let { data: plan } = await (sb.from as any)("plans")
      .select("*")
      .eq("slug", targetPlanSlug)
      .maybeSingle();

    if (!plan) {
      const { data: fallbackPlan } = await (sb.from as any)("plans")
        .select("*")
        .eq("slug", "toolkit")
        .maybeSingle();
      plan = fallbackPlan;
    }

    if (!plan) {
      const { data: anyPlan } = await (sb.from as any)("plans")
        .select("*")
        .order("sort")
        .limit(1)
        .maybeSingle();
      plan = anyPlan;
    }

    if (!plan) {
      throw new Error("This offer is not set up yet.");
    }

    // 6. Calculate expiration
    const durationDays = Number(offer.duration_days) || 90;
    const expiresAt =
      durationDays > 0
        ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

    // 7. Record claim
    const { error: claimErr } = await (sb.from as any)("toolkit_claims").insert({
      user_id: userId,
      code_id: codeRow?.id ?? null,
      plan_slug: plan.slug,
      offer_id: offer.id,
      expires_at: expiresAt,
    });

    if (claimErr) throw claimErr;

    // 8. Insert plan credit grants if allowances exist
    const hasAllowances =
      (plan.max_flashcards || 0) > 0 ||
      (plan.max_ai_questions || 0) > 0 ||
      (plan.max_summaries || 0) > 0 ||
      (plan.max_todo_tasks || 0) > 0 ||
      (plan.max_calendar_items || 0) > 0 ||
      (plan.max_all_in_one_lectures || 0) > 0 ||
      (plan.max_all_in_one_questions || 0) > 0 ||
      (plan.max_archive_questions || 0) > 0 ||
      (plan.max_rita_questions || 0) > 0 ||
      (plan.max_groups || 0) > 0;

    if (hasAllowances) {
      await (sb.from as any)("plan_credit_grants").insert({
        user_id: userId,
        plan_slug: plan.slug,
        transaction_id: `offer-${crypto.randomUUID()}`,
        environment: "live",
        expires_at: expiresAt,
        flashcards: plan.max_flashcards || 0,
        ai_questions: plan.max_ai_questions || 0,
        summaries: plan.max_summaries || 0,
        todo_tasks: plan.max_todo_tasks || 0,
        calendar_items: plan.max_calendar_items || 0,
        all_in_one_lectures: plan.max_all_in_one_lectures || 0,
        all_in_one_questions: plan.max_all_in_one_questions || 0,
        archive_questions: plan.max_archive_questions || 0,
        rita_questions: plan.max_rita_questions || 0,
        groups: plan.max_groups || 0,
      });
    }

    return {
      ok: true,
      alreadyClaimed: false,
      plan: plan.slug,
      name: plan.name,
      expires_at: expiresAt,
    };
  });
