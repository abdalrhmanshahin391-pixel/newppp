import { BRAND_PREFIX, BRAND_SUFFIX } from "@/lib/brand";

/** "EdithLab" in white: "Edith" heavy, "Lab" light. Text only, no image. */
export function EdithWordmark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`select-none whitespace-nowrap text-white ${className}`}
      style={{
        fontFamily: "var(--font-grotesk)",
        fontSize: size,
        lineHeight: 1,
        letterSpacing: "-0.03em",
      }}
    >
      <span style={{ fontWeight: 700 }}>{BRAND_PREFIX}</span>
      <span style={{ fontWeight: 300 }}>{BRAND_SUFFIX}</span>
    </span>
  );
}
