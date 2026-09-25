// The original Rita face (the icon Google still shows) — restored on request.
const ritaFace = { url: "/brand-rita.png" };

export function RitaFace({ size = 40 }: { size?: number }) {
  return (
    <span
      className="block shrink-0 overflow-hidden rounded-full border-2 border-white/70 bg-[color:var(--rita-green-soft)]"
      style={{ width: size, height: size }}
    >
      <img
        src={ritaFace.url}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className="h-full w-full object-cover object-[50%_30%]"
      />
    </span>
  );
}

export function RitaBrand({
  size = 40,
  onArtwork = false,
}: {
  size?: number;
  onArtwork?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <RitaFace size={size} />
      <span
        className={`whitespace-nowrap font-display font-black leading-none ${
          onArtwork ? "text-white" : "text-foreground"
        }`}
        style={{ fontSize: Math.round(size * 0.62) }}
      >
        Rita<span className="rita-accent">Jet</span>
      </span>
    </span>
  );
}