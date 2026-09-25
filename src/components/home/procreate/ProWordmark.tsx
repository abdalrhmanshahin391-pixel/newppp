/** "RitaJet" in white — "Rita" heavy, "Jet" light, like Pro + create. */
export function ProWordmark({ size = 30 }: { size?: number }) {
  return (
    <span
      className="select-none whitespace-nowrap text-white"
      style={{
        fontFamily: "var(--font-grotesk)",
        fontSize: size,
        lineHeight: 1,
        letterSpacing: "-0.02em",
      }}
    >
      <span style={{ fontWeight: 700 }}>Rita</span>
      <span style={{ fontWeight: 300 }}>Jet</span>
    </span>
  );
}
