import { useState } from "react";
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
  adminGenerateSlides,
  adminRegenerateObjective,
  adminSaveSlides,
  adminSetLessonStatus,
  adminSetSlidesShared,
  adminUpdateLesson,
  type LessonRow,
} from "@/lib/rita-curriculum.functions";
import type { Resource } from "@/lib/rita-resources";
import type { Slide } from "@/lib/rita-slides";
import { LessonForm } from "@/components/rita-lessons/LessonForm";
import { LessonImage } from "@/components/rita-lessons/LessonArt";
import { ExercisesPanel } from "@/components/rita-lessons/admin/ExercisesPanel";
import { ResourcesPanel } from "@/components/rita-lessons/admin/ResourcesPanel";
import { SlidesPanel } from "@/components/rita-lessons/admin/SlidesPanel";
import { errorText, lessonToDraft, pagesLabel } from "./book-utils";
import { BidiText, ReadinessChip } from "./BookBits";

/**
 * One lesson, opened from the review list: its exercises first (what the learner practises),
 * then its goals and plan, its slides and its resources. Preview and publish are always at the top.
 */
export function LessonDrawer({
  lesson,
  readiness,
  bookPublished,
  slides,
  slidesReady,
  slidesShared,
  sharedReady,
  resources,
  resourcesReady,
  onClose,
  onChanged,
}: {
  lesson: LessonRow | null;
  readiness: LessonReadiness;
  bookPublished: boolean;
  slides: Record<string, Slide[]>;
  slidesReady: boolean;
  slidesShared: Record<string, boolean>;
  sharedReady: boolean;
  resources: Record<string, Resource[]>;
  resourcesReady: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const statusFn = useServerFn(adminSetLessonStatus);
  const updateFn = useServerFn(adminUpdateLesson);
  const regenerateFn = useServerFn(adminRegenerateObjective);
  const imageFn = useServerFn(adminGenerateLessonImage);
  const slidesFn = useServerFn(adminGenerateSlides);
  const saveSlidesFn = useServerFn(adminSaveSlides);
  const shareSlidesFn = useServerFn(adminSetSlidesShared);
  const [busy, setBusy] = useState("");
  const [deckEpoch, setDeckEpoch] = useState(0);
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
    <Dialog.Root open={lesson !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="rita-ex-overlay edith-premium" />
        <Dialog.Content
          className="rita-drawer edith-premium"
          dir="rtl"
          aria-describedby={undefined}
        >
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
                    <Dialog.Title className="truncate text-[20px] font-bold leading-snug">
                      <BidiText text={lesson.title_ar || lesson.title} />
                    </Dialog.Title>
                    <p className="truncate text-[14px] text-[var(--pp-muted)]">
                      <bdi dir="ltr">{lesson.title}</bdi>
                    </p>
                  </div>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="rita-btn rita-btn-quiet rita-btn-sm"
                      aria-label="إغلاق"
                    >
                      <X size={18} />
                    </button>
                  </Dialog.Close>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ReadinessChip state={readiness} />
                  <span className="me-auto" />
                  <Link
                    to="/rita-live"
                    search={{ lesson: lesson.id, preview: true }}
                    target="_blank"
                    className="rita-btn rita-btn-soft rita-btn-sm gap-1.5"
                  >
                    <Eye size={15} aria-hidden="true" /> معاينة كطالب
                  </Link>
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      void run(
                        "status",
                        () =>
                          statusFn({
                            data: {
                              lessonId: lesson.id,
                              status: lesson.status === "published" ? "draft" : "published",
                            },
                          }),
                        lesson.status === "published"
                          ? "رجع الدرس مسودة"
                          : bookPublished
                            ? "انشر الدرس"
                            : "انشر الدرس، وبيظهر للطلاب لما تنشر الكتاب",
                      )
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
                defaultValue="exercises"
                className="flex min-h-0 flex-1 flex-col"
                dir="rtl"
              >
                <Tabs.List className="rita-tabs-list px-5" aria-label="أقسام الدرس">
                  <Tabs.Trigger value="exercises" className="rita-tab">
                    التمارين
                  </Tabs.Trigger>
                  <Tabs.Trigger value="plan" className="rita-tab">
                    الأهداف والخطة
                  </Tabs.Trigger>
                  <Tabs.Trigger value="slides" className="rita-tab">
                    السلايدات
                  </Tabs.Trigger>
                  <Tabs.Trigger value="resources" className="rita-tab">
                    المراجع{resourcesReady ? ` (${resources[lesson.id]?.length ?? 0})` : ""}
                  </Tabs.Trigger>
                </Tabs.List>
                <div className="rita-ex-body">
                  <Tabs.Content value="exercises" className="rita-tab-panel">
                    <ExercisesPanel key={lesson.id} lessonId={lesson.id} />
                  </Tabs.Content>
                  <Tabs.Content value="plan" className="rita-tab-panel">
                    <LessonForm
                      key={`${lesson.id}:${lesson.version}:${formEpoch}`}
                      initial={lessonToDraft(lesson)}
                      busy={Boolean(busy)}
                      onCancel={() => setFormEpoch((value) => value + 1)}
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
                  <Tabs.Content value="slides" className="rita-tab-panel">
                    <SlidesPanel
                      key={`${lesson.id}:${deckEpoch}`}
                      from={lesson.source_from_page}
                      to={lesson.source_to_page}
                      ready={slidesReady}
                      shared={slidesShared[lesson.id] === true}
                      sharedReady={sharedReady}
                      onToggleShared={async (next) => {
                        try {
                          await shareSlidesFn({ data: { lessonId: lesson.id, shared: next } });
                          toast.success(
                            next ? "السلايدات ظاهرة للطلاب" : "السلايدات مخفية عن الطلاب",
                          );
                          await onChanged();
                        } catch (error) {
                          toast.error(errorText(error));
                        }
                      }}
                      saved={slides[lesson.id]}
                      busy={Boolean(busy)}
                      generating={busy === "slides"}
                      onGenerate={() =>
                        void run(
                          "slides",
                          async () => {
                            await slidesFn({ data: { lessonId: lesson.id } });
                            setDeckEpoch((value) => value + 1);
                          },
                          "انكتبت السلايدات. راجعها قبل ما تعرضها للطلاب",
                        )
                      }
                      onSave={async (deck) => {
                        try {
                          await saveSlidesFn({ data: { lessonId: lesson.id, slides: deck } });
                          toast.success("انحفظت السلايدات");
                          await onChanged();
                          return true;
                        } catch (error) {
                          toast.error(errorText(error));
                          return false;
                        }
                      }}
                    />
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
