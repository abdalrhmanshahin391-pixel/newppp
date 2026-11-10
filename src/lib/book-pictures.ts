// The reader's page pictures in the browser.
//
// - A picture fetched ahead only goes into the device's page cache; the pages right beside the
//   one being read are also decoded, so turning to them shows them at once. At most 3 decoded
//   pages are kept (5 on a desktop) — one 1400 px page is about 11 MB once decoded, and Safari on
//   an iPad closes a tab that uses too much. No canvas is ever made here.
// - The page cache (Cache Storage, "uzyra-pages-v1") is keyed by the picture's path, not by its
//   signed link, so a page read yesterday opens at once today even though its link is new. It
//   keeps the last 300 pages (~25 MB) and is emptied on sign-out. Where it cannot be used (no
//   Cache Storage, or the storage server refuses CORS) pictures load straight from their links.

const CACHE = "uzyra-pages-v1";
const CACHE_PAGES = 300;

type Entry = {
  /** What an <img> shows: a blob: address from the page cache, or the signed link. */
  src: string;
  ready: Promise<string>;
  decoded: boolean;
  done: boolean;
  img?: HTMLImageElement;
};

const fetched = new Map<string, Entry>();
const decoded = new Map<string, Entry>();
const blobUrls = new Map<string, string>();
const caching = new Map<string, Promise<Response | null>>();
let lastMs: number | null = null;

function decodedLimit(): number {
  if (typeof window === "undefined") return 3;
  return window.matchMedia?.("(min-width: 1200px) and (pointer: fine)").matches ? 5 : 3;
}

function cacheKey(path: string): string {
  return `/__book-pages/${path}`;
}

let cacheBroken = typeof caches === "undefined";

async function trim(cache: Cache) {
  const keys = await cache.keys();
  // Keys come back oldest first.
  for (const key of keys.slice(0, Math.max(0, keys.length - CACHE_PAGES))) await cache.delete(key);
}

/** The picture from the page cache, fetching and storing it first when it is not there. */
function cachedResponse(
  path: string,
  url: string,
  priority: "high" | "low" = "low",
): Promise<Response | null> {
  if (cacheBroken) return Promise.resolve(null);
  const running = caching.get(path);
  if (running) return running.then((res) => res?.clone() ?? null);
  const job = (async () => {
    try {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(cacheKey(path));
      if (hit) return hit;
      const started = performance.now();
      const res = await fetch(url, {
        mode: "cors",
        credentials: "omit",
        // The page on screen goes before the ones fetched ahead (where the browser supports it).
        priority,
      } as RequestInit & { priority: "high" | "low" });
      if (!res.ok) return null;
      lastMs = performance.now() - started;
      await cache.put(cacheKey(path), res.clone());
      void trim(cache);
      return res;
    } catch {
      // No Cache Storage here, or the server refuses CORS: use the links straight away.
      cacheBroken = true;
      return null;
    }
  })();
  caching.set(path, job);
  void job.finally(() => caching.delete(path));
  return job.then((res) => res?.clone() ?? null);
}

async function blobSrc(path: string, url: string, priority: "high" | "low"): Promise<string> {
  const have = blobUrls.get(path);
  if (have) return have;
  const res = await cachedResponse(path, url, priority);
  if (!res) return url;
  const src = URL.createObjectURL(await res.blob());
  blobUrls.set(path, src);
  return src;
}

function release(path: string) {
  const src = blobUrls.get(path);
  if (!src || decoded.has(path) || fetched.has(path)) return;
  blobUrls.delete(path);
  // Later, so a picture still on screen is not cut off.
  window.setTimeout(() => URL.revokeObjectURL(src), 30_000);
}

function keepDecoded(path: string, entry: Entry) {
  decoded.delete(path);
  decoded.set(path, entry);
  while (decoded.size > decodedLimit()) {
    const oldest = decoded.keys().next().value as string;
    decoded.delete(oldest);
    release(oldest);
  }
}

/** The address to show at once when the picture is already decoded, else null. */
export function readyPicture(path: string): string | null {
  const entry = decoded.get(path);
  return entry?.decoded ? entry.src : null;
}

/**
 * Fetches (from the page cache when it is there) and decodes a picture: the page shown, or the
 * ones right beside it. Resolves with the address to show.
 */
export function decodePicture(
  path: string,
  url: string,
  priority: "high" | "low" = "high",
): Promise<string> {
  const have = decoded.get(path);
  if (have) {
    keepDecoded(path, have);
    return have.ready;
  }
  fetched.delete(path);
  const entry: Entry = { src: url, ready: Promise.resolve(url), decoded: false, done: false };
  entry.ready = (async () => {
    const started = performance.now();
    const src = await blobSrc(path, url, priority);
    const img = new Image();
    img.decoding = "async";
    (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = priority;
    entry.img = img;
    img.src = src;
    try {
      await img.decode();
    } catch {
      // decode() can refuse a picture that still shows; a real failure fails the load.
      await new Promise<void>((resolve, reject) => {
        if (img.complete && img.naturalWidth) return resolve();
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("picture"));
      });
    }
    if (src === url) lastMs = performance.now() - started;
    entry.src = src;
    entry.decoded = true;
    entry.done = true;
    return src;
  })();
  keepDecoded(path, entry);
  entry.ready.catch(() => {
    decoded.delete(path);
    release(path);
  });
  return entry.ready;
}

/** Fetches a picture into the page cache only (a page a few turns ahead). */
export function fetchPicture(path: string, url: string) {
  if (decoded.has(path) || fetched.has(path)) return;
  const entry: Entry = { src: url, ready: Promise.resolve(url), decoded: false, done: false };
  fetched.set(path, entry);
  const finish = () => {
    entry.done = true;
    fetched.delete(path);
  };
  if (!cacheBroken) {
    entry.ready = cachedResponse(path, url).then((res) => {
      if (res) return url;
      // The cache cannot be used: let the browser's own cache hold it.
      return loadPlain(entry, url);
    });
  } else entry.ready = loadPlain(entry, url);
  entry.ready.then(finish, finish);
}

function loadPlain(entry: Entry, url: string): Promise<string> {
  const img = new Image();
  img.decoding = "async";
  (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = "low";
  entry.img = img;
  const started = performance.now();
  return new Promise((resolve, reject) => {
    img.onload = () => {
      lastMs = performance.now() - started;
      resolve(url);
    };
    img.onerror = () => reject(new Error("picture"));
    img.src = url;
  });
}

/** Stops fetching pictures that are no longer wanted (the reader flipped past them). */
export function dropPicturesExcept(keep: Set<string>) {
  for (const [path, entry] of fetched) {
    if (keep.has(path) || entry.done) continue;
    if (entry.img) entry.img.src = "";
    fetched.delete(path);
  }
}

/** How long the last picture took to arrive (for "is the connection slow"), or null. */
export function lastPictureMs(): number | null {
  return lastMs;
}

/** Empties the page cache and forgets every picture (signing out). */
export async function forgetPictures() {
  decoded.clear();
  fetched.clear();
  for (const src of blobUrls.values()) URL.revokeObjectURL(src);
  blobUrls.clear();
  try {
    if (typeof caches !== "undefined") await caches.delete(CACHE);
  } catch {
    /* nothing stored */
  }
}
