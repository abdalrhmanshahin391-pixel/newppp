/**
 * RitaX announcements — the database-driven pop-up system that admins design
 * in /admin/ritax-announcements and visitors see on the site.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/legacy-client";

export type RitaXLayout = "modal" | "sheet" | "corner" | "bar";
export type RitaXTheme = "cream" | "mint" | "sky" | "lilac" | "ink" | "sunset";
export type RitaXAudience = "all" | "signed_in" | "signed_out";
export type RitaXFrequency = "always" | "session" | "daily" | "once";
export type RitaXStatus = "draft" | "live" | "paused";

export type RitaX = {
  id: string;
  name: string;
  status: RitaXStatus;
  layout: RitaXLayout;
  theme: RitaXTheme;
  accent: string | null;
  eyebrow: string | null;
  title: string;
  body: string | null;
  image_url: string | null;
  emoji: string | null;
  confetti: boolean;
  countdown_to: string | null;
  primary_label: string | null;
  primary_href: string | null;
  secondary_label: string | null;
  secondary_href: string | null;
  audience: RitaXAudience;
  pages: string[] | null;
  starts_at: string | null;
  ends_at: string | null;
  frequency: RitaXFrequency;
  priority: number;
  created_at?: string;
  updated_at?: string;
};

export const RITAX_LAYOUTS: { id: RitaXLayout; name: string; note: string }[] = [
  { id: "modal", name: "Centre pop-up", note: "Big card in the middle, like the Ewa promo" },
  { id: "sheet", name: "Bottom sheet", note: "Slides up from the bottom — great on phones" },
  { id: "corner", name: "Corner card", note: "Small friendly card in the bottom-right" },
  { id: "bar", name: "Top bar", note: "Slim strip pinned above the page" },
];

export const RITAX_THEMES: { id: RitaXTheme; name: string; bg: string; ink: string; accent: string }[] = [
  { id: "cream", name: "Warm cream", bg: "#fdf6ec", ink: "#2c2620", accent: "#f0a24b" },
  { id: "mint", name: "Fresh mint", bg: "#eef8f1", ink: "#1e3329", accent: "#3fae6f" },
  { id: "sky", name: "Soft sky", bg: "#eef4fb", ink: "#1d2a3a", accent: "#3f8fd1" },
  { id: "lilac", name: "Quiet lilac", bg: "#f4f0fb", ink: "#2a2338", accent: "#8a6bd1" },
  { id: "ink", name: "Night ink", bg: "#191b22", ink: "#f7f4ef", accent: "#f0a24b" },
  { id: "sunset", name: "Sunset peach", bg: "#fdefe8", ink: "#37231c", accent: "#ea7a5a" },
];

export const RITAX_AUDIENCES: { id: RitaXAudience; name: string }[] = [
  { id: "all", name: "Everyone" },
  { id: "signed_in", name: "Signed-in students only" },
  { id: "signed_out", name: "Visitors who aren't signed in" },
];

export const RITAX_FREQUENCIES: { id: RitaXFrequency; name: string }[] = [
  { id: "always", name: "Every visit" },
  { id: "session", name: "Once per visit" },
  { id: "daily", name: "Once a day" },
  { id: "once", name: "Only once ever" },
];

export function themeOf(a: Pick<RitaX, "theme" | "accent">) {
  const t = RITAX_THEMES.find((x) => x.id === a.theme) ?? RITAX_THEMES[0]!;
  return { ...t, accent: a.accent || t.accent };
}

export function matchesPage(a: RitaX, pathname: string) {
  const list = (a.pages ?? []).map((p) => p.trim()).filter(Boolean);
  if (!list.length) return true;
  return list.some((p) =>
    p.endsWith("*") ? pathname.startsWith(p.slice(0, -1)) : pathname === p,
  );
}

export function isScheduledNow(a: RitaX, now = Date.now()) {
  if (a.status !== "live") return false;
  if (a.starts_at && new Date(a.starts_at).getTime() > now) return false;
  if (a.ends_at && new Date(a.ends_at).getTime() < now) return false;
  return true;
}

/* ---------------- seen bookkeeping (frequency control) ---------------- */

const SEEN_KEY = "ritax-seen";

type SeenMap = Record<string, { at: number }>;

function readSeen(store: Storage | null): SeenMap {
  try {
    return JSON.parse(store?.getItem(SEEN_KEY) || "{}") as SeenMap;
  } catch {
    return {};
  }
}

function writeSeen(store: Storage | null, map: SeenMap) {
  try {
    store?.setItem(SEEN_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function alreadySeen(a: RitaX) {
  if (typeof window === "undefined") return true;
  if (a.frequency === "always") return false;
  const store = a.frequency === "session" ? window.sessionStorage : window.localStorage;
  const hit = readSeen(store)[a.id];
  if (!hit) return false;
  if (a.frequency === "daily") return Date.now() - hit.at < 24 * 60 * 60 * 1000;
  return true;
}

export function markSeen(a: RitaX) {
  if (typeof window === "undefined" || a.frequency === "always") return;
  const store = a.frequency === "session" ? window.sessionStorage : window.localStorage;
  const map = readSeen(store);
  map[a.id] = { at: Date.now() };
  writeSeen(store, map);
}

/* ---------------- data ---------------- */

export function useLiveRitaX() {
  return useQuery({
    queryKey: ["ritax-live"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("announcements")
        .select("*")
        .eq("status", "live")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RitaX[];
    },
  });
}

export function useAllRitaX() {
  return useQuery({
    queryKey: ["ritax-all"],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("announcements")
        .select("*")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RitaX[];
    },
  });
}

export async function trackRitaX(id: string, kind: "view" | "click" | "dismiss") {
  try {
    const { data } = await supabase.auth.getSession();
    await (supabase.from as any)("announcement_events").insert({
      announcement_id: id,
      kind,
      user_id: data.session?.user?.id ?? null,
    });
  } catch {
    /* analytics is best-effort */
  }
}

export async function ritaxStats(): Promise<Record<string, { view: number; click: number; dismiss: number }>> {
  const { data } = await (supabase.from as any)("announcement_events").select("announcement_id,kind");
  const out: Record<string, { view: number; click: number; dismiss: number }> = {};
  for (const row of (data ?? []) as { announcement_id: string; kind: string }[]) {
    const bucket = (out[row.announcement_id] ??= { view: 0, click: 0, dismiss: 0 });
    if (row.kind === "view" || row.kind === "click" || row.kind === "dismiss") bucket[row.kind] += 1;
  }
  return out;
}

export function emptyRitaX(): Omit<RitaX, "id"> {
  return {
    name: "New announcement",
    status: "draft",
    layout: "modal",
    theme: "cream",
    accent: null,
    eyebrow: "ANNOUNCING",
    title: "Free access to the study toolkit",
    body: "Flashcards, PDF summaries and practice questions — free for a limited time.",
    image_url: null,
    emoji: "🎉",
    confetti: true,
    countdown_to: null,
    primary_label: "Get your free toolkit",
    primary_href: "/offers",
    secondary_label: null,
    secondary_href: null,
    audience: "all",
    pages: null,
    starts_at: null,
    ends_at: null,
    frequency: "session",
    priority: 0,
  };
}
