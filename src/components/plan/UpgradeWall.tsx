import { Link } from "@tanstack/react-router";
import { Lock, Sparkles, X } from "lucide-react";
import type { GateBlock } from "@/hooks/usePlanGate";

/**
 * Shown BEFORE any file is accepted, so a student never uploads a PDF that
 * their plan would refuse (and no AI credit is spent on a blocked run).
 */
export function UpgradeWall({ block, onClose }: { block: GateBlock | null; onClose: () => void }) {
  if (!block) return null;

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-background/80 text-muted-foreground hover:text-foreground"
        >
          <X size={16} />
        </button>

        <div className="relative h-40 overflow-hidden bg-gradient-to-br from-primary/25 via-primary/10 to-transparent">
          <div className="absolute inset-0 grid place-items-center">
            <div className="grid h-20 w-20 place-items-center rounded-3xl bg-primary/15 text-primary">
              {block.reason === "feature" ? <Lock size={30} /> : <Sparkles size={30} />}
            </div>
          </div>
        </div>

        <div className="p-6 text-center">
          <h2 className="font-display text-xl font-black tracking-tight">{block.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{block.message}</p>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Link
              to="/pricing"
              className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-primary px-6 text-sm font-black text-primary-foreground"
            >
              See plans
            </Link>
            <button
              onClick={onClose}
              className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-border px-6 text-sm font-bold"
            >
              Not now
            </button>
          </div>
          <Link to="/my-plan" className="mt-3 inline-block text-xs font-bold text-muted-foreground underline">
            See what's left in my plan
          </Link>
        </div>
      </div>
    </div>
  );
}
