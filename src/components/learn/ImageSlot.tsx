import { LEARN_IMAGES } from "@/lib/learn-images";

/**
 * The picture on a learning-home tile. The known card catalogue is fully mapped
 * in `learn-images.ts`; the quiet fallback only protects future cards while they
 * are being designed. Size and framing come from `.uz-tile-img` (styles.css).
 */
export function ImageSlot({ slot }: { slot: string; lang: "en" | "ar" }) {
  const src = LEARN_IMAGES[slot];
  return (
    <span className="uz-tile-img" data-image-slot={src ? undefined : slot} aria-hidden="true">
      {src ? (
        <img src={src} alt="" width={512} height={512} loading="lazy" decoding="async" />
      ) : null}
    </span>
  );
}
