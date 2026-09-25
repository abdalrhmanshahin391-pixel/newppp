// Compatibility service-role client for server code written against the
// previous backend schema. Same runtime client, no generated table typings.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin as typedAdmin } from "./client.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabaseAdmin = typedAdmin as unknown as SupabaseClient<any, "public", any>;
