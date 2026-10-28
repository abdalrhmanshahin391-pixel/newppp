import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, ExternalLink, Link2, Link2Off, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { adminGuideUrl, adminRenderGuide, adminWriteGuide } from "@/lib/guides/guides.functions";
import { describeGuideError } from "@/lib/guides/guide-record";
import {
  adminLinkStudyGuide,
  adminSetGuideDownload,
  adminSetLessonExperience,
  adminSetStudySwitch,
  adminStudyLessonState,
  adminUnlinkStudyGuide,
  type StudyLessonState,
} from "@/lib/study/study.functions";
import type { Experience } from "@/lib/study/study-experience";
import { errorText } from "./book/book-utils";

const BLOCKER_TEXT = {
  not_study: "الدرس بالتجربة الحالية. الطلاب بياخدوه زي ما هو.",
  no_guide: "الطلاب لسا بياخدوا الدرس الحالي لحد ما تربط دليل جاهز.",
  switch_off: "كل شي جاهز، بس مفتاح «دراسة تفاعلية» مطفي، فالطلاب بياخدوا الدرس الحالي.",
  "": "الطلاب بيفتحوا هاد الدرس كدراسة تفاعلية: الدليل يمين وريتا يسار.",
} as const;

/**
 * The lesson's experience and its study file. The admin chooses "current lesson" or "Rita -
 * interactive study", links one of this book's PDF guides (the learners' copy is printed then),
 * and can switch the whole feature on or off. Learners never see a draft guide.
 */
