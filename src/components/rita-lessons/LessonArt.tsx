import { useState } from "react";

const STAR_PATH = "M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z";

/** Three stars on a small arc, grey until earned (like the lesson path reference). */
export function LessonStars({ stars, size = 22 }: { stars: number; size?: number }) {
  return (
    <div className="flex items-end justify-center gap-0.5" aria-label={`${stars} of 3 stars`}>
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

/** Friendly stand-in character for lessons that do not have a picture yet. */
function PlaceholderCharacter() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
      <circle cx="50" cy="50" r="50" fill="#8B4DEB" />
      <circle cx="50" cy="50" r="43" fill="#9B5CF6" />
      <path d="M26 92c3-17 12-26 24-26s21 9 24 26z" fill="#FF8FB8" />
      <circle cx="50" cy="45" r="17" fill="#FFD3AE" />
      <path d="M33 43c0-12 8-19 17-19s17 7 17 19c-5-6-11-9-17-9s-12 3-17 9z" fill="#4A2A1A" />
      <circle cx="44" cy="47" r="2.2" fill="#2B1B3D" />
      <circle cx="56" cy="47" r="2.2" fill="#2B1B3D" />
      <path
        d="M44 53c3 3 9 3 12 0"
        stroke="#2B1B3D"
        strokeWidth="2.2"
        fill="none"
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
    <div className={`overflow-hidden rounded-full bg-[#8B4DEB] ${className}`}>
      {src && !broken ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <PlaceholderCharacter />
      )}
    </div>
  );
}
