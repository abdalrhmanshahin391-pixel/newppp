import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";
import { z } from "zod";

const Input = z.object({
  mode: z.enum(["extract", "generate"]),
  topic: z.string().max(160).default(""),
  text: z.string().max(160_000).default(""),
  images: z
    .array(z.object({ mime: z.string().max(40), base64: z.string().min(100) }))
    .max(8)
    .optional(),
  count: z.number().int().min(1).max(30).default(10),
  difficulty: z.enum(["easy", "medium", "hard", "mixed"]).default("mixed"),
  language: z.enum(["en", "ar"]).default("en"),
});

export const generateStudyQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const parsed = Input.parse(data);
    if (parsed.text.trim().length < 20 && !parsed.images?.length) {
      throw new Error("Add a photo, a PDF or some notes first.");
    }
    return parsed;
  })
  .handler(async ({ data, context }) => {
    const { resolveGeminiKey, friendlyAiError } = await import("@/lib/ai-keys.server");
    const { buildQuestionPrompt, callGeminiQuestions, resolveModelFor } = await import(
      "@/lib/question-generator.server"
    );
    const { assertQuota, bumpQuota, assertFeature } = await import("@/lib/quota.server");
    const userId = (context as any).userId as string;
    await assertFeature(userId, "feature_lecture_qgen");
    await assertQuota(userId, "ai_questions", data.count);

    const { key, model } = await resolveGeminiKey((context as any).supabase);

    const images = data.images ?? [];
    const notes = data.topic.trim()
      ? `Every question must belong to the topic "${data.topic.trim()}".`
      : undefined;
    const prompt = buildQuestionPrompt({
      mode: data.mode,
      text: data.text,
      notes,
      count: data.count,
      difficulty: data.difficulty,
      language: data.language,
      hasImages: images.length > 0,
    });

    try {
      const result = await callGeminiQuestions(
        key,
        resolveModelFor("gemini", model),
        prompt.system,
        prompt.user,
        images,
      );
      await bumpQuota(userId, "ai_questions", result.questions?.length || data.count);
      return { questions: result.questions, truncated: !!result.truncated };
    } catch (error) {
      throw new Error(friendlyAiError(error));

    }
  });
