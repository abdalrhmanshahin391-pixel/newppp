import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";
import { z } from "zod";

export type CardFlag = {
  card_id: string;
  subject: string;
  sub_subject: string;
  note: string;
  created_at: string;
};

/** Every card the student has raised a red flag on. */
export const listFlags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CardFlag[]> => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;
    const { data, error } = await supabase
      .from("card_flags")
      .select("card_id, subject, sub_subject, note, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as CardFlag[];
  });

/** Raise or clear the flag on one card, optionally with a short note. */
export const setFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        cardId: z.string().min(1).max(120),
        subject: z.string().max(120).default(""),
        sub: z.string().max(120).default(""),
        note: z.string().max(280).default(""),
        on: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = (context as any).supabase;
    const userId = (context as any).userId as string;

    if (!data.on) {
      const { error } = await supabase
        .from("card_flags")
        .delete()
        .eq("user_id", userId)
        .eq("card_id", data.cardId);
      if (error) throw new Error(error.message);
      return { flagged: false };
    }

    const { error } = await supabase.from("card_flags").upsert(
      {
        user_id: userId,
        card_id: data.cardId,
        subject: data.subject,
        sub_subject: data.sub,
        note: data.note,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,card_id" },
    );
    if (error) throw new Error(error.message);
    return { flagged: true };
  });
