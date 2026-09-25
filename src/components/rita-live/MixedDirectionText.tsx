const ARABIC = /[\u0600-\u06ff]/u;
const LATIN = /[A-Za-zÄÖÜäöüß]/u;

function direction(value: string) {
  const arabic = (value.match(/[\u0600-\u06ff]/gu) ?? []).length;
  const latin = (value.match(/[A-Za-zÄÖÜäöüß]/gu) ?? []).length;
  return arabic >= latin ? "rtl" : "ltr";
}

function MixedLine({ line }: { line: string }) {
  const base = direction(line);
  const parts = line.split(/((?:[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß0-9'’\-]*(?:\s+[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß0-9'’\-]*){0,8}))/gu);
  return (
    <span dir={base} className="block text-start [unicode-bidi:plaintext]">
      {parts.map((part, index) => {
        const foreign = LATIN.test(part) && !ARABIC.test(part);
        return foreign ? (
          <bdi key={`${index}-${part}`} dir="ltr" className="inline-block font-medium">
            {part}
          </bdi>
        ) : (
          <span key={`${index}-${part}`}>{part}</span>
        );
      })}
    </span>
  );
}

export function MixedDirectionText({ text }: { text: string }) {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  return (
    <span className="block space-y-2">
      {(lines.length ? lines : [text]).map((line, index) => (
        <MixedLine key={`${index}-${line}`} line={line} />
      ))}
    </span>
  );
}