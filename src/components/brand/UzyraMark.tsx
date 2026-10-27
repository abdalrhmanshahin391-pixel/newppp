import { UZYRA_MARK_PATHS, UZYRA_MARK_VIEWBOX } from "@/lib/brand";

/**
 * The Uzyra symbol: five solid shapes, drawn from the owner's logo. One colour (currentColor), so
 * it is soft white on the dark bar and ink on white pages.
 */
export function UzyraMark({ className = "", title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox={UZYRA_MARK_VIEWBOX}
      fill="currentColor"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {UZYRA_MARK_PATHS.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
