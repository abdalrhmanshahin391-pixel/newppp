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
        t("/admin/ritax-announcements", "RitaX Announcements", "Megaphone"),
        t("/admin/plans", "Rita Prices", "Ticket"),
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
      labelAr: "ذكاء ريتا",
      tiles: [
        t("/admin/ai", "AI engine", "Sparkles"),
        {
          id: "/admin/ai-keys",
          to: "/admin/ai-keys",
          label: "Rita API Keys",
          labelAr: "مفاتيح ريتا API",
          icon: "KeyRound",
        },
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
      label: g.label,
      labelAr: g.labelAr,
      tiles: (g.tiles ?? []).filter((x) => x && x.to && (x.custom || allowed.has(x.to))),
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
    // so Rita Prices stays at the top of the hub for existing saved layouts.
    const at = DEFAULT_LAYOUT.groups.indexOf(dg);
    groups.splice(Math.min(at, groups.length), 0, {
      ...dg,
      tiles: missing.map((m) => ({ ...m })),
    });
  }

  return { groups };
}
