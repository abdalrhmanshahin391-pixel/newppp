// The book's contents (the page-pane plan, phase 3c): from the PDF's own outline, kept in the
// manifest. A list icon in the bar under the page opens it — a panel above the button on an iPad
// or computer, a sheet from the bottom on a phone. The chapter you are in is marked and in view;
// a tap goes to its page and closes the panel. Shown only for books whose PDF has an outline.
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ListTree, X } from "lucide-react";
import { outlineIndexAt } from "@/lib/books-reader";

const PANEL = 320;

type Props = {
  outline: [string, number, number][];
  page: number;
  onJump: (page: number) => void;
  /** "باقي ≈ 6 دقايق بالفصل", or null (shown under the title). */
  left: string | null;
};

export function BookOutline({ outline, page, onJump, left }: Props) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement | null>(null);
  const list = useRef<HTMLOListElement | null>(null);
  const [place, setPlace] = useState<{ bottom: number; left: number; sheet: boolean }>({
    bottom: 72,
    left: 16,
    sheet: false,
  });
  const current = outlineIndexAt(outline, page);
  // Rendered inside the reader (not at the end of <body>), so the site's colour tokens apply.
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(button.current?.closest<HTMLElement>(".edith-premium") ?? null), []);

  // Where the panel goes: above the button, inside the window; a bottom sheet on a phone.
  const measure = () => {
    const el = button.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const sheet = window.innerWidth < 600;
    const left = Math.min(
      Math.max(box.left + box.width / 2 - PANEL / 2, 16),
      window.innerWidth - PANEL - 16,
    );
    setPlace({ bottom: window.innerHeight - box.top + 8, left, sheet });
  };

  // The chapter you are in, in view (and focused) when the panel opens.
  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      const el = list.current?.querySelector<HTMLButtonElement>('[aria-current="true"]');
      el?.scrollIntoView({ block: "center" });
      (el ?? list.current?.querySelector<HTMLButtonElement>("button"))?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const onKey = (event: KeyboardEvent<HTMLOListElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const items = Array.from(list.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "ArrowDown" ? Math.min(items.length - 1, at + 1) : Math.max(0, at - 1);
    items[next]?.focus();
    event.preventDefault();
    // The page's own arrow keys must not turn it meanwhile.
    event.stopPropagation();
  };

  if (!outline.length) return null;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (next) measure();
        setOpen(next);
      }}
    >
      <Dialog.Trigger asChild>
        <button ref={button} type="button" className="bkr-icon" aria-label="الفهرس" title="الفهرس">
          <ListTree size={17} aria-hidden="true" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal container={host ?? undefined}>
        <Dialog.Overlay className="bkr-toc-veil" />
        <Dialog.Content
          className={`bkr-toc${place.sheet ? " is-sheet" : ""}`}
          style={place.sheet ? undefined : { bottom: place.bottom, left: place.left, width: PANEL }}
          dir="rtl"
          aria-describedby={undefined}
          onKeyDown={(event) => {
            // Arrows inside the panel never reach the reader's page turning.
            if (event.key.startsWith("Arrow") || event.key.startsWith("Page"))
              event.stopPropagation();
          }}
        >
          <div className="bkr-toc-head">
            <div>
              <Dialog.Title className="bkr-toc-title">الفهرس</Dialog.Title>
              {left && <p className="bkr-toc-left">{left}</p>}
            </div>
            <Dialog.Close className="bkr-icon" aria-label="سكّر الفهرس">
              <X size={16} aria-hidden="true" />
            </Dialog.Close>
          </div>
          <ol ref={list} className="bkr-toc-list" onKeyDown={onKey}>
            {outline.map(([title, at, level], index) => (
              <li key={`${index}-${at}`}>
                <button
                  type="button"
                  aria-current={index === current ? "true" : undefined}
                  style={{ paddingInlineStart: 12 + Math.min(3, level) * 14 }}
                  onClick={() => {
                    setOpen(false);
                    onJump(at);
                  }}
                >
                  <span className="bkr-toc-name" dir="auto">
                    {title}
                  </span>
                  <span className="bkr-toc-page">{at}</span>
                </button>
              </li>
            ))}
          </ol>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
