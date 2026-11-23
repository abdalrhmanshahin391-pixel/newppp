import { writeFile } from "node:fs/promises";
import snapshot from "../src/lib/public-site-snapshot.json";

// Manual maintenance only. Run with Bun so the project's public .env config loads.
const url = process.env["VITE_SUPABASE_URL"];
const key = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
if (!url || !key) throw new Error("Public backend configuration is unavailable.");

async function read<T>(table: string, query: string): Promise<T> {
  const response = await fetch(`${url}/rest/v1/${table}?${query}`, {
    headers: { apikey: key ?? "" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Public ${table} read failed (HTTP ${response.status}); snapshot unchanged.`);
  return response.json() as Promise<T>;
}

const [settings, images, announcements] = await Promise.all([
  read<Record<string, string | number | boolean | null>[]>("site_settings_public", `select=${Object.keys(snapshot.settings).join(",")}&id=eq.true`),
  read<{ key: string; path: string }[]>("site_images_public", "select=key,path"),
  read<Record<string, unknown>[]>("site_announcements", "select=id,title,body,href,href_label,style,accent,urgent,active,pinned,starts_at,ends_at,sort,image_url,button_label,button_href,secondary_label,secondary_href,trigger,delay_seconds,frequency,paths&active=eq.true&order=sort.asc,created_at.desc"),
]);
const row = settings[0];
if (!row) throw new Error("No public settings row; snapshot unchanged.");
// Storage stays private. Use permanent project asset pointers, never signed URLs.
if (images.some(({ path }) => !/^https:\/\//.test(path) || /\/object\/sign\//.test(path))) {
  throw new Error("Artwork needs permanent project asset URLs before it can be bundled; snapshot unchanged.");
}
const next = { settings: row, siteImages: Object.fromEntries(images.map(({ key, path }) => [key, path])), announcements };
if (/\/object\/sign\//.test(JSON.stringify(next))) throw new Error("Expiring URLs cannot be bundled; snapshot unchanged.");
await writeFile(new URL("../src/lib/public-site-snapshot.json", import.meta.url), `${JSON.stringify(next, null, 2)}\n`);
console.log("Public site snapshot refreshed; publish to update public pages. No scheduled work was added.");