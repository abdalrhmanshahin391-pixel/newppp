import { useState, type ReactNode } from "react";
import { useWorkspaceGuard, useWorkspaceTask } from "../WorkspaceGuard";
import type { LessonKind } from "@/lib/study/lesson-maker";
import { Link } from "@tanstack/react-router";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { useServerFn } from "@tanstack/react-start";
import { Eye, Loader2, MoreHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import type { LessonReadiness } from "@/lib/rita-book-flow";
import type { Objective } from "@/lib/rita-curriculum";
import {
  adminGenerateLessonImage,
  adminRegenerateObjective,
  adminSetLessonStatus,
  adminUpdateLesson,
  type LessonRow,
} from "@/lib/rita-curriculum.functions";
import type { Resource } from "@/lib/rita-resources";
import type { Slide } from "@/lib/rita-slides";
import { LessonForm } from "@/components/rita-lessons/LessonForm";
import { LessonImage } from "@/components/rita-lessons/LessonArt";
import { ResourcesPanel } from "@/components/rita-lessons/admin/ResourcesPanel";
import { StudyGuidePanel } from "@/components/rita-lessons/admin/StudyGuidePanel";
import { errorText, lessonToDraft, pagesLabel } from "./book-utils";
import { BidiText, LessonKindBadge, ReadinessChip } from "./BookBits";

/**
 * One book lesson, opened from the review list: its slides first (what the learner studies, with
 * Uzyra beside them), then its goals and plan, and its resources. Preview and publish are always at
 * the top. Book lessons have no exercises and no old talk-only slideshow any more.
 */
export type DrawerTab = "plan" | "resources" | "study";

export function LessonDrawer({
  lesson,
  embedded = false,
  initialTab = "study",
  studyLinked = false,
  kind,
  readiness,
  bookPublished,
  resources,
  resourcesReady,
  onClose,
  onChanged,
}: {
  lesson: LessonRow | null;
  embedded?: boolean;
  /** The part to open first (the lesson sheet's «تعديل» rows open their own part). */
  initialTab?: DrawerTab;
  /** A ready guide is linked: "preview" opens the study page, as learners will get it. */
  studyLinked?: boolean;
  /** Red (Uzyra's lesson) or green (guide + Uzyra), shown next to the state. */
  kind?: LessonKind;
  readiness: LessonReadiness;
  bookPublished: boolean;
  /** The old talk-only slideshow of a lesson: no longer shown for book lessons. */
  slides?: Record<string, Slide[]>;
  slidesReady?: boolean;
  slidesShared?: Record<string, boolean>;
  sharedReady?: boolean;
  resources: Record<string, Resource[]>;
  resourcesReady: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const statusFn = useServerFn(adminSetLessonStatus);
  const updateFn = useServerFn(adminUpdateLesson);
  const regenerateFn = useServerFn(adminRegenerateObjective);
  const imageFn = useServerFn(adminGenerateLessonImage);
  const [busy, setBusy] = useState("");
  const guard = useWorkspaceGuard();
  const finishTask = useWorkspaceTask(Boolean(busy));
  const [tab, setTab] = useState(initialTab);
  const Shell = embedded ? EmbeddedLessonShell : ModalLessonShell;
  const Title = embedded ? "h2" : Dialog.Title;
  // "Cancel" in the plan form puts the saved lesson back on screen.
  const [formEpoch, setFormEpoch] = useState(0);

  async function run(label: string, task: () => Promise<unknown>, done?: string) {
    setBusy(label);
    try {
      await task();
      if (done) toast.success(done);
      await onChanged();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy("");
    }
  }

  return (
    <Shell open={lesson !== null} onClose={onClose}>
      {lesson && (
        <>
          <header className="rita-ex-header space-y-3">
            <div className="flex items-start gap-3">
              <LessonImage src={lesson.image_url} alt="" className="h-14 w-14 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[var(--pp-muted)]">
                  درس {lesson.lesson_no} ·{" "}
                  {pagesLabel(lesson.source_from_page, lesson.source_to_page)}
                </p>
                <Title className="truncate text-[20px] font-bold leading-snug">
                  <BidiText text={lesson.title_ar || lesson.title} />
                </Title>
                <p className="truncate text-[14px] text-[var(--pp-muted)]">
                  <bdi dir="ltr">{lesson.title}</bdi>
                </p>
              </div>
              <button
                type="button"
                className="rita-btn rita-btn-quiet rita-btn-sm"
                aria-label="إغلاق"
                onClick={onClose}
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {kind && <LessonKindBadge kind={kind} />}
              <ReadinessChip state={readiness} />
              <span className="me-auto" />
              <Link
                to={studyLinked ? "/rita-study" : "/rita-live"}
                search={{ lesson: lesson.id, preview: true }}
                target="_blank"
                className="rita-btn rita-btn-soft rita-btn-sm gap-1.5"
              >
                <Eye size={15} aria-hidden="true" /> معاينة كطالب
              </Link>
              <button
                type="button"
                onClick={() => {
                  if (lesson.status === "published") {
                    void run(
                      "status",
                      () => statusFn({ data: { lessonId: lesson.id, status: "draft" } }),
                      "رجع الدرس مسودة",
                    );
                    return;
                  }
                  void run(
                    "status",
                    () => statusFn({ data: { lessonId: lesson.id, status: "published" } }),
                    bookPublished ? "انشر الدرس" : "انشر الدرس، وبيظهر للطلاب لما تنشر الكتاب",
                  );
                }}
                // A book lesson is its slides: without them there is nothing to publish.
                disabled={
                  Boolean(busy) || (lesson.status !== "published" && readiness === "no_slides")
                }
                title={
                  lesson.status !== "published" && readiness === "no_slides"
                    ? "الدرس بدون شرائح لسا. كمّله من المراجعة."
                    : undefined
                }
                className={`rita-btn rita-btn-sm gap-1.5 ${lesson.status === "published" ? "rita-btn-soft" : "rita-btn-primary"}`}
              >
                {busy === "status" && (
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                )}
                {lesson.status === "published" ? "إلغاء النشر" : "انشر الدرس"}
              </button>
              <Menu.Root dir="rtl">
                <Menu.Trigger asChild>
                  <button
                    type="button"
                    className="rita-btn rita-btn-quiet rita-btn-sm"
                    aria-label="المزيد"
                  >
                    <MoreHorizontal size={18} />
                  </button>
                </Menu.Trigger>
                <Menu.Portal>
                  <Menu.Content align="end" sideOffset={6} className="rita-menu edith-premium">
                    <Menu.Item
                      className="rita-menu-item"
                      disabled={Boolean(busy)}
                      onSelect={() =>
                        void run(
                          "image",
                          () => imageFn({ data: { lessonId: lesson.id } }),
                          "انعملت الصورة",
                        )
                      }
                    >
                      {lesson.image_url ? "صورة جديدة للدرس" : "اعمل صورة للدرس"}
                    </Menu.Item>
                    <Menu.Separator className="rita-menu-sep" />
                    <Menu.Item
                      className="rita-menu-item rita-menu-item-danger"
                      disabled={Boolean(busy)}
                      onSelect={() => {
                        if (!window.confirm("أرشفة هالدرس؟ بيختفي من مسار الطلاب.")) return;
                        void run(
                          "archive",
                          async () => {
                            await statusFn({
                              data: { lessonId: lesson.id, status: "archived" },
                            });
                            finishTask();
                            guard?.saved();
                            onClose();
                          },
                          "انأرشف الدرس",
                        );
                      }}
                    >
                      أرشفة الدرس
                    </Menu.Item>
                  </Menu.Content>
                </Menu.Portal>
              </Menu.Root>
            </div>
          </header>

          <Tabs.Root
            value={tab}
            onValueChange={(next) =>
              guard ? guard.leave(() => setTab(next as DrawerTab)) : setTab(next as DrawerTab)
            }
            className="flex min-h-0 flex-1 flex-col"
            dir="rtl"
          >
            <Tabs.List className="rita-tabs-list px-5" aria-label="أقسام الدرس">
              <Tabs.Trigger value="study" className="rita-tab">
                الشرائح
              </Tabs.Trigger>
              <Tabs.Trigger value="plan" className="rita-tab">
                الأهداف والخطة
              </Tabs.Trigger>
              <Tabs.Trigger value="resources" className="rita-tab">
                المراجع{resourcesReady ? ` (${resources[lesson.id]?.length ?? 0})` : ""}
              </Tabs.Trigger>
            </Tabs.List>
            <div className="rita-ex-body">
              <Tabs.Content value="plan" className="rita-tab-panel">
                <LessonForm
                  key={`${lesson.id}:${lesson.version}:${formEpoch}`}
                  initial={lessonToDraft(lesson)}
                  busy={Boolean(busy)}
                  onCancel={() => {
                    guard?.saved();
                    setFormEpoch((value) => value + 1);
                  }}
                  onSave={(draft) =>
                    void run(
                      "edit",
                      () => updateFn({ data: { lessonId: lesson.id, lesson: draft } }),
                      "انحفظ التعديل",
                    )
                  }
                  onRegenerateObjective={async (objective) => {
                    try {
                      const result = await regenerateFn({
                        data: { lessonId: lesson.id, objective },
                      });
                      return result.objective as Objective;
                    } catch (error) {
                      toast.error(errorText(error));
                      return null;
                    }
                  }}
                />
              </Tabs.Content>
              <Tabs.Content value="study" className="rita-tab-panel">
                <StudyGuidePanel key={lesson.id} lesson={lesson} onChanged={onChanged} />
              </Tabs.Content>
              <Tabs.Content value="resources" className="rita-tab-panel">
                <ResourcesPanel
                  key={lesson.id}
                  lessonId={lesson.id}
                  ready={resourcesReady}
                  resources={resources[lesson.id] ?? []}
                  onChanged={onChanged}
                />
              </Tabs.Content>
            </div>
          </Tabs.Root>
        </>
      )}
    </Shell>
  );
}

function EmbeddedLessonShell({
  children,
  open,
}: {
  children: ReactNode;
  open: boolean;
  onClose: () => void;
}) {
  return open ? (
    <div className="pc-lesson-editor" dir="rtl">
      {children}
    </div>
  ) : null;
}
function ModalLessonShell({
  children,
  open,
  onClose,
}: {
  children: ReactNode;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="rita-ex-overlay edith-premium" />
        <Dialog.Content
          className="rita-drawer edith-premium"
          dir="rtl"
          aria-describedby={undefined}
        >
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
