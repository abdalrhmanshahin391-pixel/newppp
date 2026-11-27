// Small pieces shared by the classroom and study group pages: the coloured mark (a space's or a
// deck's "app icon"), the window frame and a confirm window, and a few helpers.
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";
import { SPACE_COLORS } from "@/lib/spaces";
import "./spaces.css";

/** Emojis offered for a new classroom or group. */
export const SPACE_EMOJIS = [
  "🎓",
  "📚",
  "🧠",
  "🫀",
  "💊",
  "🔬",
  "🦴",
  "🧪",
  "📐",
  "💻",
  "🌍",
  "🗣️",
  "🇩🇪",
  "🇬🇧",
  "⚡️",
  "🌿",
];

/** The names of the six space colours, for labels. */
export const COLOR_LABEL: Record<string, string> = {
  apricot: "Apricot",
  sky: "Sky",
  lilac: "Lilac",
  mint: "Mint",
  coral: "Coral",
  lime: "Lime",
};

export function toneOf(key: string | null | undefined) {
  return SPACE_COLORS[key ?? "apricot"] ?? SPACE_COLORS["apricot"]!;
}

/** `#f6c67a` → `rgb(246 198 122 / 0.4)`. */
export function hexAlpha(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const n = Number.parseInt(full, 16);
  if (!Number.isFinite(n)) return `rgb(255 255 255 / ${alpha})`;
  return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${alpha})`;
}

/** A readable message from a thrown value (Supabase errors are plain objects with `message`). */
export function errorText(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}

/** A rounded square in two colours with an emoji on it: a space's or a deck's icon. */
export function Mark({
  from,
  to,
  emoji,
  size = 48,
  className = "",
}: {
  from: string;
  to: string;
  emoji: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`sp-mark ${className}`}
      style={
        {
          "--sp-mark": `${size}px`,
          background: `linear-gradient(135deg, ${from}, ${to})`,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      <span className="sp-mark-emoji">{emoji}</span>
    </span>
  );
}

export function SpaceMark({
  color,
  emoji,
  size,
  className,
}: {
  color: string | null | undefined;
  emoji: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const tone = toneOf(color);
  return (
    <Mark from={tone.from} to={tone.to} emoji={emoji || "🎓"} size={size} className={className} />
  );
}

/**
 * The frame of every window on these pages: a sheet from the bottom on phones, centred above
 * 640px, at most 672px wide. Radix gives focus trapping, Escape and the backdrop click. A field
 * with `data-autofocus` is focused when it opens.
 */
export function SpaceDialog({
  open,
  onClose,
  title,
  description,
  wide = false,
  busy = false,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  wide?: boolean;
  busy?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const content = useRef<HTMLDivElement>(null);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="sp-overlay" />
        <Dialog.Content
          ref={content}
          className={`sp sp-modal${wide ? " sp-modal-wide" : ""}`}
          onOpenAutoFocus={(event) => {
            // A field marked `data-autofocus` gets the focus (otherwise Radix picks the first
            // button, which here is Close).
            const field = content.current?.querySelector<HTMLElement>("[data-autofocus]");
            if (!field) return;
            event.preventDefault();
            field.focus();
          }}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <header className="sp-modal-head">
            <div className="sp-modal-titles">
              <Dialog.Title className="sp-modal-title">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="sp-modal-desc">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sp-sr">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="sp-btn sp-btn-ghost sp-btn-icon"
                aria-label="Close"
                disabled={busy}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </header>
          <div className="sp-modal-body">{children}</div>
          {footer && <footer className="sp-modal-foot">{footer}</footer>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export type ConfirmOptions = {
  title: string;
  text: string;
  confirm: string;
  danger?: boolean;
};

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

/**
 * `const { confirm, dialog } = useConfirm()`; render `dialog`, then
 * `if (!(await confirm({ title, text, confirm: "Delete" }))) return;`.
 * Replaces the browser's own confirm box with one in the page's look.
 */
export function useConfirm() {
  const [ask, setAsk] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(
    null,
  );

  const confirm: ConfirmFn = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setAsk({ ...options, resolve });
      }),
    [],
  );

  const close = (ok: boolean) => {
    ask?.resolve(ok);
    setAsk(null);
  };

  const dialog = (
    <Dialog.Root
      open={ask !== null}
      onOpenChange={(next) => {
        if (!next) close(false);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="sp-overlay" />
        <Dialog.Content className="sp sp-modal sp-confirm" role="alertdialog">
          <Dialog.Title className="sp-modal-title">{ask?.title}</Dialog.Title>
          <Dialog.Description className="sp-confirm-text">{ask?.text}</Dialog.Description>
          <div className="sp-confirm-actions">
            <button type="button" className="sp-btn sp-btn-light" onClick={() => close(false)}>
              Cancel
            </button>
            <button
              type="button"
              className={`sp-btn ${ask?.danger ? "sp-btn-danger-solid" : "sp-btn-dark"}`}
              onClick={() => close(true)}
            >
              {ask?.confirm}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );

  return { confirm, dialog };
}

/** True on phone-width screens (640px and less); false on the server. */
export function useNarrow(query = "(max-width: 640px)") {
  // Read at once in the browser so the first paint is already right; false on the server.
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return narrow;
}

/** The spinner used inside buttons while they work (the label stays). */
export function Spin() {
  return <Loader2 size={16} className="sp-spin" aria-hidden="true" />;
}
