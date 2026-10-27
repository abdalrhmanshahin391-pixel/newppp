import { Download, ExternalLink, Loader2, RotateCcw, Square } from "lucide-react";
import { toast } from "sonner";
import { describeGuideError, guideMeta, isBusy } from "@/lib/guides/guide-record";
import type { GuideListItem } from "@/lib/guides/guides.functions";
import { errorText } from "./book-utils";
import type { useGuides } from "./useGuides";

type Guides = ReturnType<typeof useGuides>;

const STAGE_LABEL = { writing: "الكتابة…", rendering: "الرسم…" } as const;

function Chip({ tone, children }: { tone: "draft" | "busy" | "fail"; children: React.ReactNode }) {
  const style =
    tone === "draft"
      ? "bg-[#fff1d6] text-[#7a4f00]"
      : tone === "busy"
        ? "bg-[var(--pp-accent-soft)] text-[var(--pp-accent-text)]"
        : "bg-[#fbe1e1] text-[#8c1a31]";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[12.5px] font-bold ${style}`}>
      {children}
    </span>
  );
}

/**
 * The always-visible list of PDF guides for this book (admin only). Newest first, with progress
 * while one is being made, and Open / Download / Make again on each finished one.
 */
export function GuidesPanel({ guides }: { guides: Guides }) {
  const { loaded, ready, listError, running } = guides;

  async function act(task: () => Promise<unknown>) {
    try {
      await task();
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  return (
    <section
      className="space-y-3 border-t border-[var(--pp-line)] pt-5"
      aria-labelledby="guides-title"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="guides-title" className="text-[19px] font-bold">
          أدلة PDF
        </h3>
        {running && (
          <button
            type="button"
            onClick={guides.cancel}
            className="rita-btn rita-btn-soft rita-btn-sm gap-2"
          >
            <Square size={13} fill="currentColor" aria-hidden="true" />
            إيقاف بعد الدليل الحالي
          </button>
        )}
      </div>
      <p className="text-[14px] text-[var(--pp-muted)]">
        كل دليل مسودة بتراجعها قبل ما تعتمدها. الملفات إلك إنت (الأدمن) بس، وما بتظهر للطلاب.
      </p>

      {!loaded ? (
        <p role="status" className="flex items-center gap-2 text-[14px] text-[var(--pp-muted)]">
          <Loader2 size={15} className="animate-spin" aria-hidden="true" /> جاري التحميل…
        </p>
      ) : !ready ? (
        <p className="rounded-xl bg-[#fff6e5] p-3 text-[14px] text-[#6b4100]">
          الأدلة لسا مش جاهزة: طبّق الميجريشن <bdi dir="ltr">20261027120000_rita_lesson_guides</bdi>{" "}
          ثم حدّث الصفحة.
        </p>
      ) : listError ? (
        <p className="text-[14px] text-[#8c1a31]">{listError}</p>
      ) : guides.guides.length === 0 ? (
        <p className="rounded-xl bg-[var(--pp-grey)] p-3 text-[14px]">
          ما في أدلة بعد. حدّد درس من الأعلى واضغط «اصنع دليل PDF».
        </p>
      ) : (
        <ul className="space-y-2">
          {guides.guides.map((guide) => (
            <GuideRowView key={guide.id} guide={guide} guides={guides} act={act} />
          ))}
        </ul>
      )}
    </section>
  );
}

function GuideRowView({
  guide,
  guides,
  act,
}: {
  guide: GuideListItem;
  guides: Guides;
  act: (task: () => Promise<unknown>) => Promise<void>;
}) {
  const live = guides.progress[guide.id];
  const stage =
    live && (live.stage === "writing" || live.stage === "rendering") ? live.stage : null;
  const busy = stage !== null || isBusy(guide.status);
  const failed = guide.status === "failed";
  const disabled = guides.running;

  return (
    <li className="rounded-xl border border-[var(--pp-line)] p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-[16px] font-semibold">
            <bdi dir="ltr">{guide.title}</bdi>
            {busy ? (
              <Chip tone="busy">{stage ? STAGE_LABEL[stage] : "جاري العمل…"}</Chip>
            ) : failed ? (
              <Chip tone="fail">ما زبط</Chip>
            ) : (
              <Chip tone="draft">مسودة</Chip>
            )}
          </p>
          <p className="mt-0.5 text-[13.5px] text-[var(--pp-muted)]">
            {guideMeta(guide)} · نسخة {guide.version}
          </p>
          {failed && (
            <div className="mt-1 space-y-0.5">
              <p className="text-[14px] font-semibold text-[#8c1a31]">
                {live?.message ?? describeGuideError(guide.error_code)}
              </p>
              {(live?.detail || guide.error_message) && (
                <p className="break-words text-[12.5px] text-[var(--pp-muted)]" dir="ltr">
                  {live?.detail || guide.error_message}
                </p>
              )}
            </div>
          )}
          {guide.warnings.length > 0 && guide.status === "ready" && (
            <details className="mt-1 text-[13.5px]">
              <summary className="cursor-pointer font-semibold">
                ملاحظات المراجعة ({guide.warnings.length})
              </summary>
              <ul className="mt-1 list-disc space-y-0.5 ps-5" dir="ltr">
                {guide.warnings.map((warning, index) => (
                  <li key={index}>
                    <b>{warning.severity}</b>
                    {warning.block ? ` (${warning.block})` : ""}: {warning.problem}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          {busy ? (
            <Loader2
              size={18}
              className="animate-spin text-[var(--pp-accent-text)]"
              aria-hidden="true"
            />
          ) : guide.status === "ready" ? (
            <>
              <button
                type="button"
                className="rita-btn rita-btn-primary rita-btn-sm gap-1.5"
                onClick={() => void act(() => guides.openFile(guide, false))}
              >
                <ExternalLink size={15} aria-hidden="true" />
                فتح
              </button>
              <button
                type="button"
                className="rita-btn rita-btn-soft rita-btn-sm gap-1.5"
                onClick={() => void act(() => guides.openFile(guide, true))}
              >
                <Download size={15} aria-hidden="true" />
                تنزيل
              </button>
              <button
                type="button"
                disabled={disabled}
                className="rita-btn rita-btn-quiet rita-btn-sm gap-1.5"
                onClick={() => void act(() => guides.remake(guide))}
              >
                <RotateCcw size={15} aria-hidden="true" />
                أعد الصنع
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={disabled}
              className="rita-btn rita-btn-primary rita-btn-sm gap-1.5"
              onClick={() => void act(() => guides.retry(guide))}
            >
              <RotateCcw size={15} aria-hidden="true" />
              أعد المحاولة
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
