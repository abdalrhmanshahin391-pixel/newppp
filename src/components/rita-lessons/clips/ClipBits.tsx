import { Clapperboard, Image as ImageIcon } from "lucide-react";
import type { FilmClip } from "@/lib/film-clips";

/** A clip's cover: the video poster or the GIF still, or an icon when it has none. */
export function ClipThumb({
  clip,
  className = "h-16 w-28",
}: {
  clip: Pick<FilmClip, "kind" | "poster_url" | "gif_still">;
  className?: string;
}) {
  const src = clip.kind === "gif" ? clip.gif_still : clip.poster_url;
  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-lg bg-[var(--pp-grey,#f1f3f5)] text-[var(--pp-muted)] ${className}`}
    >
      {src ? (
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : clip.kind === "gif" ? (
        <ImageIcon size={20} aria-hidden="true" />
      ) : (
        <Clapperboard size={20} aria-hidden="true" />
      )}
      <span className="absolute bottom-1 start-1 rounded bg-black/65 px-1.5 text-[11px] font-bold leading-5 text-white">
        {clip.kind === "gif" ? "GIF" : "فيديو"}
      </span>
    </span>
  );
}

/** The sentence with its target word marked, and the meaning under it. */
export function ClipText({ clip }: { clip: Pick<FilmClip, "en" | "ar" | "target"> }) {
  const at = clip.target ? clip.en.toLowerCase().indexOf(clip.target.toLowerCase()) : -1;
  return (
    <span className="block min-w-0">
      <bdi dir="ltr" className="block truncate text-[15px] font-semibold" lang="en">
        {at < 0 ? (
          clip.en
        ) : (
          <>
            {clip.en.slice(0, at)}
            <mark className="bg-transparent text-[#007bb6]">
              {clip.en.slice(at, at + clip.target.length)}
            </mark>
            {clip.en.slice(at + clip.target.length)}
          </>
        )}
      </bdi>
      <span dir="rtl" className="block truncate text-[14px] text-[var(--pp-muted)]">
        {clip.ar}
      </span>
    </span>
  );
}
