import { RitaBrand } from "@/components/brand/RitaBrand";

/** Legacy export kept for older surfaces; now the Uzyra name. */
export function BrandName({ size = 26 }: { size?: number }) {
  return (
    <span
      className="font-display font-black text-foreground"
      style={{ fontSize: size, lineHeight: 1.05 }}
    >
      Uzyra
    </span>
  );
}

/** Site brand block: the Uzyra mark and name. */
export function KitaBrand({ size = 40 }: { size?: number }) {
  return <RitaBrand size={size} />;
}
