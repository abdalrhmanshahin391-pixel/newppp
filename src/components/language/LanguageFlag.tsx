import { useEffect, useState } from "react";
import { flagCountryFor, flagSrc } from "@/lib/language-flags";
import type { LearningLanguage } from "@/lib/learning-language";

/**
 * The flag of the country an admin chose for a language, as a small 4:3 picture. It is decoration
 * (the name is always next to it), so it has no text alternative. With no flag, or one that does
 * not load, the language code is shown instead.
 */
export function LanguageFlag({
  language,
  size = 24,
  onDark = false,
}: {
  language: Pick<LearningLanguage, "code" | "flag_country">;
  size?: number;
  /** On the dark top bar a light ring keeps a dark flag (or a white one) readable. */
  onDark?: boolean;
}) {
  const src = flagSrc(flagCountryFor(language));
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const height = Math.round((size * 3) / 4);
  const ring = onDark ? "0 0 0 1px rgb(255 255 255 / 0.35)" : "0 0 0 1px rgb(18 17 23 / 0.14)";

  if (!src || failed) {
    return (
      <span
        aria-hidden="true"
        dir="ltr"
        className="inline-grid shrink-0 place-items-center rounded-[4px] bg-[var(--pp-grey)] font-bold uppercase text-[var(--pp-muted)]"
        style={{
          width: size,
          height,
          fontSize: Math.max(10, Math.round(size * 0.4)),
          boxShadow: ring,
        }}
      >
        {language.code.slice(0, 2)}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={height}
      draggable={false}
      onError={() => setFailed(true)}
      className="shrink-0 rounded-[4px] object-cover"
      style={{ width: size, height, boxShadow: ring }}
    />
  );
}
