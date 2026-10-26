import { UzyraMark } from "./UzyraMark";

/**
 * "UZYRA": capitals, wide letter-spacing, a geometric sans at weight 600, and an A drawn without its
 * crossbar. The symbol sits before it. Colour is the surrounding text colour, so the same component
 * serves the black header, the black footer and any white surface.
 */
export function UzyraWordmark({
  size = 22,
  withMark = true,
  className = "",
}: {
  size?: number;
  withMark?: boolean;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label="Uzyra"
      className={`select-none whitespace-nowrap ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.62em",
        fontFamily:
          "var(--uz-wordmark-font, 'Outfit', 'Inter Tight', Helvetica, Arial, sans-serif)",
        fontSize: size,
        fontWeight: 600,
        lineHeight: 1,
        letterSpacing: "0.2em",
        textTransform: "uppercase",
      }}
    >
      {withMark && <UzyraMark className="shrink-0 h-[1.55em] w-auto" />}
      <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center" }}>
        UZYR
        <svg
          viewBox="0 0 10 9"
          focusable="false"
          style={{
            width: "0.74em",
            height: "0.67em",
            marginInlineStart: "-0.03em",
            overflow: "visible",
          }}
        >
          <path
            d="M1.1 9 L5 1 L8.9 9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="miter"
            strokeMiterlimit="6"
          />
        </svg>
      </span>
    </span>
  );
}
