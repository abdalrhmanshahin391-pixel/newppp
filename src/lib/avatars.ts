import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/legacy-client";
import { compressImage } from "@/lib/image-compress";

export const AVATAR_BUCKET = "avatars";

const urlCache = new Map<string, string>();

/** Signed URL for a stored avatar path (bucket is private). */
export async function avatarUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const cached = urlCache.get(path);
  if (cached) return cached;
  const { data } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, 60 * 60);
  if (!data?.signedUrl) return null;
  urlCache.set(path, data.signedUrl);
  return data.signedUrl;
}

/** Resolves an avatar path to a displayable URL. */
export function useAvatarUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(path?.startsWith("http") ? path : null);
  useEffect(() => {
    let alive = true;
    avatarUrl(path).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [path]);
  return url;
}

/** Compresses and uploads a picked image, returns the stored path. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please pick a picture file (JPG, PNG or WebP).");
  }
  const img = await compressImage(file, { maxEdge: 512, quality: 0.85 });
  const path = `${userId}/avatar-${Date.now()}.${img.ext}`;
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, img.file, { upsert: true, contentType: img.contentType });
  if (error) {
    const msg = (error.message ?? "").toLowerCase();
    if (msg.includes("exceeded") || msg.includes("size")) {
      throw new Error("That picture is too large — please pick one under 5 MB.");
    }
    throw new Error("Could not save that photo. Please try again.");
  }
  return path;
}

export async function removeAvatar(path: string | null) {
  if (!path || path.startsWith("http")) return;
  urlCache.delete(path);
  await supabase.storage.from(AVATAR_BUCKET).remove([path]);
}

/** Deterministic swirl gradient used as an avatar fallback. */
export function avatarTone(seed: string) {
  const palettes = [
    ["#f0a95c", "#d1795e"],
    ["#7cb8e8", "#b39ddb"],
    ["#7fcaa5", "#8ec63f"],
    ["#b39ddb", "#ef9a7f"],
    ["#f6b352", "#7fcaa5"],
  ];
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 997;
  const p = palettes[h % palettes.length]!;
  return `linear-gradient(135deg, ${p[0]}, ${p[1]})`;
}
