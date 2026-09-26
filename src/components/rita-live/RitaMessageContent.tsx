import { useEffect, useState } from "react";
import { Bookmark, Check, Rabbit, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MixedDirectionText } from "@/components/rita-live/MixedDirectionText";
import { parseRitaReply } from "@/lib/rita-structured-reply";

type GermanAction = (item: { text: string; meaning: string }, speed: "normal" | "slow") => void;

export function RitaMessageContent({
  text,
  onPlayGerman,
  onSaveGerman,
  onPrefetchGerman,
  savedTerms,
}: {
  text: string;
  onPlayGerman: GermanAction;
  onSaveGerman: (item: { text: string; meaning: string }) => void;
  savedTerms: Set<string>;
  onPrefetchGerman?: (item: { text: string }) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const parts = parseRitaReply(text);
  const germanKey = parts.filter((part) => part.type === "german").map((part) => part.text).join("\n");
  useEffect(() => {
    if (!onPrefetchGerman || !germanKey) return;
    // Warm the normal-speed audio shortly after the card appears so the first tap plays instantly.
    const timer = window.setTimeout(() => germanKey.split("\n").forEach((item) => onPrefetchGerman({ text: item })), 600);
    return () => window.clearTimeout(timer);
  }, [germanKey, onPrefetchGerman]);
  return (
    <span className="block space-y-3">
      {parts.map((part, index) => {
        if (part.type !== "german") {
          return (
            <span
              key={`${part.type}-${index}-${part.text}`}
              className={part.type === "note" ? "block border-s-2 border-rita-note pl-3 text-base leading-7 text-rita-note-foreground" : "block"}
            >
              <MixedDirectionText text={part.text} />
            </span>
          );
        }
        const key = `${index}-${part.text}`;
        const saved = savedTerms.has(part.text.toLocaleLowerCase().trim());
        return (
          <span key={key} className="relative block">
            <button
              type="button"
              onClick={() => {
                onPrefetchGerman?.(part);
                setOpen((current) => current === key ? null : key);
              }}
              className="block w-full rounded-md border border-rita-german-border bg-rita-german px-4 py-3 text-start transition hover:bg-rita-german-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <bdi dir="ltr" className="block text-lg font-extrabold text-rita-german-foreground">{part.text}</bdi>
              {part.meaning && <span dir="rtl" className="mt-1 block text-sm font-semibold text-rita-german-muted">{part.meaning}</span>}
              {!!part.breakdown.length && (
                <span className="mt-3 block space-y-1 border-t border-rita-german-border pt-2">
                  {part.breakdown.map((entry) => (
                    <span key={`${entry.german}-${entry.meaning}`} className="flex items-baseline justify-between gap-4 text-sm">
                      <bdi dir="ltr" className="font-bold text-rita-german-foreground">{entry.german}</bdi>
                      <span dir="rtl" className="text-rita-german-muted">{entry.meaning}</span>
                    </span>
                  ))}
                </span>
              )}
            </button>
            {open === key && (
              <span className="mt-2 flex flex-wrap gap-2 rounded-md border border-border bg-card p-2 shadow-lg">
                <Button type="button" size="sm" variant="outline" onClick={() => onPlayGerman(part, "normal")}>
                  <Volume2 /> عادي
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => onPlayGerman(part, "slow")}>
                  <Rabbit /> بطيء
                </Button>
                <Button type="button" size="sm" variant={saved ? "secondary" : "default"} disabled={saved} onClick={() => onSaveGerman(part)}>
                  {saved ? <Check /> : <Bookmark />} {saved ? "محفوظة" : "حفظ"}
                </Button>
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}