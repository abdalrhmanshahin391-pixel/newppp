import { Volume2 } from "lucide-react";
import { parseParagraph, splitParagraphs, textDirection } from "./chat-text";

/**
 * One chat message, set out cleanly: it reads in the direction of its main
 * language, **bold** shows as bold, and foreign words inside an Arabic sentence
 * (German, English) are set apart as small pink chips so the word being
 * taught stands out and keeps its own letter order.
 */
export function ChatText({
  text,
  className = "",
  onPhrase,
  interruptedAt,
}: {
  text: string;
  className?: string;
  /** When given, foreign words become small buttons that open the word window. */
  onPhrase?: (phrase: string) => void;
  interruptedAt?: number | null;
}) {
  if (interruptedAt !== null && interruptedAt !== undefined && interruptedAt < text.length) {
    const heard = text.slice(0, Math.max(0, interruptedAt));
    const unheard = text.slice(Math.max(0, interruptedAt));
    return (
      <div className={className}>
        {heard && <ChatText text={heard} onPhrase={onPhrase} />}
        <div className="mt-1 border-l-2 border-[var(--pp-line)] pl-3 opacity-45">
          <span className="mb-1 block text-xs font-semibold">توقفت هنا</span>
          <ChatText text={unheard} onPhrase={onPhrase} />
        </div>
      </div>
    );
  }
  const direction = textDirection(text);
  const paragraphs = splitParagraphs(text);
  return (
    <div dir={direction} lang={direction === "rtl" ? "ar" : undefined} className={className}>
      {paragraphs.map((paragraph, paragraphIndex) => {
        // Each paragraph reads in its own direction (an Arabic line and an
        // English line can share a message).
        const own = paragraphs.length > 1 ? textDirection(paragraph) : direction;
        return (
          <p key={paragraphIndex} dir={own} className={paragraphIndex > 0 ? "mt-2" : undefined}>
            {parseParagraph(paragraph, own).map((segment, index) =>
              segment.kind === "foreign" ? (
                onPhrase ? (
                  <button
                    key={index}
                    type="button"
                    dir="ltr"
                    onClick={() => onPhrase(segment.value)}
                    aria-label={`${segment.value}: translation and pronunciation`}
                    className="mx-0.5 inline-flex items-center gap-1 rounded-md bg-[var(--pp-accent-soft)] px-2 py-px align-baseline font-semibold leading-7 text-[var(--pp-ink)] transition-colors hover:bg-[#f4f4f8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--pp-ink)]"
                  >
                    {segment.value}
                    <Volume2
                      size={12}
                      aria-hidden="true"
                      className="text-[var(--pp-accent-text)]"
                    />
                  </button>
                ) : (
                  <bdi
                    key={index}
                    dir="ltr"
                    className="inline-block rounded-md bg-[var(--pp-accent-soft)] px-1.5 font-semibold leading-7 text-[var(--pp-ink)]"
                  >
                    {segment.value}
                  </bdi>
                )
              ) : segment.kind === "bold" && onPhrase && own === "ltr" ? (
                <button
                  key={index}
                  type="button"
                  onClick={() => onPhrase(segment.value)}
                  aria-label={`${segment.value}: translation and pronunciation`}
                  className="mx-0.5 inline-flex items-center gap-1 rounded-md bg-[var(--pp-accent-soft)] px-2 py-px align-baseline font-bold hover:bg-[#f4f4f8]"
                >
                  {segment.value}
                  <Volume2 size={12} aria-hidden="true" className="text-[var(--pp-accent-text)]" />
                </button>
              ) : segment.kind === "bold" ? (
                <strong key={index} className="font-bold">
                  {segment.value}
                </strong>
              ) : (
                <span key={index}>{segment.value}</span>
              ),
            )}
          </p>
        );
      })}
    </div>
  );
}
