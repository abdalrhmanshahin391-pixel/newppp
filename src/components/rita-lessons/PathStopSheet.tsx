import { useWorkspaceTask, useWorkspaceGuard } from "./admin/WorkspaceGuard";
import { PathQuiz } from "./PathQuiz";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, FileText, Link2, Loader2, Trash2, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/legacy-client";
import {
  adminAddPathItemResource,
  adminDeletePathItem,
  adminDeletePathItemResource,
  adminRenamePathItem,
  getPathItemResources,
} from "@/lib/rita-path-items.functions";
import { pathItemPdfPath, pathItemTitle, type PathItem } from "@/lib/rita-path-layout";
import {
  MAX_PDF_BYTES,
  RESOURCES_BUCKET,
  normaliseUrl,
  titleFromFileName,
  titleFromUrl,
  type LearnerResource,
} from "@/lib/rita-resources";

const message = (cause: unknown) =>
  cause instanceof Error ? cause.message : "ما زبطت. جرّب مرة ثانية.";

/**
 * The sheet of one stop on the path. A learner sees a resources stop's files and links and opens
 * them. An admin also renames or removes the stop and adds or removes its files and links.
 */
export function PathStopSheet({
  item,
  embedded = false,
  admin,
  color,
  onClose,
  onChanged,
}: {
  item: PathItem;
  embedded?: boolean;
  admin: boolean;
  color: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const listFn = useServerFn(getPathItemResources);
  const addFn = useServerFn(adminAddPathItemResource);
  const removeFn = useServerFn(adminDeletePathItemResource);
  const renameFn = useServerFn(adminRenamePathItem);
  const deleteFn = useServerFn(adminDeletePathItem);
  const [resources, setResources] = useState<LearnerResource[] | null>(
    item.kind === "resources" ? null : [],
  );
  const [title, setTitle] = useState(pathItemTitle(item));
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const finishTask = useWorkspaceTask(busy);
  const guard = useWorkspaceGuard();
  const file = useRef<HTMLInputElement>(null);

  async function load() {
    if (item.kind !== "resources") return;
    try {
      setResources(await listFn({ data: { id: item.id } }));
    } catch (cause) {
      setResources([]);
      toast.error(message(cause));
    }
  }

  useEffect(() => {
    void load();
    const onKey = (event: KeyboardEvent) => !embedded && event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  async function run(work: () => Promise<unknown>, done?: string) {
    setBusy(true);
    try {
      await work();
      if (done) toast.success(done);
      await load();
      await onChanged();
    } catch (cause) {
      toast.error(message(cause));
    } finally {
      setBusy(false);
    }
  }

  async function addLink() {
    const clean = normaliseUrl(url);
    if (!clean) return void toast.error("الرابط لازم يكون https وصحيح.");
    await run(async () => {
      await addFn({
        data: {
          itemId: item.id,
          resource: { kind: "link", url: clean, title: titleFromUrl(clean), note: "" },
        },
      });
      setUrl("");
    }, "انضاف الرابط");
  }

  async function addPdf(picked: File) {
    if (picked.type !== "application/pdf") return void toast.error("الملف لازم يكون PDF.");
    if (picked.size > MAX_PDF_BYTES) return void toast.error("الملف أكبر من 15 ميجا.");
    await run(async () => {
      const path = pathItemPdfPath(item.id, crypto.randomUUID());
      const uploaded = await supabase.storage
        .from(RESOURCES_BUCKET)
        .upload(path, picked, { contentType: "application/pdf", upsert: false });
      if (uploaded.error) throw new Error(uploaded.error.message);
      await addFn({
        data: {
          itemId: item.id,
          resource: {
            kind: "pdf",
            file_path: path,
            file_name: picked.name.slice(0, 200),
            file_size: picked.size,
            title: titleFromFileName(picked.name).slice(0, 160) || "ملف",
            note: "",
          },
        },
      });
    }, "انضاف الملف");
  }

  const settings = admin && (
    <div className="lp-sheet-admin">
      {item.kind === "resources" && (
        <>
          <div className="lp-sheet-row">
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://… رابط"
              dir="ltr"
              aria-label="رابط جديد"
            />
            <button type="button" disabled={busy || !url.trim()} onClick={() => void addLink()}>
              <Link2 size={16} /> أضف
            </button>
          </div>
          <button
            type="button"
            className="lp-sheet-wide"
            disabled={busy}
            onClick={() => file.current?.click()}
          >
            <Upload size={16} /> ارفع ملف PDF
          </button>
          <input
            ref={file}
            type="file"
            accept="application/pdf"
            hidden
            onChange={(event) => {
              const picked = event.target.files?.[0];
              event.target.value = "";
              if (picked) void addPdf(picked);
            }}
          />
        </>
      )}
      {item.kind !== "finish" && (
        <div className="lp-sheet-row">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-label="اسم المحطة"
            maxLength={120}
          />
          <button
            type="button"
            disabled={busy || !title.trim() || title.trim() === pathItemTitle(item)}
            onClick={() =>
              void run(async () => {
                await renameFn({ data: { id: item.id, title: title.trim() } });
                guard?.saved();
              }, "انحفظ الاسم")
            }
          >
            احفظ الاسم
          </button>
        </div>
      )}
      <button
        type="button"
        className="lp-sheet-wide is-danger"
        disabled={busy}
        onClick={() => {
          if (!window.confirm("أكيد بدك تحذف هالمحطة من المسار؟")) return;
          void run(async () => {
            await deleteFn({ data: { id: item.id } });
            finishTask();
            guard?.saved();
            onClose();
          }, "انحذفت المحطة");
        }}
      >
        <Trash2 size={16} /> احذف المحطة
      </button>
    </div>
  );
  return (
    <div
      className={embedded ? "pc-stop" : "lp-sheet-back"}
      onClick={embedded ? undefined : onClose}
    >
      <div
        className={item.kind === "exercises" ? "lp-sheet lp-quiz-sheet" : "lp-sheet"}
        role={embedded ? "region" : "dialog"}
        aria-modal={embedded ? undefined : true}
        aria-label={item.title}
        onClick={(event) => event.stopPropagation()}
        style={{ ["--c" as string]: color }}
      >
        <div className="lp-sheet-head">
          <span className="lp-sheet-dot" />
          <h3>{item.kind === "finish" ? `خط نهاية ${item.title}` : pathItemTitle(item)}</h3>
          {!embedded && (
            <button type="button" onClick={onClose} aria-label="سكّر" className="lp-sheet-x">
              <X size={18} />
            </button>
          )}
        </div>

        {item.kind === "finish" && (
          <p className="lp-sheet-empty">
            هون بيخلص المستوى {item.title}. اسحبه لمكان ثاني بوضع التعديل لتغيّر وين بيخلص.
          </p>
        )}

        {item.kind === "exercises" && (
          <PathQuiz
            key={item.id}
            settings={settings}
            item={item}
            admin={admin}
            onClose={onClose}
            onChanged={onChanged}
          />
        )}

        {item.kind === "resources" && (
          <div className="lp-sheet-list">
            {resources === null ? (
              <div className="grid place-items-center py-8">
                <Loader2 className="animate-spin" />
              </div>
            ) : resources.length === 0 ? (
              <p className="lp-sheet-empty">لسا ما في ملفات أو روابط هون.</p>
            ) : (
              resources.map((resource) => (
                <div key={resource.id} className="lp-res">
                  <a href={resource.href} target="_blank" rel="noopener noreferrer">
                    <span className="lp-res-icon">
                      {resource.kind === "pdf" ? <FileText size={18} /> : <Link2 size={18} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="lp-res-title">{resource.title}</span>
                      <span className="lp-res-host">{resource.host}</span>
                    </span>
                    <ExternalLink size={15} aria-hidden="true" />
                  </a>
                  {admin && (
                    <button
                      type="button"
                      aria-label={`احذف ${resource.title}`}
                      disabled={busy}
                      onClick={() =>
                        void run(() => removeFn({ data: { id: resource.id } }), "انحذف")
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {item.kind !== "exercises" && settings}
      </div>
    </div>
  );
}
