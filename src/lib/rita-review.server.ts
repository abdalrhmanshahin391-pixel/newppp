/**
 * The review engine on the app's server (the admin's "review now" steps and the replay judges).
 * The engine itself is rita-review.core.ts, shared with the rita-review Edge Function; here it gets
 * the site's OpenAI key and the optional model override.
 */
import { getServerRuntimeSecret } from "@/lib/config.server";
import { resolveRitaOpenAiKey } from "@/lib/rita-voice.server";
import { setReviewDeps } from "@/lib/rita-review.core";

setReviewDeps({
  openAiKey: async () => {
    const fromEnv = await getServerRuntimeSecret("OPENAI_API_KEY");
    if (fromEnv.length > 20) return fromEnv;
    return resolveRitaOpenAiKey();
  },
  modelOverride: () => getServerRuntimeSecret("RITA_REVIEW_MODEL"),
});

export * from "@/lib/rita-review.core";
