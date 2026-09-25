/* eslint-disable @typescript-eslint/no-explicit-any -- The personal learning tables are not in the generated Supabase types. */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireRitaUser } from "@/lib/rita-voice.server";
import { flashcardFaces, isGermanItem, learningKey, termWithoutArticle } from "@/lib/rita-learning";
import type { LearningItem } from "@/lib/rita-learning";

const uuid = z.string().uuid();
const itemSchema = z.object({
  term: z.string().trim().min(1).max(180),
  meaning: z.string().trim().min(1).max(280),
  language: z
    .string()
    .trim()
    .regex(/^[a-z]{2,3}(?:-[a-z]{2,4})?$/i),
  kind: z.enum(["word", "sentence"]),
  article: z.enum(["der", "die", "das"]).nullable(),
  plural: z.string().max(120).nullable(),
});
const saveSchema = z.object({
  action: z.literal("save"),
  target: z.enum(["flashcards", "german_lab"]),
  destinationId: uuid,
  items: z.array(itemSchema).min(1).max(25),
});
const createSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_flash_subject"),
    name: z.string().trim().min(1).max(80),
    parentId: uuid.nullable(),
  }),
  z.object({ action: z.literal("create_german_subject"), name: z.string().trim().min(1).max(80) }),
  z.object({
    action: z.literal("create_german_subtopic"),
    name: z.string().trim().min(1).max(80),
    subjectId: uuid,
  }),
]);

