/* eslint-disable @typescript-eslint/no-explicit-any -- Rita's new migration tables are not in the generated Supabase types until the production schema is regenerated. */
import { createFileRoute } from "@tanstack/react-router";
import {
  cleanLanguage,
  getRitaAllowance,
  getRitaPilotMode,
  getRitaSettings,
  normalizePersonality,
  requireRitaUser,
  resolveRitaDeepgramKey,
  resolveRitaOpenAiKey,
} from "@/lib/rita-voice.server";

export const Route = createFileRoute("/api/rita/session")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireRitaUser(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const settingsPromise = getRitaSettings();
        const [settings, allowance, pilotMode, openAiKey, deepgramKey] = await Promise.all([
          settingsPromise,
          settingsPromise.then((value) => getRitaAllowance(auth.userId, value)),
          getRitaPilotMode(auth.userId),
          resolveRitaOpenAiKey(),
          resolveRitaDeepgramKey(),
        ]);
        return Response.json(
          {
            configured: Boolean(openAiKey && (pilotMode === "legacy" || deepgramKey)),
            providers: { openai: Boolean(openAiKey), deepgram: Boolean(deepgramKey) },
            enabled: settings.enabled,
            pilotMode,
            voice: settings.voice,
            allowance,
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
      POST: async ({ request }) => {
        const auth = await requireRitaUser(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const action = String(body.action ?? "start");

        if (action === "end") {
          const sessionId = String(body.sessionId ?? "");
          if (/^[0-9a-f-]{36}$/i.test(sessionId)) {
            try {
              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
              await (supabaseAdmin.from as any)("rita_voice_sessions")
                .update({
                  ended_at: new Date().toISOString(),
                  last_active_at: new Date().toISOString(),
                })
                .eq("id", sessionId)
                .eq("user_id", auth.userId);
            } catch (error) {
              console.warn("Could not close Rita session", error);
            }
          }
          return Response.json({ ok: true });
        }

        const settingsPromise = getRitaSettings();
        const [settings, allowance, pilotMode, openAiKey, deepgramKey] = await Promise.all([
          settingsPromise,
          settingsPromise.then((value) => getRitaAllowance(auth.userId, value)),
          getRitaPilotMode(auth.userId),
          resolveRitaOpenAiKey(),
          resolveRitaDeepgramKey(),
        ]);

        if (!allowance.allowed) {
          const message =
            allowance.reason === "daily_guard"
              ? "Rita voice has reached today’s fair-use safety limit. Please continue by text or return tomorrow."
              : "Rita voice is temporarily unavailable.";
          return Response.json({ ok: false, allowance, message }, { status: 429 });
        }

        const personality = normalizePersonality(body.personality);
        const languagePreference = cleanLanguage(body.language);
        const clientLabel = String(body.clientLabel ?? "browser").slice(0, 120);
        let sessionId: string = crypto.randomUUID();
        let persisted = false;
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await (supabaseAdmin.from as any)("rita_voice_sessions")
            .insert({
              user_id: auth.userId,
              personality,
              language_preference: languagePreference,
              client_label: clientLabel,
            })
            .select("id")
            .single();
          if (!error && data?.id) {
            sessionId = String(data.id);
            persisted = true;
          }
        } catch (error) {
          console.warn("Rita session logging is not ready", error);
        }
        if (!openAiKey || (pilotMode === "economic_v2" && !deepgramKey))
          return Response.json(
            {
              ok: false,
              code: "rita_pipeline_not_configured",
              stage: !openAiKey ? "openai_auth" : "deepgram_auth",
              message: !openAiKey
                ? "Add an OpenAI key in Admin → AI keys."
                : !deepgramKey
                  ? "Add a Deepgram key in Admin → AI keys for Economic v2."
                  : "Add an OpenAI key in Admin → AI keys.",
            },
            { status: 503 },
          );
        if (!persisted)
          return Response.json(
            {
              ok: false,
              code: "session_storage_failed",
              message: "Rita session storage is not ready.",
            },
            { status: 503 },
          );
        return Response.json(
          {
            ok: true,
            sessionId,
            configured: true,
            providers: { openai: true, deepgram: Boolean(deepgramKey) },
            pilotMode,
            voice: settings.voice,
            allowance,
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
