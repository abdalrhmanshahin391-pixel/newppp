import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, CircleHelp, Loader2, RefreshCw, X } from "lucide-react";
import { adminLessonEngineCheck } from "@/lib/rita-curriculum.functions";
import { explainEngine, type EngineVerdict } from "@/lib/rita-engine-check";

/**
 * "Will the learner get the exercises?" in plain steps, for the admin. When a step fails the learner
 * quietly gets the spoken lesson, so this says which step and what to do about it.
 */
export function EngineCheck({
  lessonId,
  refreshKey = "",
  title = "هل الطالب رح يشوف التمارين؟",
}: {
  lessonId: string;
  /** Changes when the exercises or the lesson change, so the check is read again. */
  refreshKey?: string;
  title?: string;
}) {
  const checkFn = useServerFn(adminLessonEngineCheck);
  const [result, setResult] = useState<EngineVerdict | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setResult(explainEngine(await checkFn({ data: { lessonId } })));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ما قدرنا نفحص");
    } finally {
      setBusy(false);
    }
  }, [checkFn, lessonId]);

  useEffect(() => {
    void run();
  }, [run, refreshKey]);

  const ok = result?.verdict === "exercises";
  return (
    <section
      dir="rtl"
      aria-label={title}
      className={`space-y-2 rounded-xl border p-3 text-[14px] ${
        result === null
          ? "border-[var(--pp-line)]"
          : ok
            ? "border-[#bfe0c8] bg-[#f1f9f3]"
            : "border-[#f0cf9a] bg-[#fff8ec]"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="me-auto font-bold">{title}</p>
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy}
          className="rita-btn rita-btn-quiet rita-btn-sm gap-1.5"
        >
          {busy ? (
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw size={14} aria-hidden="true" />
          )}
          افحص
        </button>
      </div>
      {error && (
        <p role="alert" className="font-semibold text-[#8c1a31]">
          {error}
        </p>
      )}
      {result && (
        <>
          <p className="font-semibold">
            {ok ? "نعم: " : "لا، بيكمل الدرس صوتي بدون تمارين. "}
            <span className="font-normal">{result.reason}</span>
          </p>
          <ul className="space-y-1">
            {result.steps.map((step) => (
              <li key={step.id} className="flex items-start gap-2">
                {step.state === "ok" ? (
                  <Check size={16} className="mt-0.5 shrink-0 text-[#1d6b3a]" aria-label="تمام" />
                ) : step.state === "fail" ? (
                  <X size={16} className="mt-0.5 shrink-0 text-[#8c1a31]" aria-label="ناقص" />
                ) : (
                  <CircleHelp
                    size={16}
                    className="mt-0.5 shrink-0 text-[var(--pp-muted)]"
                    aria-label="لسا"
                  />
                )}
                <span className={step.state === "fail" ? "font-semibold" : ""}>{step.label}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
