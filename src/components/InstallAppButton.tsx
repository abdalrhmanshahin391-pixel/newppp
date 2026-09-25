import { useEffect, useState } from "react";
import { Download, Share, PlusSquare, X } from "lucide-react";
import { RitaFace } from "@/components/brand/RitaBrand";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "aqb-install-dismissed";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document);
}

/**
 * Tracks whether the app can be installed and how.
 * - "prompt": Chrome/Edge gave us a real install prompt (one tap).
 * - "ios": Safari on iPhone/iPad — manual Share > Add to Home Screen.
 * - null: already installed, or the browser has no install path.
 */
export function useInstallApp() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(true); // assume hidden until mounted
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setIos(isIos());
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const mode: "prompt" | "ios" | null = installed
    ? null
    : deferred
      ? "prompt"
      : ios
        ? "ios"
        : null;

  async function install() {
    if (!deferred) return false;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    return choice.outcome === "accepted";
  }

  return { mode, install };
}

function IosSheet({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-[color:color-mix(in_oklab,var(--pro-ink)_48%,transparent)] p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="rita-install-sheet w-full max-w-sm overflow-hidden rounded-[28px] border p-6 text-[color:var(--pro-ink)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <RitaFace size={52} />
            <div>
              <p className="text-[17px] font-black leading-tight">Keep RitaJet one tap away</p>
              <p className="mt-1 text-[13px] text-[color:var(--pro-muted)]">Add it to your Home Screen.</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-[color:var(--pro-muted)] transition-colors hover:bg-[color:var(--rita-green-soft)] hover:text-[color:var(--pro-ink)]">
            <X size={18} />
          </button>
        </div>

        <ol className="mt-6 space-y-3 text-sm font-semibold">
          <li className="flex items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[color:var(--rita-green-soft)] text-xs font-black text-[color:var(--rita-green-deep)]">
              1
            </span>
            <span className="inline-flex items-center gap-1.5">
              Tap the <Share size={16} className="text-[color:var(--rita-green-deep)]" /> Share button in Safari
            </span>
          </li>
          <li className="flex items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[color:var(--rita-green-soft)] text-xs font-black text-[color:var(--rita-green-deep)]">
              2
            </span>
            <span className="inline-flex items-center gap-1.5">
              Choose <PlusSquare size={16} className="text-[color:var(--rita-green-deep)]" /> “Add to Home Screen”
            </span>
          </li>
        </ol>

        <p className="mt-5 border-t border-[color:color-mix(in_oklab,var(--pro-ink)_9%,transparent)] pt-4 text-[12px] leading-relaxed text-[color:var(--pro-muted)]">
          Safari uses these two quick steps on iPhone and iPad. RitaJet will then open like an app.
        </p>
      </div>
    </div>
  );
}

/** Small "Install app" button, safe to place anywhere. Renders nothing when unavailable. */
export function InstallAppButton({ className }: { className?: string }) {
  const { mode, install } = useInstallApp();
  const [sheet, setSheet] = useState(false);
  if (!mode) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => (mode === "ios" ? setSheet(true) : install())}
        className={
          className ??
          "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
        }
      >
        <Download size={16} className="text-cyan-600" />
        Install app
      </button>
      {sheet && <IosSheet onClose={() => setSheet(false)} />}
    </>
  );
}

/** Dismissible bottom banner for mobile visitors on the home page. */
export function InstallAppBanner() {
  const { mode, install } = useInstallApp();
  const [dismissed, setDismissed] = useState(true);
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  function close() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  if (!mode || dismissed) return null;

  return (
    <>
      <div className="fixed inset-x-3 bottom-3 z-[150] sm:hidden">
        <div className="rita-install-banner flex items-center gap-3 rounded-[24px] border p-3 shadow-xl">
          <RitaFace size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-black text-[color:var(--pro-ink)]">Keep RitaJet close</p>
            <p className="truncate text-[12px] text-[color:var(--pro-muted)]">Open it from your Home Screen.</p>
          </div>
          <button
            type="button"
            onClick={() => (mode === "ios" ? setSheet(true) : install())}
            className="rita-btn rita-btn-primary !h-9 !px-4 !text-[13px]"
          >
            Add
          </button>
          <button
            type="button"
            onClick={close}
            aria-label="Dismiss"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[color:var(--pro-muted)] transition-colors hover:bg-[color:var(--rita-green-soft)]"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      {sheet && <IosSheet onClose={() => setSheet(false)} />}
    </>
  );
}