function failure(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export const Route = createFileRoute("/api/rita/learning")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireRitaUser(request);
        if (!auth) return failure("Please sign in first.", 401);
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const table = (name: string) => (supabaseAdmin.from as any)(name);
          const [flash, german, subtopics] = await Promise.all([
            table("flash_subjects")
              .select("id, parent_id, name")
              .eq("user_id", auth.userId)
              .order("sort"),
            table("de_subjects")
              .select("id, name")
              .eq("user_id", auth.userId)
              .eq("is_sample", false)
              .order("position"),
            table("de_subtopics")
              .select("id, subject_id, name")
              .eq("user_id", auth.userId)
              .eq("is_sample", false)
              .order("position"),
          ]);
          if (flash.error || german.error || subtopics.error)
            throw new Error("Destinations unavailable");
          return Response.json(
            {
              flashSubjects: flash.data ?? [],
              germanSubjects: german.data ?? [],
              germanSubtopics: subtopics.data ?? [],
            },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch (error) {
          console.error("Rita destination list failed", error);
          return failure("Could not load your subjects.", 503);
        }
      },
      POST: async ({ request }) => {
        const auth = await requireRitaUser(request);
        if (!auth) return failure("Please sign in first.", 401);
        const raw = await request.json().catch(() => null);
        const input =
          raw?.action === "save" ? saveSchema.safeParse(raw) : createSchema.safeParse(raw);
        if (!input.success) return failure("Invalid learning request.", 400);
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const table = (name: string) => (supabaseAdmin.from as any)(name);
          const data = input.data;

          if (data.action === "create_flash_subject") {
            if (data.parentId) {
              const { data: parent } = await table("flash_subjects")
                .select("id")
                .eq("id", data.parentId)
                .eq("user_id", auth.userId)
                .maybeSingle();
              if (!parent) return failure("That parent subject is not yours.", 403);
            }
            const { data: created, error } = await table("flash_subjects")
              .insert({
                user_id: auth.userId,
                parent_id: data.parentId,
                name: data.name,
                color: "lilac",
                emoji: null,
              })
              .select("id")
              .single();
            if (error) throw error;
            return Response.json({ id: created.id });
          }

          if (data.action === "create_german_subject") {
            const { count } = await table("de_subjects")
              .select("id", { count: "exact", head: true })
              .eq("user_id", auth.userId);
            const { data: created, error } = await table("de_subjects")
              .insert({
                user_id: auth.userId,
                mode: "speaking",
                name: data.name,
                color: "#6aa9d8",
                position: count ?? 0,
                is_sample: false,
              })
              .select("id")
              .single();
            if (error) throw error;
            return Response.json({ id: created.id });
          }

          if (data.action === "create_german_subtopic") {
            const { data: parent } = await table("de_subjects")
              .select("id")
              .eq("id", data.subjectId)
              .eq("user_id", auth.userId)
              .eq("is_sample", false)
              .maybeSingle();
            if (!parent) return failure("That German subject is not yours.", 403);
            const { count } = await table("de_subtopics")
              .select("id", { count: "exact", head: true })
              .eq("subject_id", data.subjectId);
            const { data: created, error } = await table("de_subtopics")
              .insert({
                user_id: auth.userId,
                subject_id: data.subjectId,
                name: data.name,
                position: count ?? 0,
                is_sample: false,
              })
              .select("id")
              .single();
            if (error) throw error;
            return Response.json({ id: created.id });
          }

          const unique = Array.from(
            new Map(data.items.map((item) => [learningKey(item), item])).values(),
          ) as LearningItem[];
          if (data.target === "flashcards") {
            const { data: destination } = await table("flash_subjects")
              .select("id")
              .eq("id", data.destinationId)
              .eq("user_id", auth.userId)
              .maybeSingle();
            if (!destination) return failure("That flashcard subject is not yours.", 403);
            const fronts = unique.map((item) => flashcardFaces(item).front);
            const { data: existing, error: readError } = await table("flash_cards")
              .select("front")
              .eq("subject_id", data.destinationId)
              .eq("user_id", auth.userId)
              .in("front", fronts);
            if (readError) throw readError;
            const already = new Set(
              (existing ?? []).map((row: { front: string }) =>
                row.front.trim().toLocaleLowerCase(),
              ),
            );
            const rows = unique
              .map(flashcardFaces)
              .filter((card) => !already.has(card.front.trim().toLocaleLowerCase()))
              .map((card, index) => ({
                user_id: auth.userId,
                subject_id: data.destinationId,
                ...card,
                sort: index,
              }));
            if (rows.length) {
              const { error } = await table("flash_cards").insert(rows);
              if (error) throw error;
            }
            return Response.json({ saved: rows.length, skipped: unique.length - rows.length });
          }

          const { data: destination } = await table("de_subtopics")
            .select("id, subject_id")
            .eq("id", data.destinationId)
            .eq("user_id", auth.userId)
            .eq("is_sample", false)
            .maybeSingle();
          if (!destination) return failure("That German sub-subject is not yours.", 403);
          const { data: parent } = await table("de_subjects")
            .select("id")
            .eq("id", destination.subject_id)
            .eq("user_id", auth.userId)
            .eq("is_sample", false)
            .maybeSingle();
          if (!parent) return failure("That German subject is not yours.", 403);
          const germanItems = unique.filter(
            (item) => isGermanItem(item) && termWithoutArticle(item),
          );
          if (!germanItems.length)
            return failure("Choose German words or sentences for German Lab.", 400);
          const { data: existing, error: readError } = await table("de_items")
            .select("german, article")
            .eq("subtopic_id", data.destinationId)
            .eq("user_id", auth.userId)
            .in("german", germanItems.map(termWithoutArticle));
          if (readError) throw readError;
          const already = new Set(
            (existing ?? []).map(
              (row: { german: string; article: string | null }) =>
                `${row.article ?? ""}:${row.german.toLocaleLowerCase().trim()}`,
            ),
          );
          const { count } = await table("de_items")
            .select("id", { count: "exact", head: true })
            .eq("subtopic_id", data.destinationId);
          const rows = germanItems
            .filter(
              (item) =>
                !already.has(
                  `${item.article ?? ""}:${termWithoutArticle(item).toLocaleLowerCase()}`,
                ),
            )
            .map((item, index) => ({
              user_id: auth.userId,
              subtopic_id: data.destinationId,
              kind: item.article ? "noun" : item.kind,
              german: termWithoutArticle(item),
              english: item.meaning,
              article: item.article,
              plural: item.plural,
              position: (count ?? 0) + index,
              is_sample: false,
            }));
          if (rows.length) {
            const { error } = await table("de_items").insert(rows);
            if (error) throw error;
          }
          return Response.json({ saved: rows.length, skipped: germanItems.length - rows.length });
        } catch (error) {
          console.error("Rita learning save failed", error);
          return failure("Could not save those items. Please try again.", 503);
        }
      },
    },
  },
});
