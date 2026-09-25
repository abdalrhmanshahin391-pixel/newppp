import { supabase } from "@/integrations/supabase/client";

/**
 * Headers for the German voice endpoint. It only serves signed-in users, so we
 * attach the current session token; without one the caller should fall back to
 * the built-in browser voice.
 */
export async function ttsHeaders(): Promise<Record<string, string> | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}
