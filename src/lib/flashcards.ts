import { supabase } from "@/integrations/supabase/legacy-client";

export type FlashSubject = {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  color: string;
  emoji: string | null;
  sort: number;
  created_at: string;
};

export type FlashCard = {
  id: string;
  user_id: string;
  subject_id: string;
  front: string;
  back: string;
  sort: number;
  reviews: number;
  last_reviewed_at: string | null;
};

const db = (t: string) => (supabase.from as any)(t);

/** Accent set pulled from Rita's swirl artwork. */
export const SUBJECT_COLORS = {
  apricot: { dot: "#f6b352", soft: "#fdeed6" },
  sky: { dot: "#7cb8e8", soft: "#e2eff9" },
  lilac: { dot: "#b39ddb", soft: "#eee8f8" },
  mint: { dot: "#7fcaa5", soft: "#e0f2ea" },
  rose: { dot: "#ef9a9a", soft: "#fbe4e4" },
} as const;

export type SubjectColor = keyof typeof SUBJECT_COLORS;

export function colorOf(key: string) {
  return SUBJECT_COLORS[(key as SubjectColor) in SUBJECT_COLORS ? (key as SubjectColor) : "apricot"];
}

export async function fetchSubjects(): Promise<FlashSubject[]> {
  const { data, error } = await db("flash_subjects")
    .select("*")
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as FlashSubject[];
}

export async function fetchCardCounts(): Promise<Record<string, number>> {
  const { data, error } = await db("flash_cards").select("subject_id");
  if (error) throw error;
  const out: Record<string, number> = {};
  for (const row of (data ?? []) as { subject_id: string }[]) {
    out[row.subject_id] = (out[row.subject_id] ?? 0) + 1;
  }
  return out;
}

export async function fetchCards(subjectIds: string[]): Promise<FlashCard[]> {
  if (subjectIds.length === 0) return [];
  const { data, error } = await db("flash_cards")
    .select("*")
    .in("subject_id", subjectIds)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as FlashCard[];
}

export async function createSubject(input: {
  name: string;
  color: string;
  emoji: string | null;
  parent_id: string | null;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not signed in");
  const { error } = await db("flash_subjects").insert({ ...input, user_id: uid });
  if (error) throw error;
}

export async function renameSubject(id: string, name: string) {
  const { error } = await db("flash_subjects").update({ name }).eq("id", id);
  if (error) throw error;
}

export async function deleteSubject(id: string) {
  const { error } = await db("flash_subjects").delete().eq("id", id);
  if (error) throw error;
}

export async function createCards(
  subjectId: string,
  cards: { front: string; back: string }[],
) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Not signed in");
  const rows = cards.map((c, i) => ({ ...c, subject_id: subjectId, user_id: uid, sort: i }));
  const { error } = await db("flash_cards").insert(rows);
  if (error) throw error;
}

export async function deleteCard(id: string) {
  const { error } = await db("flash_cards").delete().eq("id", id);
  if (error) throw error;
}

export async function markReviewed(id: string, reviews: number) {
  const { error } = await db("flash_cards")
    .update({ reviews: reviews + 1, last_reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Parse a pasted batch: one card per line, "front | back" or "front - back". */
export function parseBatch(text: string): { front: string; back: string }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s*\|\s*|\s+—\s+|\s+-\s+/);
      const front = (parts[0] ?? "").trim();
      const back = parts.slice(1).join(" - ").trim();
      return { front, back };
    })
    .filter((c) => c.front && c.back);
}
