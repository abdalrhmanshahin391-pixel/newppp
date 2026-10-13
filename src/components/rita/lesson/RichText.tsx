import { Fragment, memo, useMemo } from "react";
import { parseRitaText, type DisplaySegment, type RichLine } from "@/lib/rita-message";

function Parts({ segment }: { segment: DisplaySegment }) {
  return (
    <>
      {segment.parts.map((part, index) =>
        part.emphasis ? (
          <strong key={index}>{part.text}</strong>
        ) : (
          <Fragment key={index}>{part.text}</Fragment>
        ),
      )}
    </>
  );
}

function Line({ line }: { line: RichLine }) {
  return (
    <>
      {line.segments.map((segment, index) =>
        segment.dir === "ltr" ? (
          // One isolated left-to-right phrase: its punctuation and quotes stay with it.
          <bdi key={index} dir="ltr" lang={segment.lang} className="rl-foreign">
            <Parts segment={segment} />
          </bdi>
        ) : (
          <span key={index} lang={segment.lang === "ar" ? "ar" : undefined}>
            <Parts segment={segment} />
          </span>
        ),
      )}
    </>
  );
}

/** Shows model or transcript text without markdown marks, with Arabic and German kept in order. */
export const RichText = memo(function RichText({ text }: { text: string }) {
  const parsed = useMemo(() => parseRitaText(text), [text]);
  return (
    <>
      {parsed.blocks.map((block, index) => {
        if (block.type === "paragraph") {
          return (
            <p key={index} dir={block.dir}>
              <Line line={block} />
            </p>
          );
        }
        const List = block.ordered ? "ol" : "ul";
        return (
          <List key={index} dir={block.dir}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex} dir={item.dir}>
                <Line line={item} />
              </li>
            ))}
          </List>
        );
      })}
    </>
  );
});
