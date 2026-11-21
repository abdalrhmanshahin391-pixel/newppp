// The 20 Sintel lines as clips, for stops saved before the clips table existed (film_lines).
import sintel from "./sintel-lines.json";
import type { ClipPoolEntry, FilmClip } from "./film-clips";

const SINTEL_CREDIT = "Sintel · © Blender Foundation · CC BY 3.0";
const SINTEL_URL = "https://durian.blender.org/sharing/";

export function sintelClip(id: number): FilmClip | null {
  const line = sintel.find((row) => row.id === id);
  if (!line) return null;
  return {
    id: `sintel-${line.id}`,
    kind: "video",
    en: line.en,
    ar: line.ar,
    target: line.target,
    target_ar: line.targetAr,
    context_ar: line.contextAr,
    video_url: `/media/sintel/${line.id}.mp4`,
    poster_url: `/media/sintel/${line.id}.jpg`,
    start_s: null,
    end_s: null,
    gif_id: null,
    gif_mp4: null,
    gif_still: null,
    gif_page: null,
    source: "Sintel",
    credit: SINTEL_CREDIT,
    credit_url: SINTEL_URL,
    legacy_id: line.id,
  };
}

export function sintelClips(ids: number[]): FilmClip[] {
  return ids.flatMap((id) => sintelClip(id) ?? []);
}

export const SINTEL_POOL: ClipPoolEntry[] = sintel.map((line) => ({ en: line.en, ar: line.ar }));
