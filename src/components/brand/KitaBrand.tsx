import { RitaBrand } from "@/components/brand/RitaBrand";

/** Legacy export kept for older surfaces; now uses the single RitaJet wordmark. */
export function BrandName({ size = 26 }: { size?: number }) {
  return (
    <span className="font-display font-black text-foreground" style={{ fontSize: size, lineHeight: 1.05 }}>
      Rita<span className="rita-accent">Jet</span>
    </span>
  );
}


/** Rita brand block: circular character avatar + wordmark. */
export function KitaBrand({ size = 40 }: { size?: number }) {
  return <RitaBrand size={size} />;
}
