// Compatibility client for pages written against the previous backend schema.
// It is the same runtime client, just without generated table typings, so the
// legacy pages keep compiling while the new database schema grows.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase as typedSupabase } from "./client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = typedSupabase as unknown as SupabaseClient<any, "public", any>;
