import { currentProductCopy } from "./brand";
import {
  Compass, FileText, MoonStar, Sparkles, Languages, Zap, Settings, Type,
  FolderTree, Users, Smartphone, Ticket, Archive, BookOpen, Video, Package,
  ListPlus, BarChart3, GraduationCap, Palette, ShieldAlert, LifeBuoy, Info,
  UsersRound, Server, History, Star, Heart, Flag, Link2, Wrench, Rocket,
  ListChecks, CalendarDays, Timer, Library, Bell, Gift, Megaphone, Tag, KeyRound,
  type LucideIcon,
} from "lucide-react";

export const ICONS: Record<string, LucideIcon> = {
  Compass, FileText, MoonStar, Sparkles, Languages, Zap, Settings, Type,
  FolderTree, Users, Smartphone, Ticket, Archive, BookOpen, Video, Package,
  ListPlus, BarChart3, GraduationCap, Palette, ShieldAlert, LifeBuoy, Info,
  UsersRound, Server, History, Star, Heart, Flag, Link2, Wrench, Rocket,
  ListChecks, CalendarDays, Timer, Library, Bell, Gift, Megaphone, Tag, KeyRound,
};


export const ICON_NAMES = Object.keys(ICONS);

export type HubTile = {
  id: string;
  to: string;
  label: string;
  labelAr?: string;
  icon: string;
  hidden?: boolean;
  custom?: boolean;
  external?: boolean;
};

export type HubGroup = {
  id: string;
  label: string;
  labelAr?: string;
  tiles: HubTile[];
};

export type HubLayout = { groups: HubGroup[] };

function t(to: string, label: string, icon: string): HubTile {
  return { id: to, to, label, icon };
}

export const DEFAULT_LAYOUT: HubLayout = {
  groups: [
    {
      id: "announcements",
      label: "Announcements & Prices",
      labelAr: "الإعلانات والأسعار",
      tiles: [
        t("/admin/ritax-announcements", "Uzyra Announcements", "Megaphone"),
        t("/admin/plans", "Uzyra Prices", "Ticket"),
        {
          id: "/admin/offers",
          to: "/admin/offers",
          label: "Offer Center",
          labelAr: "مركز العروض",
          icon: "Gift",
        },
        t("/admin/paddle-sync", "Paddle Sync", "Zap"),
        t("/admin/promo-codes", "Promo Codes", "Tag"),
        t("/admin/toolkit", "Free Toolkit", "Gift"),
        t("/admin/notifications", "Notifications", "Bell"),
      ],
    },
    {
      id: "support",
      label: "Support Center",
      labelAr: "مركز الدعم والمساعدة",
      tiles: [
        {
          id: "/admin/support",
          to: "/admin/support",
          label: "Support Center",
          labelAr: "مركز الدعم",
          icon: "LifeBuoy",
        },
      ],
    },
    {
      id: "ai",
      label: "AI engine",
      labelAr: "ذكاء يوزرا",
      tiles: [
        t("/admin/ai", "AI engine", "Sparkles"),
        {
          id: "/admin/rita-voice",
          to: "/admin/rita-voice",
          label: "Uzyra Voice v3",
          labelAr: "صوت يوزرا الجديد",
          icon: "KeyRound",
        },
        {
          id: "/admin/rita-quality",
          to: "/admin/rita-quality",
          label: "Uzyra quality",
          labelAr: "جودة يوزرا",
          icon: "ListChecks",
        },
        {
          id: "/admin/curricula",
          to: "/admin/curricula",
          label: "Uzyra lessons & curriculum",
          labelAr: "مناهج دروس يوزرا",
          icon: "GraduationCap",
        },
        {
          id: "/admin/study-sample",
          to: "/admin/study-sample",
          label: "Try the study page (guide + Uzyra)",
          labelAr: "جرّب صفحة الدراسة (ملف + يوزرا)",
          icon: "BookOpen",
        },
        {
          id: "/admin/languages",
          to: "/admin/languages",
          label: "Learning languages",
          labelAr: "لغات التعلّم",
          icon: "Languages",
        },
        t("/admin/ai-keys", "General AI keys", "KeyRound"),
      ],
    },
    {
      id: "people",
      label: "People",
      labelAr: "المستخدمون",
      tiles: [
        t("/admin/people", "People Intelligence", "BarChart3"),
        t("/admin/users", "Users & Roles", "Users"),
        t("/admin/spaces", "Classrooms & Groups", "UsersRound"),
      ],
    },
  ],
};


/**
 * Merge a stored layout over the defaults so newly shipped admin pages
 * still show up in their default group even if they aren't in the saved copy.
 */
export function mergeLayout(stored: unknown): HubLayout {
  const s = stored as HubLayout | null | undefined;
  if (!s || !Array.isArray(s.groups) || s.groups.length === 0) {
    return structuredClone(DEFAULT_LAYOUT);
  }

  // Only the tiles that ship in the trimmed default hub (plus tiles the admin
  // added by hand) survive: retired admin pages are dropped from saved layouts.
  const allowed = new Set(DEFAULT_LAYOUT.groups.flatMap((g) => g.tiles.map((x) => x.to)));

  const groups: HubGroup[] = s.groups
    .map((g) => ({
      id: g.id,
      label: currentProductCopy(g.label),
      labelAr: g.labelAr ? currentProductCopy(g.labelAr) : g.labelAr,
      tiles: (g.tiles ?? [])
        .filter((x) => x && x.to && (x.custom || allowed.has(x.to)))
        .map((x) => ({
          ...x,
          label: currentProductCopy(x.label),
          labelAr: x.labelAr ? currentProductCopy(x.labelAr) : x.labelAr,
        })),
    }))
    .filter((g) => g.tiles.length > 0);


  const known = new Set(groups.flatMap((g) => g.tiles.map((x) => x.id ?? x.to)));

  for (const dg of DEFAULT_LAYOUT.groups) {
    const missing = dg.tiles.filter((x) => !known.has(x.id));
    if (missing.length === 0) continue;
    const target = groups.find((g) => g.id === dg.id);
    if (target) {
      target.tiles.push(...missing.map((m) => ({ ...m })));
      continue;
    }
    // A newly shipped group keeps its default position instead of landing last,
    // so Uzyra Prices stays at the top of the hub for existing saved layouts.
    const at = DEFAULT_LAYOUT.groups.indexOf(dg);
    groups.splice(Math.min(at, groups.length), 0, {
      ...dg,
      tiles: missing.map((m) => ({ ...m })),
    });
  }

  return { groups };
}
