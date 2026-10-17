import { BRAND_PREFIX, BRAND_SUFFIX } from "@/lib/brand";

/**
 * "EdithLab": "Edith" heavy, "Lab" light. Text only, no image. Edith is blue:
 * "light" is for white surfaces (brand blue), "dark" is for black surfaces
 * (a lighter blue so it stays readable).
 */
export function EdithWordmark({
  size = 28,
  tone = "dark",
  className = "",
}: {
  size?: number;
  tone?: "dark" | "light";
  className?: string;
}) {
  const light = tone === "light";
  return (
    <span
      className={`select-none whitespace-nowrap ${className}`}
      style={{
        fontFamily: "var(--wordmark-font, var(--font-grotesk))",
        fontSize: size,
        lineHeight: 1,
        letterSpacing: "var(--wordmark-tracking, -0.03em)",
      }}
    >
      <span style={{ fontWeight: "var(--wordmark-prefix-weight, 700)", color: light ? "var(--wordmark-prefix, #2b6df0)" : "#a9c4f9" }}>{BRAND_PREFIX}</span>
      <span style={{ fontWeight: "var(--wordmark-suffix-weight, 300)", color: light ? "var(--wordmark-suffix, #7ba5f5)" : "#cddcfb" }}>{BRAND_SUFFIX}</span>
    </span>
  );
}
