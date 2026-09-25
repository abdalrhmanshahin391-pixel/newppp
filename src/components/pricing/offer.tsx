/** Offer helpers shared by the pricing page and the admin preview. */

export function offerLive(endsAt?: string | null) {
  if (!endsAt) return true;
  return new Date(endsAt).getTime() > Date.now();
}

export function discountPercent(compare?: number | null, price?: number | null) {
  if (!compare || !price || compare <= price) return 0;
  return Math.round(((compare - price) / compare) * 100);
}

/** "ends in 3 days" / "ends today" — nothing when there is no end date. */
export function offerCountdown(endsAt?: string | null) {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return null;
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `ends in ${days} day${days === 1 ? "" : "s"}`;
  const hours = Math.max(1, Math.floor(ms / 3_600_000));
  return `ends in ${hours} hour${hours === 1 ? "" : "s"}`;
}

/** Corner ribbon with the plan's offer tag. Hides itself once the offer ends. */
export function OfferRibbon({
  label,
  color,
  endsAt,
}: {
  label?: string | null;
  color?: string | null;
  endsAt?: string | null;
}) {
  if (!label || !offerLive(endsAt)) return null;
  const c = color || "var(--rita-green)";
  const until = offerCountdown(endsAt);
  return (
    <span className="pointer-events-none absolute right-0 top-0 z-10 flex flex-col items-end">
      <span
        className="rounded-bl-xl rounded-tr-[20px] px-3.5 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-white"
        style={{ background: c, boxShadow: `0 10px 24px -14px ${c}` }}
      >
        {label}
      </span>
      {until && (
        <span className="mr-2 mt-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/65 backdrop-blur">
          {until}
        </span>
      )}
    </span>
  );
}