export function StudyGuidePanel({
  lesson,
}: {
  lesson: {
    id: string;
    curriculum_id: string;
    title: string;
    source_from_page: number;
    source_to_page: number;
  };
}) {
  const stateFn = useServerFn(adminStudyLessonState);
  const experienceFn = useServerFn(adminSetLessonExperience);
  const linkFn = useServerFn(adminLinkStudyGuide);
  const unlinkFn = useServerFn(adminUnlinkStudyGuide);
  const downloadFn = useServerFn(adminSetGuideDownload);
  const switchFn = useServerFn(adminSetStudySwitch);
  const writeFn = useServerFn(adminWriteGuide);
  const renderFn = useServerFn(adminRenderGuide);
  const urlFn = useServerFn(adminGuideUrl);
  const [state, setState] = useState<StudyLessonState | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      setState(await stateFn({ data: { lessonId: lesson.id } }));
      setLoadError("");
    } catch (error) {
      setLoadError(errorText(error));
    }
  }, [lesson.id, stateFn]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(key: string, task: () => Promise<unknown>, done?: string) {
    setBusy(key);
    try {
      await task();
      if (done) toast.success(done);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy("");
      await load();
    }
  }

  async function makeGuide() {
    const title = lesson.title.slice(0, 200);
    const written = await writeFn({
      data: {
        curriculumId: lesson.curriculum_id,
        title,
        fromPage: lesson.source_from_page,
        toPage: Math.min(lesson.source_to_page, lesson.source_from_page + 9),
      },
    });
    if (!written.ok) throw new Error(describeGuideError(written.code));
    const rendered = await renderFn({ data: { guideId: written.guideId } });
    if (!rendered.ok) throw new Error(describeGuideError(rendered.code));
  }

  if (loadError) return <p className="text-[14px] text-[#8c1a31]">{loadError}</p>;
  if (!state)
    return (
      <p role="status" className="flex items-center gap-2 text-[14px] text-[var(--pp-muted)]">
        <Loader2 size={15} className="animate-spin" aria-hidden="true" /> جاري التحميل…
      </p>
    );
  if (!state.ready)
    return (
      <p className="rounded-xl bg-[#fff6e5] p-3 text-[14px] text-[#6b4100]">
        الدراسة التفاعلية لسا مش جاهزة: طبّق الميجريشن{" "}
        <bdi dir="ltr">20261028120000_rita_study_lessons</bdi> ثم حدّث الصفحة.
      </p>
    );

  const setExperience = (experience: Experience) =>
    void run(
      "experience",
      () => experienceFn({ data: { lessonId: lesson.id, experience } }),
      experience === "study" ? "صار الدرس دراسة تفاعلية" : "رجع الدرس للتجربة الحالية",
    );

  return (
    <div className="space-y-5">
      <section className="space-y-2" aria-labelledby="study-kind-title">
        <h3 id="study-kind-title" className="text-[17px] font-bold">
          نوع التجربة
        </h3>
        <div role="radiogroup" aria-label="نوع التجربة" className="rita-choice">
          {(
            [
              ["classic", "الدرس الحالي"],
              ["study", "ريتا — دراسة تفاعلية (ملف + ريتا)"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={state.experience === value}
              disabled={Boolean(busy)}
              onClick={() => state.experience !== value && setExperience(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <p
          role="status"
          className={`rounded-xl p-3 text-[14px] ${
            state.blocker === ""
              ? "bg-[#eefaf0] text-[#1f5e2a]"
              : "bg-[var(--pp-grey)] text-[var(--pp-muted)]"
          }`}
        >
          {BLOCKER_TEXT[state.blocker]}
        </p>
      </section>

      {state.experience === "study" && (
        <section className="space-y-3" aria-labelledby="study-file-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="study-file-title" className="text-[17px] font-bold">
              ملف الدراسة
            </h3>
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void run("make", makeGuide, "انصنع الدليل. راجعه واربطه.")}
              className="rita-btn rita-btn-soft rita-btn-sm gap-1.5"
            >
              {busy === "make" ? (
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles size={15} aria-hidden="true" />
              )}
              اصنع دليل لهاد الدرس
            </button>
          </div>
          <p className="text-[14px] text-[var(--pp-muted)]">
            أدلة هاد الكتاب اللي صفحاتها بتغطي صفحات الدرس. لما تربط دليل، بننطبع نسخة للطلاب بدون
            كلمة «draft»، والمسودات ما بتوصل للطلاب أبدًا.
          </p>
          {state.guides.length === 0 ? (
            <p className="rounded-xl bg-[var(--pp-grey)] p-3 text-[14px]">
              ما في دليل لصفحات هاد الدرس. اضغط «اصنع دليل لهاد الدرس».
            </p>
          ) : (
            <ul className="space-y-2">
              {state.guides.map((guide) => {
                const linked = guide.id === state.linkedGuideId;
                return (
                  <li
                    key={guide.id}
                    className={`rounded-xl border p-3 ${
                      linked
                        ? "border-[var(--pp-accent)] bg-[var(--pp-accent-soft)]"
                        : "border-[var(--pp-line)]"
                    }`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="me-auto min-w-0">
                        <p className="font-semibold">
                          <bdi dir="ltr">{guide.title}</bdi>{" "}
                          <span className="text-[13px] font-normal text-[var(--pp-muted)]">
                            نسخة {guide.version} · صفحات {guide.from_page}–{guide.to_page}
                          </span>
                        </p>
                        <p className="text-[13px] text-[var(--pp-muted)]">
                          {linked
                            ? "مربوط بهاد الدرس"
                            : guide.status === "ready"
                              ? "جاهز"
                              : "مش جاهز"}
                          {guide.warnings > 0 && ` · ${guide.warnings} ملاحظة من الفاحص`}
                          {guide.high_warnings > 0 && ` (${guide.high_warnings} كبيرة)`}
                        </p>
                        {guide.problem && !linked && (
                          <p className="mt-1 text-[13px] text-[#8c1a31]">{guide.problem}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {guide.status === "ready" && (
                          <button
                            type="button"
                            disabled={Boolean(busy)}
                            onClick={() =>
                              void run("open", async () => {
                                const { url } = await urlFn({ data: { guideId: guide.id } });
                                window.open(url, "_blank", "noopener");
                              })
                            }
                            className="rita-btn rita-btn-soft rita-btn-sm gap-1.5"
                          >
                            <ExternalLink size={15} aria-hidden="true" />
                            افتح
                          </button>
                        )}
                        {linked ? (
                          <button
                            type="button"
                            disabled={Boolean(busy)}
                            onClick={() =>
                              void run(
                                "unlink",
                                () => unlinkFn({ data: { lessonId: lesson.id } }),
                                "انفك ربط الدليل",
                              )
                            }
                            className="rita-btn rita-btn-soft rita-btn-sm gap-1.5"
                          >
                            <Link2Off size={15} aria-hidden="true" />
                            فك الربط
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={Boolean(busy) || Boolean(guide.problem)}
                            onClick={() =>
                              void run(
                                `link:${guide.id}`,
                                async () => {
                                  const result = await linkFn({
                                    data: { lessonId: lesson.id, guideId: guide.id },
                                  });
                                  if (!result.ok) throw new Error(result.message);
                                },
                                "انربط الدليل بالدرس",
                              )
                            }
                            className="rita-btn rita-btn-primary rita-btn-sm gap-1.5"
                          >
                            {busy === `link:${guide.id}` ? (
                              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                            ) : (
                              <Link2 size={15} aria-hidden="true" />
                            )}
                            اربط بهاد الدرس
                          </button>
                        )}
                      </div>
                    </div>
                    {linked && (
                      <label className="mt-2 flex items-center gap-2 text-[14px]">
                        <input
                          type="checkbox"
                          checked={guide.allow_download}
                          disabled={Boolean(busy)}
                          onChange={(event) =>
                            void run("download", () =>
                              downloadFn({
                                data: { guideId: guide.id, allow: event.currentTarget.checked },
                              }),
                            )
                          }
                        />
                        الطلاب بيقدروا ينزّلوا الـPDF
                      </label>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <section
        className="space-y-2 border-t border-[var(--pp-line)] pt-4"
        aria-labelledby="study-switch-title"
      >
        <h3 id="study-switch-title" className="text-[17px] font-bold">
          مفتاح «دراسة تفاعلية» (لكل الموقع)
        </h3>
        <p className="text-[14px] text-[var(--pp-muted)]">
          لما يكون مطفي، كل دروس الدراسة التفاعلية بتفتح للطلاب بالتجربة الحالية، وما بينحذف إشي.
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={state.switchOn}
          disabled={Boolean(busy)}
          onClick={() =>
            void run(
              "switch",
              () => switchFn({ data: { enabled: !state.switchOn } }),
              state.switchOn ? "انطفى المفتاح" : "اشتغل المفتاح",
            )
          }
          className={`rita-btn rita-btn-sm gap-1.5 ${state.switchOn ? "rita-btn-primary" : "rita-btn-soft"}`}
        >
          {state.switchOn && <Check size={15} aria-hidden="true" />}
          {state.switchOn ? "شغّال" : "مطفي"}
        </button>
      </section>
    </div>
  );
}
