const EXPECTED_PROJECT_ID = "aeawoexywnyankbeqkmz";
// Lovable Cloud now serves the same project from its own address (set by Lovable on 26 Nov 2026).
// Both addresses reach the one backend, so both are accepted; anything else is still refused.
const EXPECTED_HOSTS = new Set([
  `${EXPECTED_PROJECT_ID}.supabase.co`,
  "c--bd068ec8-7921-456a-a2a6-a0f40ea0be07-prod.lovable.cloud",
]);

export type SupabasePublicConfig = {
  projectId: string;
  url: string;
  publishableKey: string;
};

/**
 * Public Lovable Cloud settings shared by browser and SSR bundles. Keeping one
 * source prevents the app from silently connecting to two database projects.
 */
export function getSupabasePublicConfig(): SupabasePublicConfig {
  const projectId = String(import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "").trim();
  const url = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim();
  const publishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "").trim();
  const missing = [
    !projectId && "VITE_SUPABASE_PROJECT_ID",
    !url && "VITE_SUPABASE_URL",
    !publishableKey && "VITE_SUPABASE_PUBLISHABLE_KEY",
  ].filter(Boolean);

  if (missing.length) {
    throw new Error(`Missing Lovable Cloud configuration: ${missing.join(", ")}.`);
  }

  let hostname = "";
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error("VITE_SUPABASE_URL is not a valid URL.");
  }
  if (projectId !== EXPECTED_PROJECT_ID || !EXPECTED_HOSTS.has(hostname)) {
    throw new Error("Lovable Cloud project mismatch. Uzyra must use one backend only.");
  }

  return { projectId, url, publishableKey };
}

export const LOVABLE_CLOUD_PROJECT_ID = EXPECTED_PROJECT_ID;
