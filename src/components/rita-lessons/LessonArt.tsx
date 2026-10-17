import { useState } from "react";

const STAR_PATH = "M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z";

/** Three stars on a small arc, grey until earned (like the lesson path reference). */
export function LessonStars({ stars, size = 22 }: { stars: number; size?: number }) {
  return (
    <div className="flex items-end justify-center gap-0.5" aria-label={`${stars} / 3`} role="img">
      {[0, 1, 2].map((index) => (
        <svg
          key={index}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          style={{ transform: index === 1 ? `translateY(-${Math.round(size / 4)}px)` : undefined }}
        >
          <path
            d={STAR_PATH}
            fill={index < stars ? "#FFC83D" : "#D9DCE6"}
            stroke={index < stars ? "#E8A400" : "#C7CBD8"}
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </div>
  );
}

/** Stand-in for lessons that do not have a picture yet: an open book in the site's own colours. */
function PlaceholderArt() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
      <rect width="100" height="100" fill="var(--pp-accent-soft, #e7eefd)" />
      <path
        d="M50 36c-6-4-14-5-22-4v32c8-1 16 0 22 4 6-4 14-5 22-4V32c-8-1-16 0-22 4z"
        fill="#fff"
        stroke="var(--pp-ink, #121117)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M50 36v32" stroke="var(--pp-ink, #121117)" strokeWidth="3" strokeLinecap="round" />
      <path
        d="M35 44h9M35 52h9M56 44h9M56 52h9"
        stroke="var(--pp-accent, #2b6df0)"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LessonImage({
  src,
  alt,
  className = "",
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={`overflow-hidden rounded-full bg-[var(--pp-accent-soft,#e7eefd)] ${className}`}>
      {src && !broken ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <PlaceholderArt />
      )}
    </div>
  );
}
