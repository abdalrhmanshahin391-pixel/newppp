import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden: admin only");
}

export type PeopleOverview = {
  active_now: number;
  opened_today: number;
  total_users: number;
  new_today: number;
  new_week: number;
  new_month: number;
  new_prev_week: number;
  new_prev_month: number;
  logins_today: number;
  logins_week: number;
  logins_month: number;
  logins_prev_week: number;
  verified: number;
  unverified: number;
  blocked: number;
  suspended: number;
  never_logged_in: number;
  dormant_30d: number;
  revenue_cents: number;
  revenue_month_cents: number;
  paying_users: number;
  course_grants: number;
  owners: number;
  coupon_redemptions: number;
  coupon_discount: number;
  generated_at: string;
};

export type SeriesPoint = { day: string; signups: number; logins: number; active_users: number };
export type CohortRow = { cohort: string; size: number; w0: number; w1: number; w2: number; w3: number };
export type CourseStat = { course_id: string; title: string; price: number | null; owners: number; revenue_cents: number };
export type PeopleInsights = {
  avg_logins_with_courses: number;
  avg_logins_without_courses: number;
  avg_logins_overall: number;
  median_days_to_first_login: number;
  share_returning: number;
  share_active_7d: number;
  peak_hour: number;
  peak_weekday: string;
};
export type DirectoryRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  phone: string | null;
  verified: boolean;
  locked_at: string | null;
  lock_until: string | null;
  lock_reason: string | null;
  roles: string[];
  courses: number;
  paid_cents: number;
  created_at: string;
  last_seen: string | null;
  login_count: number;
  plan_slug: string;
  plan_name: string;
  kit_slug: string | null;
  kit_name: string | null;
  kit_expires_at: string | null;
};

export type PeopleDashboard = {
  overview: PeopleOverview;
  series: SeriesPoint[];
  cohorts: CohortRow[];
  courses: CourseStat[];
  insights: PeopleInsights;
  directory: DirectoryRow[];
};

export const getPeopleDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { days?: number }) => d ?? {})
  .handler(async ({ data, context }): Promise<PeopleDashboard> => {
    await assertAdmin(context);
    const days = Math.min(Math.max(Number(data?.days ?? 30) || 30, 7), 365);
    const sb = context.supabase as any;
    const [overview, series, cohorts, courses, insights, directory] = await Promise.all([
      sb.rpc("admin_people_overview"),
      sb.rpc("admin_people_timeseries", { _days: days }),
      sb.rpc("admin_people_retention"),
      sb.rpc("admin_people_course_stats"),
      sb.rpc("admin_people_insights"),
      sb.rpc("admin_people_directory"),
    ]);
    const first = [overview, series, cohorts, courses, insights, directory].find((r: any) => r.error);
    if (first) throw new Error(first.error.message);
    return {
      overview: overview.data as PeopleOverview,
      series: (series.data ?? []) as SeriesPoint[],
      cohorts: (cohorts.data ?? []) as CohortRow[],
      courses: (courses.data ?? []) as CourseStat[],
      insights: insights.data as PeopleInsights,
      directory: (directory.data ?? []) as DirectoryRow[],
    };
  });

export type PersonDetail = {
  courses: Array<{ course_id: string; title: string | null; created_at: string }>;
  payments: Array<{ id: string; amount_cents: number; currency: string | null; status: string | null; created_at: string }>;
  devices: Array<{ id: string; platform: string | null; user_agent: string | null; last_seen_at: string }>;
  logins: string[];
};

export const getPersonDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }): Promise<PersonDetail> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
    const [uc, pe, dv, le] = await Promise.all([
      supabaseAdmin.from("user_courses").select("course_id, created_at, courses(title)").eq("user_id", data.userId),
      supabaseAdmin.from("payment_events").select("id, amount_cents, currency, status, created_at").eq("user_id", data.userId).order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("user_devices").select("id, platform, user_agent, last_seen_at").eq("user_id", data.userId).order("last_seen_at", { ascending: false }).limit(20),
      supabaseAdmin.from("user_login_events").select("occurred_at").eq("user_id", data.userId).order("occurred_at", { ascending: false }).limit(30),
    ]);
    return {
      courses: ((uc.data ?? []) as any[]).map((r) => ({
        course_id: r.course_id,
        title: r.courses?.title ?? null,
        created_at: r.created_at,
      })),
      payments: (pe.data ?? []) as any[],
      devices: (dv.data ?? []) as any[],
      logins: ((le.data ?? []) as any[]).map((r) => r.occurred_at),
    };
  });

export type PulseHour = { hour: number; logins: number };
export type PlanMix = { slug: string; name: string; people: number };
export type PeoplePulse = {
  generated_at: string;
  online_now: number;
  online_15m: number;
  opened_today: number;
  opened_yesterday: number;
  total_users: number;
  hourly: PulseHour[];
  plan_mix: PlanMix[];
};
export type OnlineRow = {
  user_id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  plan_slug: string;
  plan_name: string;
  started_at: string;
  last_seen_at: string;
  minutes_active: number;
};

/** Live pulse + who is online, refreshed by the page every minute. */
export const getPeoplePulse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ pulse: PeoplePulse; online: OnlineRow[] }> => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    const [pulse, online] = await Promise.all([
      sb.rpc("admin_people_pulse"),
      sb.rpc("admin_people_online"),
    ]);
    if (pulse.error) throw new Error(pulse.error.message);
    if (online.error) throw new Error(online.error.message);
    return { pulse: pulse.data as PeoplePulse, online: (online.data ?? []) as OnlineRow[] };
  });

export type PersonHistory = {
  plan_slug: string;
  plan_changed_at: string | null;
  logins: string[];
  devices: Array<{ id: string; platform: string | null; user_agent: string | null; last_seen_at: string }>;
  payments: Array<{ id: string; amount_cents: number; currency: string | null; status: string | null; created_at: string }>;
  decks: number;
  cards: number;
  summaries: number;
  spaces: number;
};

export const getPersonHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => {
    if (!d?.userId) throw new Error("Missing person");
    return d;
  })
  .handler(async ({ data, context }): Promise<PersonHistory> => {
    await assertAdmin(context);
    const { data: row, error } = await (context.supabase as any).rpc("admin_person_history", {
      _user_id: data.userId,
    });
    if (error) throw new Error(error.message);
    return row as PersonHistory;
  });

/** Give one person manual access without overwriting their paid plan. */
export const setPersonPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; planSlug: string }) => {
    if (!d?.userId || !d?.planSlug) throw new Error("Missing person or plan");
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase as any).from("manual_plan_grants").insert({
      user_id: data.userId,
      plan_slug: data.planSlug,
      starts_at: new Date().toISOString(),
      reason: "Granted from People admin",
      overrides_paid: true,
      granted_by: (context as any).userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Email this person a password-reset link (nobody can read a password). */
export const sendPersonReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; redirectTo: string }) => {
    if (!d?.email) throw new Error("This account has no email address");
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(data.email, {
      redirectTo: data.redirectTo,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
