/**
 * Keeps every study-kit value that used to live only on the device in the
 * account's cloud store, so the same kit follows the student everywhere.
 *
 * Design note: the study hooks all read/write `window.localStorage` with
 * `rita_*` keys. Instead of rewriting each of them, we mirror those keys:
 *   - on sign-in we pull the account's saved values into localStorage
 *   - every later write is pushed back (debounced) to `study_state`
 *   - on sign-out the local copy is cleared so nothing leaks between accounts
 */
import { supabase } from "@/integrations/supabase/legacy-client";

const PREFIX = "rita_";
const LOCAL_ONLY = new Set(["rita_study_muted", "rita_mem_muted", "rita_fc_creator_mode"]);

let userId: string | null = null;
let installed = false;
let applyingRemote = false;
const dirty = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

function synced(key: string) {
  return key.startsWith(PREFIX) && !LOCAL_ONLY.has(key);
}

function scheduleFlush() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, 700);
}

async function flush() {
  if (!userId || dirty.size === 0) return;
  const keys = Array.from(dirty);
  dirty.clear();
  const rows = keys.map((key) => {
    let value: unknown = null;
    try {
      const raw = window.localStorage.getItem(key);
      value = raw === null ? null : JSON.parse(raw);
    } catch {
      value = window.localStorage.getItem(key);
    }
    return { user_id: userId, key, value, updated_at: new Date().toISOString() };
  });
  try {
    await (supabase.from as any)("study_state").upsert(rows, { onConflict: "user_id,key" });
  } catch {
    /* offline — the next write retries */
  }
}

async function pull(uid: string) {
  const { data, error } = await (supabase.from as any)("study_state")
    .select("key,value")
    .eq("user_id", uid);
  if (error || !data) return;
  applyingRemote = true;
  let changed = false;
  try {
    for (const row of data as { key: string; value: unknown }[]) {
      if (!synced(row.key)) continue;
      const next = row.value === null ? null : JSON.stringify(row.value);
      const current = window.localStorage.getItem(row.key);
      if (next === null) {
        if (current !== null) {
          window.localStorage.removeItem(row.key);
          changed = true;
        }
      } else if (current !== next) {
        window.localStorage.setItem(row.key, next);
        changed = true;
      }
    }
  } finally {
    applyingRemote = false;
  }
  if (changed) window.dispatchEvent(new Event("rita-cloud-sync"));
}

function clearLocal() {
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const k = window.localStorage.key(i);
    if (k && synced(k)) keys.push(k);
  }
  applyingRemote = true;
  keys.forEach((k) => window.localStorage.removeItem(k));
  applyingRemote = false;
  if (keys.length) window.dispatchEvent(new Event("rita-cloud-sync"));
}

function patchStorage() {
  const proto = window.localStorage;
  const setItem = proto.setItem.bind(proto);
  const removeItem = proto.removeItem.bind(proto);

  window.localStorage.setItem = (key: string, value: string) => {
    setItem(key, value);
    if (!applyingRemote && userId && synced(key)) {
      dirty.add(key);
      scheduleFlush();
    }
  };
  window.localStorage.removeItem = (key: string) => {
    removeItem(key);
    if (!applyingRemote && userId && synced(key)) {
      dirty.add(key);
      scheduleFlush();
    }
  };
}

/**
 * Pushes whatever is already on this device up to a freshly signed-in account.
 * Only ever called for an account with no saved kit at all, so work done before
 * signing up is kept without ever copying one account's kit into another's.
 */
async function pushExisting() {
  if (!userId) return;
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const k = window.localStorage.key(i);
    if (k && synced(k)) dirty.add(k);
  }
  await flush();
}

/** True when this account has never saved anything to the cloud store. */
async function accountIsEmpty(uid: string): Promise<boolean> {
  const { count, error } = await (supabase.from as any)("study_state")
    .select("key", { count: "exact", head: true })
    .eq("user_id", uid);
  if (error) return false;
  return (count ?? 0) === 0;
}

/**
 * Remembers which account this device last belonged to (deliberately not a
 * `rita_` key, so it is never mirrored to the cloud store). It lets us tell a
 * true first-time guest apart from leftovers of a previous account.
 */
const LAST_ACCOUNT = "rj_last_account";

/**
 * Adopts an account on this device: the account is always the source of truth,
 * so the device copy is wiped first and only a brand-new (empty) account keeps
 * whatever was made on the device before signing up.
 */
async function adopt(uid: string) {
  const previous = window.localStorage.getItem(LAST_ACCOUNT);
  const empty = previous === null && (await accountIsEmpty(uid));
  if (!empty) clearLocal();
  userId = uid;
  window.localStorage.setItem(LAST_ACCOUNT, uid);
  await pull(uid);
  if (empty) await pushExisting();
}

/** Wipes an account's leftovers when its session has gone. */
function forget() {
  userId = null;
  dirty.clear();
  clearLocal();
  window.localStorage.removeItem(LAST_ACCOUNT);
}

let readyPromise: Promise<void> | null = null;

/**
 * Installs the mirror and resolves once the signed-in account's own kit has
 * been loaded, so sample content is only added after real data has arrived.
 */
export function startCloudSync(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (readyPromise) return readyPromise;
  installed = true;
  patchStorage();

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "TOKEN_REFRESHED") return;
    const uid = session?.user?.id ?? null;
    if (uid === userId) return;
    if (!uid) {
      forget();
      return;
    }
    // Never await inside this callback — it can stall the auth client.
    void adopt(uid);
  });

  readyPromise = (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id ?? null;
      if (uid) {
        if (uid !== userId) await adopt(uid);
      } else if (window.localStorage.getItem(LAST_ACCOUNT)) {
        // Session gone (signed out elsewhere or expired): never leave the
        // previous account's kit sitting on the device.
        forget();
      }
    } catch {
      /* offline — the mirror still works locally */
    }
  })();

  window.addEventListener("beforeunload", () => {
    void flush();
  });

  return readyPromise;
}


