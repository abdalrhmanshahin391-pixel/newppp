// The reader's page pictures in the browser. A picture fetched ahead only fills the HTTP cache;
// the pages right beside the one being read are also decoded, so turning to them shows them at
// once. At most 3 decoded pages are kept (5 on a desktop) — one 1400 px page is about 11 MB once
// decoded, and Safari on an iPad closes a tab that uses too much. No canvas is ever made here.

type Entry = {
  img: HTMLImageElement;
  /** Resolves once the picture can be shown at once (fetched and decoded). */
  ready: Promise<void>;
  decoded: boolean;
  done: boolean;
};

const fetched = new Map<string, Entry>();
const decoded = new Map<string, Entry>();
let lastMs: number | null = null;

function decodedLimit(): number {
  if (typeof window === "undefined") return 3;
  return window.matchMedia?.("(min-width: 1200px) and (pointer: fine)").matches ? 5 : 3;
}

function load(url: string, priority: "high" | "low"): Entry {
  const img = new Image();
  img.decoding = "async";
  (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = priority;
  const started = performance.now();
  const entry: Entry = { img, ready: Promise.resolve(), decoded: false, done: false };
  entry.ready = new Promise<void>((resolve, reject) => {
    img.onload = () => {
      entry.done = true;
      lastMs = performance.now() - started;
      resolve();
    };
    img.onerror = () => {
      entry.done = true;
      reject(new Error("picture"));
    };
  });
  img.src = url;
  return entry;
}

function keepDecoded(url: string, entry: Entry) {
  decoded.delete(url);
  decoded.set(url, entry);
  while (decoded.size > decodedLimit()) {
    const oldest = decoded.keys().next().value as string;
    decoded.delete(oldest);
  }
}

/** True when the picture can be shown at once (already decoded in memory). */
export function isPictureReady(url: string): boolean {
  return Boolean(decoded.get(url)?.decoded);
}

/** Fetches and decodes a picture (the page shown, or the ones right beside it). */
export function decodePicture(url: string, priority: "high" | "low" = "high"): Promise<void> {
  const have = decoded.get(url);
  if (have) {
    keepDecoded(url, have);
    return have.ready;
  }
  const entry = fetched.get(url) ?? load(url, priority);
  fetched.delete(url);
  entry.ready = entry.ready.then(async () => {
    try {
      await entry.img.decode();
    } catch {
      /* some browsers refuse decode() on a loaded picture; it still shows */
    }
    entry.decoded = true;
  });
  keepDecoded(url, entry);
  entry.ready.catch(() => decoded.delete(url));
  return entry.ready;
}

/** Fetches a picture into the browser's cache only (a page a few turns ahead). */
export function fetchPicture(url: string) {
  if (decoded.has(url) || fetched.has(url)) return;
  const entry = load(url, "low");
  fetched.set(url, entry);
  entry.ready.then(
    () => fetched.delete(url),
    () => fetched.delete(url),
  );
}

/** Stops fetching pictures that are no longer wanted (the reader flipped past them). */
export function dropPicturesExcept(keep: Set<string>) {
  for (const [url, entry] of fetched) {
    if (keep.has(url) || entry.done) continue;
    entry.img.src = "";
    fetched.delete(url);
  }
}

/** How long the last picture took to arrive (for "is the connection slow"), or null. */
export function lastPictureMs(): number | null {
  return lastMs;
}
