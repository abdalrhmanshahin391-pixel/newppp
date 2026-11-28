import { useGroqRequests } from "@/hooks/useGroqRequests";
import { useUiLanguage } from "@/components/language/useUiLanguage";
import { groqRequestLevel } from "@/lib/groq-requests";

/** Emith requests left this month (written answers: books, exercises, games, the board). */
export function EmithRequests() {
  const requests = useGroqRequests();
  const ar = useUiLanguage() === "ar";
  const status = requests.data;
  const number = (n: number) => n.toLocaleString(ar ? "ar-JO" : "en-US");
  const capped = !!status && !status.unlimited && status.limit !== null && status.left !== null;
  const level = groqRequestLevel(status);
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--pp-grey)] px-3 py-2 text-sm"
      aria-label={ar ? "طلبات Emith" : "Emith requests"}
    >
      <span>{ar ? "طلبات Emith" : "Emith requests"}</span>
      <span dir="auto" className="tabular-nums font-semibold">
        {requests.isError
          ? ar
            ? "غير متاحة هلأ"
            : "Unavailable"
          : !status
            ? "…"
            : status.unlimited || status.limit === null
              ? "∞"
              : ar
                ? `${number(status.left ?? 0)} من ${number(status.limit)}`
                : `${number(status.left ?? 0)} of ${number(status.limit)}`}
      </span>
      {capped && status.limit! > 0 && (
        <span
          className="block h-1.5 w-full overflow-hidden rounded-full bg-white"
          role="progressbar"
          aria-label={ar ? "طلبات Emith الباقية" : "Emith requests left"}
          aria-valuemin={0}
          aria-valuemax={status.limit!}
          aria-valuenow={status.left!}
        >
          <span
            className="block h-full rounded-full"
            style={{
              width: `${Math.max(0, Math.min(100, (status.left! / status.limit!) * 100))}%`,
              background: level === "ok" ? "var(--pp-ink, #121117)" : "#b42318",
            }}
          />
        </span>
      )}
      {capped && status.resetsAt && (
        <small className="w-full text-[var(--pp-muted)]">
          {level === "out"
            ? ar
              ? "خلصت طلبات هالشهر. بترجع"
              : "This month's requests are used up. Back on"
            : ar
              ? "بتتجدد"
              : "Renews"}{" "}
          {new Date(status.resetsAt).toLocaleDateString(ar ? "ar" : "en", {
            day: "numeric",
            month: "short",
          })}
        </small>
      )}
    </div>
  );
}
