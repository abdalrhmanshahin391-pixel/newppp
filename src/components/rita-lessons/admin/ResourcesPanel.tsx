import { useRef, useState } from "react";
import type { DragEvent, ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/legacy-client";
import {
  adminAddResource,
  adminDeleteResource,
  adminReorderResources,
  adminResourceLink,
  adminUpdateResource,
} from "@/lib/rita-curriculum.functions";
import {
  KIND_LABEL_AR,
  MAX_RESOURCES,
  RESOURCES_BUCKET,
  canAddResource,
  formatBytes,
  hasPdfSignature,
  hostLabel,
  looksLikeVideo,
  moveResource,
  normaliseUrl,
  pdfProblem,
  pdfStoragePath,
  sortResources,
  titleFromFileName,
  titleFromUrl,
  type Resource,
  type ResourceKind,
} from "@/lib/rita-resources";

const field =
  "w-full rounded-lg border-2 border-[var(--pp-ink)] bg-white px-3 py-2 text-sm text-[var(--pp-ink)]";
const button =
  "inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg border-2 border-[var(--pp-ink)] px-3 text-sm font-semibold disabled:opacity-50";
const iconButton =
  "grid h-10 w-10 place-items-center rounded-lg border-2 border-transparent text-[var(--pp-ink)] hover:border-[var(--pp-ink)] disabled:opacity-40 disabled:hover:border-transparent";

const KIND_ICON: Record<ResourceKind, ReactNode> = {
  pdf: <FileText size={20} aria-hidden="true" />,
  link: <Link2 size={20} aria-hidden="true" />,
  video: <Video size={20} aria-hidden="true" />,
};

function message(error: unknown) {
  return error instanceof Error ? error.message : "حدث خطأ غير متوقع";
}

type Pending =
  | { kind: "pdf"; file: File; title: string; note: string }
  | { kind: "link" | "video"; url: string; title: string; note: string };

/**
 * Resources for one lesson: PDF summaries, helper videos and links, added in a
 * few seconds and shown to the learner next to the lesson. Pending state is only
 * the item being added; the saved list always comes from the server.
 */
export function ResourcesPanel({
  lessonId,
  ready,
  resources,
  onChanged,
}: {
  lessonId: string;
  ready: boolean;
  resources: Resource[];
  onChanged: () => Promise<void>;
}) {
  const addFn = useServerFn(adminAddResource);
  const updateFn = useServerFn(adminUpdateResource);
  const deleteFn = useServerFn(adminDeleteResource);
  const reorderFn = useServerFn(adminReorderResources);
  const linkFn = useServerFn(adminResourceLink);

  const list = sortResources(resources);
  const full = !canAddResource(list.length);
  const [pending, setPending] = useState<Pending | null>(null);
  const [urlText, setUrlText] = useState("");
  const [urlError, setUrlError] = useState("");
  const [fileError, setFileError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [dragging, setDragging] = useState(false);
  const [editId, setEditId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editNote, setEditNote] = useState("");
  const [confirmId, setConfirmId] = useState("");
  const fileInput = useRef<HTMLInputElement | null>(null);

  if (!ready) {
    return (
      <p className="rounded-2xl border-2 border-dashed border-[var(--pp-line)] p-5 text-center text-sm font-semibold text-[var(--pp-muted)]">
        المراجع تحتاج تطبيق تحديث قاعدة البيانات (migration 20261017180000) في Lovable Cloud.
      </p>
    );
  }

  async function pickFile(file: File | undefined) {
    setFileError("");
    if (!file) return;
    const problem = pdfProblem(file);
    if (problem) {
      setFileError(problem);
      return;
    }
    const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    if (!hasPdfSignature(head)) {
      setFileError("هذا الملف ليس PDF حقيقيًا.");
      return;
    }
    setUrlError("");
    setPending({ kind: "pdf", file, title: titleFromFileName(file.name), note: "" });
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    if (full || saving) return;
    void pickFile(event.dataTransfer.files?.[0]);
  }

  function startLink() {
    setUrlError("");
    const url = normaliseUrl(urlText);
    if (!url) {
      setUrlError("اكتب رابطًا صحيحًا يبدأ بـ https");
      return;
    }
    setFileError("");
    setPending({
      kind: looksLikeVideo(url) ? "video" : "link",
      url,
      title: titleFromUrl(url),
      note: "",
    });
  }

  async function save() {
    if (!pending || saving) return;
    const title = pending.title.trim();
    if (!title) {
      toast.error("اكتب عنوانًا للمرجع");
      return;
    }
    setSaving(true);
    let uploaded = "";
    try {
      if (pending.kind === "pdf") {
        uploaded = pdfStoragePath(lessonId, crypto.randomUUID());
        const upload = await supabase.storage
          .from(RESOURCES_BUCKET)
          .upload(uploaded, pending.file, { contentType: "application/pdf" });
        if (upload.error) throw new Error(`رفع الملف فشل: ${upload.error.message}`);
        await addFn({
          data: {
            lessonId,
            resource: {
              kind: "pdf",
              title,
              note: pending.note.trim(),
              file_path: uploaded,
              file_name: pending.file.name.slice(0, 200),
              file_size: pending.file.size,
            },
          },
        });
      } else {
        await addFn({
          data: {
            lessonId,
            resource: {
              kind: pending.kind,
              title,
              note: pending.note.trim(),
              url: pending.url,
            },
          },
        });
      }
      toast.success("أُضيف المرجع");
      setPending(null);
      setUrlText("");
      await onChanged();
    } catch (error) {
      // A file that was uploaded but not recorded would sit in storage unseen.
      if (uploaded) await supabase.storage.from(RESOURCES_BUCKET).remove([uploaded]);
      toast.error(message(error));
    } finally {
      setSaving(false);
    }
  }

  async function guarded(id: string, task: () => Promise<unknown>, done?: string) {
    setBusyId(id);
    try {
      await task();
      if (done) toast.success(done);
      await onChanged();
    } catch (error) {
      toast.error(message(error));
    } finally {
      setBusyId("");
    }
  }

  async function open(resource: Resource) {
    setBusyId(resource.id);
    try {
      const { href } = await linkFn({ data: { id: resource.id } });
      window.open(href, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(message(error));
    } finally {
      setBusyId("");
    }
  }

  function startEdit(resource: Resource) {
    setEditId(resource.id);
    setEditTitle(resource.title);
    setEditNote(resource.note);
    setConfirmId("");
  }

  const disabledAll = saving || Boolean(busyId);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-base font-bold">مراجع الدرس</h3>
          <p className="text-sm font-semibold text-[var(--pp-muted)]" aria-live="polite">
            {list.length} / {MAX_RESOURCES}
          </p>
        </div>
        <p className="mt-1 text-sm text-[var(--pp-muted)]">
          ملخص PDF، فيديو مساعد أو رابط. تظهر للطالب مع الدرس، وهي اختيارية دائمًا.
        </p>
      </div>

      {full ? (
        <p className="rounded-xl border-2 border-[var(--pp-line)] bg-[var(--pp-grey)] px-4 py-3 text-sm font-semibold">
          وصل الدرس إلى الحد الأقصى ({MAX_RESOURCES}). احذف مرجعًا لإضافة غيره.
        </p>
      ) : (
        !pending && (
          <div className="grid gap-3 md:grid-cols-2">
            <label
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed p-5 text-center focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--pp-ink)] ${
                dragging
                  ? "border-[var(--pp-ink)] bg-[var(--pp-accent-soft)]"
                  : "border-[var(--pp-line)] bg-white hover:border-[var(--pp-ink)]"
              }`}
            >
              <Upload size={22} aria-hidden="true" />
              <span className="text-sm font-bold">ارفع ملف PDF</span>
              <span className="text-xs text-[var(--pp-muted)]">
                اسحبه هنا أو اضغط للاختيار. حتى 15 ميغابايت.
              </span>
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={(event) => {
                  void pickFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>

            <form
              className="flex flex-col justify-center gap-2 rounded-2xl border-2 border-[var(--pp-line)] bg-white p-5"
              onSubmit={(event) => {
                event.preventDefault();
                startLink();
              }}
            >
              <label htmlFor="resource-url" className="text-sm font-bold">
                أضف رابطًا أو فيديو
              </label>
              <div className="flex gap-2">
                <input
                  id="resource-url"
                  dir="ltr"
                  inputMode="url"
                  autoComplete="off"
                  value={urlText}
                  onChange={(event) => {
                    setUrlText(event.target.value);
                    setUrlError("");
                  }}
                  placeholder="https://youtube.com/watch?v=…"
                  aria-invalid={urlError ? true : undefined}
                  aria-describedby={urlError ? "resource-url-error" : undefined}
                  className={field}
                />
                <button type="submit" className={`${button} shrink-0 bg-white`}>
                  <Plus size={16} aria-hidden="true" />
                  أضف
                </button>
              </div>
              {urlError && (
                <p
                  id="resource-url-error"
                  role="alert"
                  className="text-xs font-semibold text-red-700"
                >
                  {urlError}
                </p>
              )}
            </form>
          </div>
        )
      )}
      {fileError && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {fileError}
        </p>
      )}

      {pending && (
        <form
          className="space-y-3 rounded-2xl border-2 border-[var(--pp-ink)] bg-[var(--pp-accent-soft)] p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border-2 border-[var(--pp-ink)] bg-white">
              {KIND_ICON[pending.kind]}
            </span>
            <p className="min-w-0 flex-1 truncate text-sm font-semibold" dir="ltr">
              {pending.kind === "pdf"
                ? `${pending.file.name} · ${formatBytes(pending.file.size)}`
                : hostLabel(pending.url)}
            </p>
            <button
              type="button"
              onClick={() => setPending(null)}
              disabled={saving}
              aria-label="إلغاء الإضافة"
              className={iconButton}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          {pending.kind !== "pdf" && (
            <fieldset className="flex gap-2">
              <legend className="sr-only">نوع المرجع</legend>
              {(["link", "video"] as const).map((kind) => (
                <label
                  key={kind}
                  className={`inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-lg border-2 border-[var(--pp-ink)] px-3 text-sm font-semibold focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--pp-ink)] ${
                    pending.kind === kind ? "bg-[var(--pp-ink)] text-white" : "bg-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="resource-kind"
                    className="sr-only"
                    checked={pending.kind === kind}
                    onChange={() => setPending({ ...pending, kind })}
                  />
                  {KIND_ICON[kind]}
                  {KIND_LABEL_AR[kind]}
                </label>
              ))}
            </fieldset>
          )}

          <div>
            <label htmlFor="resource-title" className="mb-1 block text-sm font-bold">
              العنوان
            </label>
            <input
              id="resource-title"
              value={pending.title}
              maxLength={160}
              onChange={(event) => setPending({ ...pending, title: event.target.value })}
              className={field}
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="resource-note" className="mb-1 block text-sm font-bold">
              متى يستعمله الطالب؟{" "}
              <span className="font-normal text-[var(--pp-muted)]">(اختياري)</span>
            </label>
            <input
              id="resource-note"
              value={pending.note}
              maxLength={300}
              onChange={(event) => setPending({ ...pending, note: event.target.value })}
              placeholder="مثلًا: اقرأه قبل بدء الدرس"
              className={field}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className={`${button} bg-[var(--pp-accent)] text-[var(--pp-on-accent)]`}
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  {pending.kind === "pdf" ? "جارٍ الرفع…" : "جارٍ الحفظ…"}
                </>
              ) : (
                "إضافة إلى الدرس"
              )}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setPending(null)}
              className={`${button} bg-white`}
            >
              إلغاء
            </button>
          </div>
        </form>
      )}

      {list.length === 0 ? (
        !pending && (
          <p className="rounded-2xl border-2 border-dashed border-[var(--pp-line)] p-6 text-center text-sm font-semibold text-[var(--pp-muted)]">
            لا مراجع لهذا الدرس بعد. أضف ملخصًا أو فيديو يساعد الطالب، أو اترك الدرس كما هو.
          </p>
        )
      ) : (
        <ol className="space-y-2">
          {list.map((resource, index) => {
            const editing = editId === resource.id;
            const confirming = confirmId === resource.id;
            const busy = busyId === resource.id;
            const meta =
              resource.kind === "pdf"
                ? `${KIND_LABEL_AR[resource.kind]} · ${formatBytes(resource.file_size ?? 0)}`
                : `${KIND_LABEL_AR[resource.kind]} · ${hostLabel(resource.url ?? "")}`;
            return (
              <li
                key={resource.id}
                className="rounded-2xl border-2 border-[var(--pp-line)] bg-white p-3"
              >
                {editing ? (
                  <form
                    className="space-y-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!editTitle.trim()) {
                        toast.error("اكتب عنوانًا للمرجع");
                        return;
                      }
                      void guarded(
                        resource.id,
                        async () => {
                          await updateFn({
                            data: {
                              id: resource.id,
                              edit: { title: editTitle.trim(), note: editNote.trim() },
                            },
                          });
                          setEditId("");
                        },
                        "حُفظ التعديل",
                      );
                    }}
                  >
                    <label
                      className="block text-sm font-bold"
                      htmlFor={`edit-title-${resource.id}`}
                    >
                      العنوان
                    </label>
                    <input
                      id={`edit-title-${resource.id}`}
                      value={editTitle}
                      maxLength={160}
                      onChange={(event) => setEditTitle(event.target.value)}
                      className={field}
                      autoFocus
                    />
                    <label className="block text-sm font-bold" htmlFor={`edit-note-${resource.id}`}>
                      ملاحظة للطالب
                    </label>
                    <input
                      id={`edit-note-${resource.id}`}
                      value={editNote}
                      maxLength={300}
                      onChange={(event) => setEditNote(event.target.value)}
                      className={field}
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={busy}
                        className={`${button} bg-[var(--pp-accent)] text-[var(--pp-on-accent)]`}
                      >
                        {busy ? (
                          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                        ) : (
                          "حفظ"
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditId("")}
                        className={`${button} bg-white`}
                      >
                        إلغاء
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border-2 border-[var(--pp-ink)] bg-white">
                      {KIND_ICON[resource.kind]}
                    </span>
                    <div className="min-w-[11rem] flex-1">
                      <p className="[overflow-wrap:anywhere] text-sm font-bold leading-snug">
                        {resource.title}
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-[var(--pp-muted)]" dir="auto">
                        {meta}
                      </p>
                      {resource.note && (
                        <p className="mt-1 [overflow-wrap:anywhere] text-sm text-[var(--pp-muted)]">
                          {resource.note}
                        </p>
                      )}
                      {confirming && (
                        <div
                          role="alertdialog"
                          aria-label={`حذف ${resource.title}`}
                          className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-[var(--pp-grey)] px-3 py-2"
                        >
                          <span className="text-sm font-semibold">
                            حذف هذا المرجع نهائيًا{resource.kind === "pdf" ? " مع ملفه" : ""}؟
                          </span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void guarded(
                                resource.id,
                                async () => {
                                  await deleteFn({ data: { id: resource.id } });
                                  setConfirmId("");
                                },
                                "حُذف المرجع",
                              )
                            }
                            className={`${button} bg-[var(--pp-ink)] text-white`}
                          >
                            احذف
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmId("")}
                            className={`${button} bg-white`}
                          >
                            ألغِ
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="ms-auto flex shrink-0 flex-wrap justify-end gap-0.5">
                      {busy && (
                        <Loader2 size={16} className="m-3 animate-spin" aria-hidden="true" />
                      )}
                      <button
                        type="button"
                        onClick={() => void open(resource)}
                        disabled={disabledAll}
                        aria-label={`فتح ${resource.title}`}
                        className={iconButton}
                      >
                        <ExternalLink size={18} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(resource)}
                        disabled={disabledAll}
                        aria-label={`تعديل ${resource.title}`}
                        className={iconButton}
                      >
                        <Pencil size={18} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void guarded(resource.id, () =>
                            reorderFn({
                              data: {
                                lessonId,
                                ids: moveResource(list, resource.id, "up").map((item) => item.id),
                              },
                            }),
                          )
                        }
                        disabled={disabledAll || index === 0}
                        aria-label={`رفع ${resource.title} للأعلى`}
                        className={iconButton}
                      >
                        <ArrowUp size={18} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void guarded(resource.id, () =>
                            reorderFn({
                              data: {
                                lessonId,
                                ids: moveResource(list, resource.id, "down").map((item) => item.id),
                              },
                            }),
                          )
                        }
                        disabled={disabledAll || index === list.length - 1}
                        aria-label={`إنزال ${resource.title} للأسفل`}
                        className={iconButton}
                      >
                        <ArrowDown size={18} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(resource.id)}
                        disabled={disabledAll}
                        aria-label={`حذف ${resource.title}`}
                        className={iconButton}
                      >
                        <Trash2 size={18} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
