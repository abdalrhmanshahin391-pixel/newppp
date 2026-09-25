import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/legacy-client";

const db = (t: string) => (supabase.from as any)(t);
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase.rpc as any)(fn, args);

export type SpaceKind = "classroom" | "group";
export type SpaceRole = "owner" | "co_owner" | "member";

export type Space = {
  id: string;
  kind: SpaceKind;
  name: string;
  description: string | null;
  image_url: string | null;
  emoji: string | null;
  color: string;
  owner_id: string;
  chat_enabled: boolean;
  discoverable: boolean;
  who_can_add_decks: "owners" | "members";
  who_can_post: "owners" | "members";
  created_at: string;
};

export type MySpace = {
  id: string;
  kind: SpaceKind;
  name: string;
  description: string | null;
  image_url: string | null;
  emoji: string | null;
  color: string;
  owner_id: string;
  chat_enabled: boolean;
  role: SpaceRole;
  members: number;
  decks: number;
};

export type SpaceMember = {
  user_id: string;
  role: SpaceRole;
  joined_at: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
};

export const SPACE_COLORS: Record<string, { from: string; to: string }> = {
  apricot: { from: "#f6c67a", to: "#f0a95c" },
  sky: { from: "#a6d3f2", to: "#6aa9d8" },
  lilac: { from: "#cbb8ef", to: "#9b83d1" },
  mint: { from: "#a6e0c1", to: "#6ab887" },
  coral: { from: "#f6b4a2", to: "#d1795e" },
  lime: { from: "#c9e88a", to: "#8ec63f" },
};

export function spaceTone(key: string | null | undefined) {
  const c = SPACE_COLORS[key ?? "apricot"] ?? SPACE_COLORS["apricot"]!;
  return `linear-gradient(135deg, ${c.from}, ${c.to})`;
}

export const KIND_LABEL: Record<SpaceKind, string> = {
  classroom: "Classroom",
  group: "Study group",
};

export const ROLE_LABEL: Record<SpaceRole, string> = {
  owner: "Owner",
  co_owner: "Co-owner",
  member: "Member",
};

/* --------------------------------------------------------------- queries */

export async function listMySpaces(_userId?: string): Promise<MySpace[]> {
  const { data, error } = await rpc("my_spaces");
  if (error) throw error;
  return (data ?? []).map((s: any) => ({
    ...s,
    members: Number(s.members),
    decks: Number(s.decks),
  })) as MySpace[];
}

export function useMySpaces() {
  return useQuery({
    queryKey: ["my-spaces"],
    staleTime: 30_000,
    queryFn: () => listMySpaces(),
  });
}

export function useSpace(spaceId: string) {
  return useQuery({
    queryKey: ["space", spaceId],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await db("spaces").select("*").eq("id", spaceId).maybeSingle();
      if (error) throw error;
      return (data ?? null) as Space | null;
    },
  });
}

export function useSpaceMembers(spaceId: string) {
  return useQuery({
    queryKey: ["space-members", spaceId],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await rpc("space_members_view", { _space_id: spaceId });
      if (error) throw error;
      return (data ?? []) as SpaceMember[];
    },
  });
}

export type SpaceFolder = { id: string; space_id: string; name: string; sort: number };

export function useSpaceFolders(spaceId: string) {
  return useQuery({
    queryKey: ["space-folders", spaceId],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await db("space_folders")
        .select("*")
        .eq("space_id", spaceId)
        .order("sort", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SpaceFolder[];
    },
  });
}


export type SpaceDeck = {
  id: string;
  deck_id: string;
  folder_id: string | null;
  added_by: string;
  created_at: string;
  deck: {
    id: string;
    title: string;
    description: string | null;
    cover: string;
    emoji: string | null;
    card_count: number;
    save_count: number;
    owner_id: string;
    audience: "space" | "public";
  };
};

export function useSpaceDecks(spaceId: string) {
  return useQuery({
    queryKey: ["space-decks", spaceId],
    // Members flip between tabs a lot; keep one fresh copy instead of
    // refetching the whole list on every switch.
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await db("space_decks")
        .select(
          "id,deck_id,folder_id,added_by,created_at,deck:shared_decks(id,title,description,cover,emoji,card_count,save_count,owner_id,audience)",
        )
        .eq("space_id", spaceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).filter((r: any) => r.deck) as SpaceDeck[];
    },
  });
}


export type SpaceAnnouncement = {
  id: string;
  space_id: string;
  author_id: string;
  body: string;
  pinned: boolean;
  created_at: string;
};

export function useSpaceAnnouncements(spaceId: string) {
  return useQuery({
    queryKey: ["space-announcements", spaceId],
    queryFn: async () => {
      const { data, error } = await db("space_announcements")
        .select("*")
        .eq("space_id", spaceId)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as SpaceAnnouncement[];
    },
  });
}

export type SpaceMessage = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
};

