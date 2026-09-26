/* eslint-disable @typescript-eslint/no-explicit-any -- admin_ai_keys is not in generated types. */
// Fish Audio free-tier speech (model s2.1-pro-free). Server-only.

export type FishVoice = {
  id: string;
  title: string;
  author: string;
  uses: number;
  sampleUrl: string | null;
  official: boolean;
};

export const RITA_ARABIC_FISH_VOICE_ID = "5814f46c02f5486d9c72b31bd82217ba"; // Layan — Fish Official
export const RITA_GERMAN_FISH_VOICE_ID = "3235abc9a84b407d92f73539a5651720"; // Emma — Fish Official

let keyCache: { at: number; value: Promise<string | null> } | null = null;
export function resolveFishKey(): Promise<string | null> {
  if (keyCache && Date.now() - keyCache.at < 60_000) return keyCache.value;
  const value = (async () => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      for (const purpose of ["rita", "shared"]) {
        const { data } = await (supabaseAdmin.from as any)("admin_ai_keys")
          .select("api_key")
          .eq("provider", "fish")
          .eq("purpose", purpose)
          .eq("slot", 1)
          .maybeSingle();
        const saved = String(data?.api_key ?? "").trim();
        if (saved.length > 10) return saved;
      }
    } catch {
      /* fall through to the environment key */
    }
    const env = (process.env["FISH_AUDIO_API_KEY"] ?? "").trim();
    return env.length > 10 ? env : null;
  })();
  keyCache = { at: Date.now(), value };
  return value;
}

let voiceCache: { at: number; value: FishVoice[] } | null = null;
export async function listFishArabicVoices(): Promise<{ voices: FishVoice[]; configured: boolean }> {
  const key = await resolveFishKey();
  if (!key) return { voices: [], configured: false };
  if (voiceCache && Date.now() - voiceCache.at < 600_000)
    return { voices: voiceCache.value, configured: true };
  const fetchList = async (url: string) => {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    if (!response.ok) throw new Error(`Fish Audio voice list failed (${response.status})`);
    return ((await response.json()) as { items?: any[] }).items ?? [];
  };
  // 1) Verified official Arabic "Default Voices" (author "Fish Official") — pinned by ID because
  //    Fish search is fuzzy and rarely surfaces them. Fetched fresh by ID for live metadata.
  //    2) Dynamic name searches for the remaining official voices. 3) Saudi/Gulf community voices.
  const OFFICIAL_VOICE_IDS = [
    "0b14f34a13a94ed88fe6113193749bb0", // فاطمة — Fish Official (الأكثر استخداماً)
    "eec5913dac6b4bdc9920f136e4e5ed78", // فهد Fahad — Fish Official
    "5814f46c02f5486d9c72b31bd82217ba", // ليان Layan — Fish Official
  ];
  const OFFICIAL_NAME_SEARCHES = ["نورة", "Noura", "Omar", "Youssef", "Farida", "Salma", "Amine", "Karim"];
  const fetchById = async (id: string) => {
    const response = await fetch(`https://api.fish.audio/model/${id}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!response.ok) return [];
    const item = (await response.json()) as any;
    return item?._id ? [item] : [];
  };
  const lists = await Promise.all([
    ...OFFICIAL_VOICE_IDS.map(fetchById),
    ...OFFICIAL_NAME_SEARCHES.map((term) =>
      fetchList(
        `https://api.fish.audio/model?page_size=10&sort_by=task_count&title=${encodeURIComponent(term)}`,
      ),
    ),
    ...["سعودي", "saudi", "خليجي"].map((term) =>
      fetchList(
        `https://api.fish.audio/model?page_size=20&sort_by=task_count&title=${encodeURIComponent(term)}`,
      ),
    ),
  ]);
  const seen = new Set<string>();
  const items = lists.flat().filter((item) => item?._id && !seen.has(item._id) && seen.add(item._id));
  const isOfficial = (item: any) =>
    item?.author?.nickname === "Fish Audio" ||
    item?.author?.nickname === "Fish Official" ||
    item?.tags?.includes?.("official") === true;
  const voices: FishVoice[] = items
    .filter((item) => item?._id && item?.state !== "failed")
    // Fuzzy name searches return unrelated global voices; keep only official or Arabic ones.
    .filter(
      (item) =>
        isOfficial(item) ||
        item?.languages?.includes?.("ar") === true ||
        /[؀-ۿ]/.test(String(item?.title ?? "")),
    )
    .map((item) => ({
      id: String(item._id),
      title: String(item.title ?? "Voice"),
      author: String(item.author?.nickname ?? ""),
      uses: Number(item.task_count ?? 0),
      sampleUrl: item.samples?.[0]?.audio ? String(item.samples[0].audio) : null,
      official: isOfficial(item),
    }))
    // Official voices first (by popularity), then Saudi/Gulf community voices, then the rest.
    .sort((a, b) => {
      const rank = (v: FishVoice) =>
        v.official ? 2 : /saudi|سعود|خليج|gulf|najd|نجد/i.test(v.title) ? 1 : 0;
      return rank(b) - rank(a) || b.uses - a.uses;
    });
  voiceCache = { at: Date.now(), value: voices };
  return { voices, configured: true };
}

/** Starts a Fish stream; resolves only once first audio bytes arrive (or throws). */
export async function fishSpeech(args: {
  key: string;
  voiceId: string;
  text: string;
  signal: AbortSignal;
  firstAudioTimeoutMs: number;
  speed?: number;
}): Promise<ReadableStream<Uint8Array>> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  args.signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, args.firstAudioTimeoutMs);
  try {
    const upstream = await fetch("https://api.fish.audio/v1/tts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.key}`,
        "Content-Type": "application/json",
        model: "s2.1-pro-free",
      },
      body: JSON.stringify({
        text: args.text,
        reference_id: args.voiceId,
        format: "pcm",
        sample_rate: 24000,
        latency: "balanced",
        normalize: true,
        prosody: { speed: Math.min(1.2, Math.max(0.65, args.speed ?? 1)) },
      }),
      signal: controller.signal,
    });
    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      throw new Error(`fish ${upstream.status} ${detail.slice(0, 160)}`);
    }
    const reader = upstream.body.getReader();
    const first = await reader.read();
    clearTimeout(timer);
    if (first.done || !first.value?.byteLength) throw new Error("fish empty audio");
    return new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(first.value);
      },
      async pull(c) {
        const next = await reader.read();
        if (next.done) c.close();
        else c.enqueue(next.value);
      },
      cancel() {
        controller.abort();
      },
    });
  } catch (error) {
    clearTimeout(timer);
    controller.abort();
    throw error;
  }
}
