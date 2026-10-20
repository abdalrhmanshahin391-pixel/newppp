import { LEARN_IMAGES } from "@/lib/learn-images";

/**
 * The picture on a learning-home card. The known card catalogue is fully mapped
 * in `learn-images.ts`; the quiet fallback only protects future cards while they
 * are being designed.
 */
export function ImageSlot({ slot }: { slot: string; lang: "en" | "ar" }) {
  const src = LEARN_IMAGES[slot];
  const size =
    "m-2 h-[88px] w-[88px] shrink-0 overflow-hidden rounded-[14px] bg-[#f1edf8] ring-1 ring-black/[0.07] sm:h-[128px] sm:w-[128px]";
  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={128}
        height={128}
        loading="lazy"
        decoding="async"
        className={`${size} object-cover transition-transform duration-300 ease-out group-hover:scale-[1.025]`}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      data-image-slot={slot}
      className={`${size} bg-[radial-gradient(circle_at_35%_30%,#fff8e8,transparent_38%),radial-gradient(circle_at_72%_70%,#d9cef5,transparent_48%),#f1edf8]`}
    />
  );
}
