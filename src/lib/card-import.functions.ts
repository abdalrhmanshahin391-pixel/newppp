import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";
import { z } from "zod";

export type DraftCard = { front: string; back: string };

export type ImportResult = { cards: DraftCard[]; note: string };

const STYLES = {
  qa: "a clear exam-style question on the front and the full answer on the back",
  term: "a single term, drug, structure or concept on the front and its definition on the back",
  cloze: "a sentence with the key phrase replaced by ____ on the front, and the missing phrase plus one line of context on the back",
} as const;

const Input = z.object({
  source: z.enum(["pdf", "text", "image"]),
  /** base64 without the data: prefix */
  pdfBase64: z.string().max(24_000_000).optional(),
  images: z.array(z.object({ mime: z.string().max(60), data: z.string().max(8_000_000) })).max(8).optional(),
  text: z.string().max(120_000).optional(),
  startPage: z.number().int().min(1).max(2000).optional(),
  endPage: z.number().int().min(1).max(2000).optional(),
  count: z.number().int().min(4).max(60).default(15),
  style: z.enum(["qa", "term", "cloze"]).default("qa"),
  language: z.string().max(30).default("same as the material"),
  topic: z.string().max(160).default(""),
});

function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced?.[1] ?? raw).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}

/**
 * Reads the material the student gave us and proposes flashcards. Nothing is
 * saved here — the drafts go back to the browser so they can be edited or
 * thrown away before they ever touch a deck.
 */
export const generateCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<ImportResult> => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;

    // Feature is admin-only until the site-wide switch is turned on.
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) {
      const { data: settings } = await (supabase.from as any)("site_settings")
        .select("feature_ai_cards_enabled")
        .eq("id", true)
        .maybeSingle();
      if (!settings?.feature_ai_cards_enabled) {
        throw new Error("This feature isn't available yet.");
      }
    }

    const { assertQuota, bumpQuota } = await import("@/lib/quota.server");
    await assertQuota(userId, "flashcards", data.count);

    const { getGeminiPool, callGeminiJSON } = await import("@/lib/gemini-pool");
    const pool = await getGeminiPool(supabase);

    const pageNote =
      data.source === "pdf" && data.startPage && data.endPage
        ? `Only use pages ${data.startPage} to ${data.endPage} of the document. Ignore every other page.`
        : "";

    const systemPrompt = `You turn study material into flashcards for a university student.

Return ONLY valid JSON in this exact shape:
{"cards":[{"front":"...","back":"..."}]}

Rules:
- Produce at most ${data.count} cards. Fewer is fine if the material is thin — never pad.
- Each card tests exactly ONE idea: ${STYLES[data.style]}.
- Front: max 140 characters. Back: max 320 characters, plain sentences, no markdown, no bullet symbols.
- Prefer facts that are actually examinable: mechanisms, values, causes, differences, classifications.
- Skip slide titles, page numbers, author names, headers, footers and course admin text.
- Never invent facts that are not in the material.
- Write in ${data.language}.
${data.topic ? `- The material belongs to the topic "${data.topic}"; keep the wording consistent with it.` : ""}
${pageNote}`;

    const userParts: any[] = [];
    if (data.source === "pdf") {
      if (!data.pdfBase64) throw new Error("No PDF was received.");
      userParts.push({ text: "Make flashcards from this document." });
      userParts.push({ inline_data: { mime_type: "application/pdf", data: data.pdfBase64 } });
    } else if (data.source === "image") {
      if (!data.images?.length) throw new Error("No images were received.");
      userParts.push({ text: "Make flashcards from these slides / notes photos." });
      for (const img of data.images) {
        userParts.push({ inline_data: { mime_type: img.mime, data: img.data } });
      }
    } else {
      if (!data.text || data.text.trim().length < 40) {
        throw new Error("Paste a bit more text — there is not enough to work with.");
      }
      userParts.push({ text: `Make flashcards from this text:\n\n${data.text}` });
    }

    const raw = await callGeminiJSON({
      pool,
      systemPrompt,
      userParts,
      timeoutMs: 120_000,
      generationConfig: { temperature: 0.2, maxOutputTokens: 16384 },
    });

    let parsed: { cards?: DraftCard[] } = {};
    try {
      parsed = JSON.parse(extractJson(raw));
    } catch {
      throw new Error("The material came back unreadable. Try a smaller page range.");
    }

    const cards = (parsed.cards ?? [])
      .map((c) => ({
        front: String(c?.front ?? "").trim().slice(0, 200),
        back: String(c?.back ?? "").trim().slice(0, 500),
      }))
      .filter((c) => c.front.length > 1 && c.back.length > 1)
      .slice(0, data.count);

    if (cards.length === 0) throw new Error("Nothing useful could be pulled out of that material.");

    await bumpQuota(userId, "flashcards", cards.length);

    return {
      cards,
      note: `${cards.length} draft card${cards.length === 1 ? "" : "s"} ready to review.`,
    };
  });
