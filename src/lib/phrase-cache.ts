// Browser-side memory for the "tap a word" window, so a phrase is fetched once
// per device: explanations live in localStorage, audio in Cache Storage, and
// both are also kept in memory for the current page.
import {
  PRONOUNCE_STYLES,
  normalizePhrase,
  type PhraseExplanation,
  type PronounceStyle,
} from "./rita-phrase.ts";

const EXPLAIN_PREFIX = "rita.phrase.v1:";
const INDEX_KEY = "rita.phrase.v1:index";
const MAX_ENTRIES = 300;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function readIndex(storage: StorageLike): string[] {
  try {
    const parsed = JSON.parse(storage.getItem(INDEX_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

/** Context keeps a word's different senses apart; existing context-free entries still work. */
export function explanationKey(phrase: string, context = ""): string {
  const term = normalizePhrase(phrase);
  if (!term) return "";
  const sentence = context.normalize("NFC").replace(/\s+/g, " ").trim().slice(0, 2400);
  return sentence ? JSON.stringify([term, sentence]) : term;
}

export function readExplanation(
  phrase: string,
  storage: StorageLike,
  context = "",
): PhraseExplanation | null {
  const key = explanationKey(phrase, context);
  if (!key) return null;
  try {
    const raw = storage.getItem(EXPLAIN_PREFIX + key);
    if (!raw) return null;
    const value = JSON.parse(raw) as PhraseExplanation;
    return value && typeof value.translation_ar === "string" && value.translation_ar ? value : null;
  } catch {
    return null;
  }
}

/** Stores an explanation; the oldest entries are dropped past the cap. */
export function writeExplanation(
  phrase: string,
  value: PhraseExplanation,
  storage: StorageLike,
  maxEntries = MAX_ENTRIES,
  context = "",
) {
  const key = explanationKey(phrase, context);
  if (!key) return;
  try {
    storage.setItem(EXPLAIN_PREFIX + key, JSON.stringify(value));
    const index = readIndex(storage).filter((item) => item !== key);
    index.push(key);
    while (index.length > maxEntries) {
      const oldest = index.shift();
      if (oldest) storage.removeItem(EXPLAIN_PREFIX + oldest);
    }
    storage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    /* storage full or blocked: the memory copy still works for this page */
  }
}

const memoryExplanations = new Map<string, PhraseExplanation>();

export function cachedExplanation(phrase: string, context = ""): PhraseExplanation | null {
  const key = explanationKey(phrase, context);
  const inMemory = memoryExplanations.get(key);
  if (inMemory) return inMemory;
  if (typeof window === "undefined") return null;
  let stored: PhraseExplanation | null = null;
  try {
    stored = readExplanation(phrase, window.localStorage, context);
  } catch {
    /* Safari can block access to localStorage itself. */
  }
  if (stored) memoryExplanations.set(key, stored);
  return stored;
}

export function rememberExplanation(phrase: string, value: PhraseExplanation, context = "") {
  memoryExplanations.set(explanationKey(phrase, context), value);
  if (typeof window !== "undefined") {
    try {
      writeExplanation(phrase, value, window.localStorage, MAX_ENTRIES, context);
    } catch {
      /* Memory remains available when storage is blocked. */
    }
  }
}

// ---------- audio ----------

const AUDIO_CACHE = "rita-phrase-audio-v1";
const audioUrls = new Map<string, string>();
const inFlight = new Map<string, Promise<string | null>>();

function audioKey(lang: string, style: PronounceStyle, phrase: string) {
  return `${lang}/${style}/${normalizePhrase(phrase)}`;
}

async function cacheRequest(key: string) {
  return new Request(`/__rita-phrase-audio/${encodeURIComponent(key)}`);
}

/**
 * A playable URL for one phrase in one style, fetched at most once per device.
 * Null when the voice is unavailable (signed out, error): audio is a bonus.
 */
export async function getPhraseAudio(
  phrase: string,
  lang: "de" | "en",
  style: PronounceStyle,
  fetchAudio: () => Promise<Blob | null>,
): Promise<string | null> {
  const key = audioKey(lang, style, phrase);
  const known = audioUrls.get(key);
  if (known) return known;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const job = (async () => {
    try {
      let blob: Blob | null = null;
      let store: Cache | null = null;
      try {
        if (typeof caches !== "undefined") {
          store = await caches.open(AUDIO_CACHE);
          const hit = await store.match(await cacheRequest(key));
          if (hit) blob = await hit.blob();
        }
      } catch {
        /* Private browsing can block Cache Storage. Audio must still work. */
      }
      if (!blob) {
        blob = await fetchAudio();
        if (blob && store) {
          try {
            await store.put(
              await cacheRequest(key),
              new Response(blob, {
                headers: { "Content-Type": blob.type || "audio/mpeg" },
              }),
            );
          } catch {
            /* Caching is optional; the fetched clip is still playable. */
          }
        }
      }
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      audioUrls.set(key, url);
      return url;
    } catch {
      return null;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, job);
  return job;
}

export const ALL_STYLES = PRONOUNCE_STYLES;

// ---------- playback: one voice at a time ----------

let current: HTMLAudioElement | null = null;

export function stopPhraseAudio() {
  if (current) {
    current.pause();
    current.currentTime = 0;
    current = null;
  }
}

/** Plays a URL, replacing anything already playing; resolves when it ends or fails. */
export function playPhraseUrl(url: string): Promise<boolean> {
  stopPhraseAudio();
  return new Promise((resolve) => {
    const audio = new Audio(url);
    current = audio;
    const done = (ok: boolean) => {
      if (current === audio) current = null;
      resolve(ok);
    };
    audio.onended = () => done(true);
    audio.onerror = () => done(false);
    audio.onpause = () => done(false);
    audio.play().catch(() => done(false));
  });
}
