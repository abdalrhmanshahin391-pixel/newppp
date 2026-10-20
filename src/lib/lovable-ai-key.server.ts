import { getServerRuntimeSecret } from "@/lib/config.server";

/**
 * The Lovable AI gateway key. Read through the runtime helper (process.env and the Cloudflare
 * bindings): on the production Workers host a secret is not always mirrored into process.env.
 */
export async function lovableAiKey(): Promise<string> {
  return (await getServerRuntimeSecret("LOVABLE_API_KEY")).trim();
}
