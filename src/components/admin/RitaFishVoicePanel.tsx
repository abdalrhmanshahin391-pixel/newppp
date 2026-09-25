import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getRitaVoiceAdmin, listRitaFishVoices, saveRitaVoiceSettings } from "@/lib/rita-live.functions";

type Voice = { id: string; title: string; author: string; uses: number; sampleUrl: string | null; official: boolean };

export function RitaFishVoicePanel() {
  const getAdmin = useServerFn(getRitaVoiceAdmin);
  const listVoices = useServerFn(listRitaFishVoices);
  const save = useServerFn(saveRitaVoiceSettings);
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof getRitaVoiceAdmin>>["settings"] | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    void getAdmin().then((r) => setSettings(r.settings)).catch(() => undefined);
  }, [getAdmin]);

  async function loadVoices() {
    setLoading(true);
    try {
      const r = await listVoices();
      setConfigured(r.configured);
      setVoices(r.voices);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load Fish voices");
    } finally {
      setLoading(false);
    }
  }

  async function persist(patch: Partial<NonNullable<typeof settings>>) {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setBusy(true);
    try {
      await save({ data: next as never });
      setSettings(next);
      toast.success("Rita voice saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  function play(url: string) {
    audio.current?.pause();
    audio.current = new Audio(url);
    void audio.current.play();
  }

  if (!settings) return null;
  return (
    <section className="mb-5 rounded-3xl border-2 border-border bg-card p-6 text-card-foreground">
      <h2 className="text-lg font-black">Rita voice engine</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Fish Audio (free) sounds more natural in Arabic. If it fails or takes over 2.5 s, that sentence uses OpenAI automatically.
      </p>
      <div className="mt-3 flex gap-2">
        {(["openai", "fish"] as const).map((engine) => (
          <button
            key={engine}
            disabled={busy}
            onClick={() => persist({ voiceEngine: engine })}
            className={`rounded-xl border-2 px-4 py-2 text-sm font-black ${settings.voiceEngine === engine ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
          >
            {engine === "openai" ? "OpenAI voice" : "Fish Audio (free)"}
          </button>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button onClick={loadVoices} disabled={loading} className="rounded-xl border-2 border-border px-3 py-2 text-xs font-black">
          {loading ? "Loading…" : "Show Arabic / Saudi voices"}
        </button>
        <span className="text-xs text-muted-foreground">
          Chosen: {settings.fishVoiceId ?? "none (Fish will fall back to OpenAI)"}
        </span>
      </div>
      {!configured && (
        <p className="mt-2 text-xs font-bold text-destructive">Fish Audio key is missing. Add FISH_AUDIO_API_KEY first.</p>
      )}
      {voices.length > 0 && (
        <ul className="mt-3 max-h-96 space-y-2 overflow-auto">
          {voices.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-2 rounded-xl border border-border p-2 text-sm">
              <div className="min-w-0">
                <div className="truncate font-bold">{v.title} {v.official && <span className="text-xs text-primary">(official)</span>}</div>
                <div className="text-xs text-muted-foreground">by {v.author || "community"} · {v.uses.toLocaleString()} uses</div>
              </div>
              <div className="flex shrink-0 gap-2">
                {v.sampleUrl && (
                  <button onClick={() => play(v.sampleUrl!)} className="rounded-lg border border-border px-2 py-1 text-xs font-bold">▶ Play</button>
                )}
                <button
                  disabled={busy}
                  onClick={() => persist({ fishVoiceId: v.id })}
                  className={`rounded-lg px-2 py-1 text-xs font-bold ${settings.fishVoiceId === v.id ? "bg-primary text-primary-foreground" : "border border-border"}`}
                >
                  {settings.fishVoiceId === v.id ? "Selected" : "Choose"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
