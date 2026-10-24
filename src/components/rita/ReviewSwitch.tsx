import { useEffect, useId, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Ui = "on" | "off";

/**
 * The one switch for Rita's AI analysis: on, every finished conversation is reviewed after the call;
 * off, nothing is sent to OpenAI. Only admins can read or change the setting, so for everybody else
 * this renders nothing.
 */
export function ReviewSwitch({
  showQualityLink = false,
  compact = false,
}: {
  showQualityLink?: boolean;
  /** A single line for the admin strip: the label, a short state and the switch. */
  compact?: boolean;
}) {
  const [state, setState] = useState<Ui | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const noteId = useId();

  useEffect(() => {
    let cancelled = false;
    // The table arrives with a migration; it is not in the generated types yet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (supabase as any)
      .from("rita_review_settings")
      .select("enabled")
      .eq("id", true)
      .maybeSingle()
      .then(({ data }: { data: { enabled?: boolean } | null }) => {
        if (!cancelled && data) setState(data.enabled ? "on" : "off");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state) return null;
  const on = state === "on";

  async function toggle() {
    if (saving) return;
    const next: Ui = on ? "off" : "on";
    setSaving(true);
    setError("");
    setState(next);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: saveError } = await (supabase as any)
      .from("rita_review_settings")
      .update({ enabled: next === "on", updated_at: new Date().toISOString() })
      .eq("id", true);
    if (saveError) {
      setState(on ? "on" : "off");
      setError("Could not change the setting. Try again.");
    }
    setSaving(false);
  }

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-describedby={noteId}
          aria-label="AI analysis of conversations"
          onClick={() => void toggle()}
          className="flex min-h-[44px] items-center gap-3 rounded-lg pe-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pp-ink)]"
        >
          <span aria-hidden="true" className="text-[15px] font-semibold">
            AI analysis
          </span>
          <span
            aria-hidden="true"
            className="relative h-7 w-12 shrink-0 rounded-full transition-colors duration-150"
            style={{ background: on ? "var(--pp-accent)" : "var(--pp-line)" }}
          >
            <span
              className="absolute top-1 grid h-5 w-5 place-items-center rounded-full bg-white shadow-sm transition-transform duration-150"
              style={{ insetInlineStart: 4, transform: `translateX(${on ? 20 : 0}px)` }}
            >
              {saving ? (
                <Loader2 size={12} className="animate-spin text-[var(--pp-muted)]" />
              ) : null}
            </span>
          </span>
        </button>
        <span id={noteId} className="text-[14px] text-[var(--pp-muted)]">
          {on ? "On: every finished conversation is reviewed" : "Off: nothing is sent for review"}
        </span>
        {error ? (
          <span role="alert" className="text-[14px] font-semibold text-[var(--pp-accent-text)]">
            {error}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-describedby={noteId}
        onClick={() => void toggle()}
        className="flex min-h-[64px] w-full items-center justify-between gap-4 rounded-2xl bg-[var(--pp-grey)] px-5 py-3 text-start transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pp-ink)]"
      >
        <span className="min-w-0">
          <span className="block text-[16px] font-semibold text-[var(--pp-ink)]">
            AI analysis of conversations
          </span>
          <span id={noteId} className="block text-[14px] leading-[1.4] text-[var(--pp-muted)]">
            {on
              ? "On: every finished conversation is reviewed by OpenAI."
              : "Off: nothing is sent for review."}
          </span>
        </span>
        <span
          aria-hidden="true"
          className="relative h-7 w-12 shrink-0 rounded-full transition-colors duration-150"
          style={{
            background: on ? "var(--pp-accent)" : "var(--pp-line)",
          }}
        >
          <span
            className="absolute top-1 grid h-5 w-5 place-items-center rounded-full bg-white shadow-sm transition-transform duration-150"
            style={{ insetInlineStart: 4, transform: `translateX(${on ? 20 : 0}px)` }}
          >
            {saving ? <Loader2 size={12} className="animate-spin text-[var(--pp-muted)]" /> : null}
          </span>
        </span>
      </button>
      {showQualityLink ? (
        <Link
          to="/admin/rita-quality"
          className="mt-2 inline-flex min-h-[44px] items-center text-[15px] font-semibold text-[var(--pp-accent-text)] underline-offset-4 hover:underline"
        >
          See what to fix next
        </Link>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-[14px] font-semibold text-[var(--pp-accent-text)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
