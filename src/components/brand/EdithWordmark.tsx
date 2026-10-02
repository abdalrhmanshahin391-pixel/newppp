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
        fontFamily: "var(--font-grotesk)",
        fontSize: size,
        lineHeight: 1,
        letterSpacing: "-0.03em",
      }}
    >
      <span style={{ fontWeight: 700, color: light ? "#0457cb" : "#6aa2ff" }}>{BRAND_PREFIX}</span>
      <span style={{ fontWeight: 300, color: light ? "#2b7fff" : "#9cc3ff" }}>{BRAND_SUFFIX}</span>
    </span>
  );
}
