import { parseParagraph, splitParagraphs, textDirection } from "./chat-text";

/**
 * One chat message, set out cleanly: it reads in the direction of its main
 * language, **bold** shows as bold, and foreign words inside an Arabic sentence
 * (German, English) are set apart as small pink chips so the word being
 * taught stands out and keeps its own letter order.
 */
export function ChatText({ text, className = "" }: { text: string; className?: string }) {
  const direction = textDirection(text);
  const paragraphs = splitParagraphs(text);
  return (
    <div dir={direction} lang={direction === "rtl" ? "ar" : undefined} className={className}>
      {paragraphs.map((paragraph, paragraphIndex) => (
        <p key={paragraphIndex} className={paragraphIndex > 0 ? "mt-2" : undefined}>
          {parseParagraph(paragraph, direction).map((segment, index) =>
            segment.kind === "foreign" ? (
              <bdi
                key={index}
                dir="ltr"
                className="inline-block rounded-md bg-[var(--pp-pink-soft)] px-1.5 font-semibold leading-7 text-[var(--pp-ink)]"
              >
                {segment.value}
              </bdi>
            ) : segment.kind === "bold" ? (
              <strong key={index} className="font-bold">
                {segment.value}
              </strong>
            ) : (
              <span key={index}>{segment.value}</span>
            ),
          )}
        </p>
      ))}
    </div>
  );
}