export function useSpaceMessages(spaceId: string, enabled: boolean) {
  return useQuery({
    enabled,
    refetchInterval: enabled ? 5000 : false,
    queryKey: ["space-messages", spaceId],
    queryFn: async () => {
      const { data, error } = await db("space_messages")
        .select("id,author_id,body,created_at")
        .eq("space_id", spaceId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as SpaceMessage[];
    },
  });
}

export function useSpaceInvite(spaceId: string, canManage: boolean) {
  return useQuery({
    enabled: canManage,
    queryKey: ["space-invite", spaceId],
    queryFn: async () => {
      const { data, error } = await db("space_invites")
        .select("id,code,active")
        .eq("space_id", spaceId)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return ((data ?? [])[0] ?? null) as { id: string; code: string } | null;
    },
  });
}

/* ------------------------------------------------------------- mutations */

export async function createSpace(input: {
  kind: SpaceKind;
  name: string;
  description: string;
  emoji: string;
  color: string;
}) {
  const { data, error } = await rpc("create_space", {
    _kind: input.kind,
    _name: input.name,
    _description: input.description,
    _emoji: input.emoji,
    _color: input.color,
  });
  if (error) throw error;
  return data as string;
}

export async function updateSpace(id: string, values: Partial<Space>) {
  const { error } = await db("spaces").update(values).eq("id", id);
  if (error) throw error;
}

export async function deleteSpace(id: string) {
  const { error } = await db("spaces").delete().eq("id", id);
  if (error) throw error;
}

export async function leaveSpace(spaceId: string, userId: string) {
  const { error } = await db("space_members")
    .delete()
    .eq("space_id", spaceId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function setMemberRole(spaceId: string, userId: string, role: SpaceRole) {
  const { error } = await db("space_members")
    .update({ role })
    .eq("space_id", spaceId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function removeMember(spaceId: string, userId: string) {
  const { error } = await db("space_members")
    .delete()
    .eq("space_id", spaceId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function rotateInvite(spaceId: string, oldId?: string) {
  if (oldId) await db("space_invites").update({ active: false }).eq("id", oldId);
  const code = Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
  const { error } = await db("space_invites").insert({ space_id: spaceId, code });
  if (error) throw error;
  return code;
}

export async function addFolder(spaceId: string, name: string, sort: number) {
  const { error } = await db("space_folders").insert({ space_id: spaceId, name, sort });
  if (error) throw error;
}

export async function renameFolder(id: string, name: string) {
  const { error } = await db("space_folders").update({ name }).eq("id", id);
  if (error) throw error;
}

export async function deleteFolder(id: string) {
  const { error } = await db("space_folders").delete().eq("id", id);
  if (error) throw error;
}

/** Thrown when the same deck is added to a space twice. */
export const ALREADY_IN_SPACE = "already_in_space";

export async function addDeckToSpace(spaceId: string, deckId: string, folderId: string | null) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not signed in");
  const { error } = await db("space_decks").insert({
    space_id: spaceId,
    deck_id: deckId,
    folder_id: folderId,
    added_by: uid,
  });
  if (error) {
    if ((error as any).code === "23505") throw new Error(ALREADY_IN_SPACE);
    throw error;
  }
}


export async function moveDeck(rowId: string, folderId: string | null) {
  const { error } = await db("space_decks").update({ folder_id: folderId }).eq("id", rowId);
  if (error) throw error;
}

export async function removeDeckFromSpace(rowId: string) {
  const { error } = await db("space_decks").delete().eq("id", rowId);
  if (error) throw error;
}

export async function postAnnouncement(spaceId: string, body: string) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not signed in");
  const { error } = await db("space_announcements").insert({
    space_id: spaceId,
    author_id: uid,
    body: body.trim(),
  });
  if (error) throw error;
}

export async function setAnnouncementPinned(id: string, pinned: boolean) {
  const { error } = await db("space_announcements").update({ pinned }).eq("id", id);
  if (error) throw error;
}

export async function deleteAnnouncement(id: string) {
  const { error } = await db("space_announcements").delete().eq("id", id);
  if (error) throw error;
}

export async function sendMessage(spaceId: string, body: string) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not signed in");
  const { error } = await db("space_messages").insert({
    space_id: spaceId,
    author_id: uid,
    body: body.trim(),
  });
  if (error) throw error;
}

export async function previewInvite(code: string) {
  const { data, error } = await rpc("space_preview", { _code: code });
  if (error) throw error;
  return data as {
    valid: boolean;
    id?: string;
    kind?: SpaceKind;
    name?: string;
    description?: string | null;
    emoji?: string | null;
    color?: string;
    image_url?: string | null;
    members?: number;
    already?: boolean;
  };
}

export async function joinByCode(code: string) {
  const { data, error } = await rpc("join_space_by_code", { _code: code });
  if (error) {
    const msg = String((error as any).message ?? "");
    if (msg.includes("sign_in_required")) throw new Error("Please sign in first, then open the invite again.");
    if (msg.includes("invalid_invite"))
      throw new Error("This invite link has expired or been replaced. Ask the owner for a fresh one.");
    throw new Error(msg || "Could not join right now. Please try again.");
  }
  return data as string;
}

/**
 * Refreshes everything that changes when you join a space or add a deck, so the
 * screen you land on is already correct instead of needing a second attempt.
 */
export async function refreshSpace(
  qc: {
    invalidateQueries: (o: { queryKey: unknown[]; refetchType?: "active" | "all" }) => unknown;
  },
  spaceId?: string,
) {
  const jobs = [qc.invalidateQueries({ queryKey: ["my-spaces"], refetchType: "all" })];
  if (spaceId) {
    for (const key of ["space", "space-members", "space-decks", "space-folders"]) {
      jobs.push(qc.invalidateQueries({ queryKey: [key, spaceId], refetchType: "all" }));
    }
  }
  await Promise.all(jobs);
}


export function inviteLink(code: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/join/${code}`;
}
