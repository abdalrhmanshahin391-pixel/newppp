const EXPECTED_PROJECT_ID = "aeawoexywnyankbeqkmz";

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
  if (projectId !== EXPECTED_PROJECT_ID || hostname !== `${projectId}.supabase.co`) {
    throw new Error("Lovable Cloud project mismatch. RitaJet must use one backend only.");
  }

  return { projectId, url, publishableKey };
}

export const LOVABLE_CLOUD_PROJECT_ID = EXPECTED_PROJECT_ID;
