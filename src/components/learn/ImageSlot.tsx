import { Image as ImageIcon } from "lucide-react";
import { LEARN_IMAGES } from "@/lib/learn-images";

/**
 * The picture on a learning-home card. With no picture for `slot` it is a dashed, labelled empty
 * square so it is obvious where an image goes; add the picture in `learn-images.ts` and it fills in.
 */
export function ImageSlot({ slot, lang }: { slot: string; lang: "en" | "ar" }) {
  const src = LEARN_IMAGES[slot];
  const size = "m-2 h-[88px] w-[88px] shrink-0 rounded-xl sm:h-[128px] sm:w-[128px]";
  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={128}
        height={128}
        loading="lazy"
        decoding="async"
        className={`${size} object-cover`}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      data-image-slot={slot}
      className={`${size} grid place-items-center border-2 border-dashed border-[#8b8a9c] bg-[#f4f4f8] text-[#4b4a5c]`}
    >
      <span className="grid justify-items-center gap-1 text-[12px] font-semibold leading-tight">
        <ImageIcon size={24} strokeWidth={1.75} />
        {lang === "ar" ? "مكان الصورة" : "Image here"}
      </span>
    </div>
  );
}
