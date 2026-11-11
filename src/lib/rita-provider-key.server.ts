import { getServerRuntimeSecret } from "./config.server.ts";

type KeySources = {
  canReadSavedKey: () => boolean;
  readSavedKey: (provider: string) => Promise<string | null>;
  readRuntimeSecret: (name: string) => Promise<string>;
  warn: (message: string) => void;
};

const defaultSources: KeySources = {
  // This is the credential the existing admin client actually uses. Without it, do not load
  // that client or attempt a privileged query on the published site's request path.
  canReadSavedKey: () => Boolean(process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim()),
  async readSavedKey(provider) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("admin_ai_keys")
      .select("api_key")
      .eq("provider", provider)
      .eq("purpose", "rita")
      .eq("slot", 1)
      .maybeSingle();
    if (error) throw error;
    return data?.api_key ?? null;
  },
  readRuntimeSecret: getServerRuntimeSecret,
  warn: (message) => console.warn(message),
};

/** Saved admin keys retain priority where available; Workers secrets are read per request. */
export async function resolveRitaV3Key(
  provider: string,
  environmentName: string,
  sources: KeySources = defaultSources,
): Promise<string> {
  if (sources.canReadSavedKey()) {
    try {
      const saved = (await sources.readSavedKey(provider))?.trim();
      if (saved) return saved;
    } catch {
      // Do not log provider credentials or a raw database error that may contain a payload.
      sources.warn(`Could not read Rita v3 ${provider} key; checking runtime secrets.`);
    }
  }
  return (await sources.readRuntimeSecret(environmentName)).trim();
}
