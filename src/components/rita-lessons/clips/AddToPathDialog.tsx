import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ClipLibrary } from "@/lib/film-clips.functions";
import { adminAddClipStop } from "@/lib/rita-path-items.functions";
import { ClipDialog } from "./ClipDialog";

const field = "min-h-11 w-full rounded-xl border border-[var(--pp-line)] px-3 font-normal";

/** Makes a new exercises stop of the ticked clips, after a chosen lesson or at the end of the path. */
export function AddToPathDialog({
  library,
  language,
  clipIds,
  onLanguage,
  onDone,
  onClose,
}: {
  library: ClipLibrary;
  language: string;
  clipIds: string[];
  onLanguage: (language: string) => void;
  onDone: () => Promise<void> | void;
  onClose: () => void;
}) {
  const addFn = useServerFn(adminAddClipStop);
  const [title, setTitle] = useState("تدريب مقاطع");
  const [after, setAfter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function add() {
    setBusy(true);
    setError("");
    try {
      await addFn({ data: { language, title: title.trim(), clipIds, after: after || null } });
      toast.success("انضافت المحطة للمسار");
      await onDone();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ما انضافت المحطة.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ClipDialog
      open
      title={`أضف ${clipIds.length} مقاطع للمسار`}
      onClose={() => !busy && onClose()}
      footer={
        <>
          <button
            type="button"
            className="rita-btn rita-btn-primary gap-1.5"
            disabled={busy || !title.trim() || clipIds.length === 0}
            onClick={() => void add()}
          >
            {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            أضف المحطة
          </button>
          <button
            type="button"
            className="rita-btn rita-btn-quiet ms-auto"
            disabled={busy}
            onClick={onClose}
          >
            إلغاء
          </button>
        </>
      }
    >
      <fieldset disabled={busy} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
        <label className="grid grid-cols-[minmax(0,1fr)] gap-1 text-[14px] font-semibold">
          اسم المحطة (بيشوفه الطالب)
          <input
            dir="auto"
            value={title}
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
            className={field}
          />
        </label>
        {library.languages.length > 1 && (
          <label className="grid grid-cols-[minmax(0,1fr)] gap-1 text-[14px] font-semibold">
            مسار أي لغة
            <select
              value={language}
              onChange={(event) => {
                setAfter("");
                onLanguage(event.target.value);
              }}
              className={field}
            >
              {library.languages.map((value) => (
                <option key={value} value={value}>
                  {value.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="grid grid-cols-[minmax(0,1fr)] gap-1 text-[14px] font-semibold">
          وين بالمسار
          <select
            value={after}
            onChange={(event) => setAfter(event.target.value)}
            className={field}
          >
            <option value="">بآخر المسار</option>
            {library.path.map((node, index) => (
              <option key={node.id} value={node.id}>
                بعد {index + 1}. {node.title}
                {node.type === "item" ? " (محطة)" : ""}
              </option>
            ))}
          </select>
        </label>
        <p className="text-[13px] text-[var(--pp-muted)]">
          الطالب بيشوف كل مقطع مرة، وبعدين التمارين: المعنى، ترتيب الكلمات، والنطق (للفيديو).
        </p>
        {error && (
          <p role="alert" className="rounded-xl bg-[#fbe9ed] p-3 text-[14px] text-[#8c1a31]">
            {error}
          </p>
        )}
      </fieldset>
    </ClipDialog>
  );
}
