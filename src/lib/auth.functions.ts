import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const identitySchema = z.object({
  username: z.string().trim().min(3).max(30),
  phone: z.string().trim().max(20),
  excludeUserId: z.string().trim().optional().or(z.literal("")),
});

/** Checks public registration identifiers without exposing profile rows. */
export const checkIdentityAvailability = createServerFn({ method: "POST" })
  .inputValidator((data) => identitySchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const normalizedUsername = data.username.toLowerCase();

    let usernameQuery = supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .ilike("username", normalizedUsername);
    let phoneQuery = data.phone
      ? supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("phone", data.phone)
      : Promise.resolve({ count: 0, error: null });

    if (data.excludeUserId) {
      usernameQuery = usernameQuery.neq("id", data.excludeUserId);
      if (data.phone) {
        phoneQuery = supabaseAdmin
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("phone", data.phone)
          .neq("id", data.excludeUserId);
      }
    }

    const [usernameResult, phoneResult] = await Promise.all([usernameQuery, phoneQuery]);
    if (usernameResult.error) throw new Error("Could not check that username. Please try again.");
    if (phoneResult.error) throw new Error("Could not check that phone number. Please try again.");

    return {
      username: (usernameResult.count ?? 0) > 0,
      phone: (phoneResult.count ?? 0) > 0,
    };
  });