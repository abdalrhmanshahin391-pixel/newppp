import { BRAND_PREFIX, BRAND_SUFFIX } from "@/lib/brand";

/** "EdithLab": "Edith" heavy, "Lab" light. Text only, no image. */
export function EdithWordmark({
  size = 28,
  tone = "dark",
  className = "",
}: {
  size?: number;
  /** "dark" = white wordmark for black surfaces, "light" = ink wordmark for white surfaces. */
  tone?: "dark" | "light";
  className?: string;
}) {
  return (
    <span
      className={`select-none whitespace-nowrap ${className}`}
      style={{
        fontFamily: "var(--font-grotesk)",
        fontSize: size,
        lineHeight: 1,
        letterSpacing: "-0.03em",
        color: tone === "light" ? "var(--pro-ink, #0a0f1a)" : "#fff",
      }}
    >
      <span style={{ fontWeight: 700 }}>{BRAND_PREFIX}</span>
      <span style={{ fontWeight: 300 }}>{BRAND_SUFFIX}</span>
    </span>
  );
}
