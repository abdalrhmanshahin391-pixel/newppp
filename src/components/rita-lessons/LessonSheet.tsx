import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Play,
  Presentation,
  RotateCcw,
  Target,
  Video,
  X,
} from "lucide-react";
import {
  getLessonPreview,
  type LessonPreview,
  type PathLesson,
} from "@/lib/rita-curriculum.functions";
import { KIND_LABEL_AR, formatBytes, type ResourceKind } from "@/lib/rita-resources";
import { SLIDE_KIND_LABEL } from "@/components/rita-lessons/admin/SlidesPanel";
import { stepSlide, type Slide } from "@/lib/rita-slides";
import { LessonImage, LessonStars } from "./LessonArt";

type Tab = "overview" | "slides" | "resources";

const RESOURCE_ICON: Record<ResourceKind, typeof FileText> = {
  pdf: FileText,
  link: Link2,
  video: Video,
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** One slide, read at a comfortable size. English stays left to right inside the Arabic page. */
function SlideCard({ slide }: { slide: Slide }) {
  return (
    <article className="flex min-h-[18rem] flex-col gap-3 rounded-[20px] border-2 border-[var(--pp-ink)] bg-white p-5">
      <p className="text-xs font-bold text-[var(--pp-muted)]">{SLIDE_KIND_LABEL[slide.kind]}</p>
      <h3 className="text-[26px] font-bold leading-tight tracking-[-0.02em]" dir="ltr">
        {slide.heading}
      </h3>
      {slide.heading_ar && (
        <p className="text-lg font-semibold text-[var(--pp-muted)]">{slide.heading_ar}</p>
      )}
      {slide.bullets.length > 0 && (
        <ul className="list-disc space-y-1.5 ps-5 text-base leading-snug" dir="ltr">
          {slide.bullets.map((bullet, index) => (
            <li key={`${index}-${bullet}`}>{bullet}</li>
          ))}
        </ul>
      )}
      {slide.example && (
        <p
          className="rounded-xl bg-[var(--pp-grey)] px-4 py-3 text-base font-semibold leading-snug"
          dir="ltr"
        >
          {slide.example}
        </p>
      )}
      {slide.vocabulary.length > 0 && (
        <ul className="grid gap-2">
          {slide.vocabulary.map((item) => (
            <li
              key={item.word}
              className="flex flex-wrap items-baseline justify-between gap-x-3 rounded-xl border-2 border-[var(--pp-line)] px-3 py-2"
            >
              <span className="text-base font-bold" dir="ltr">
                {item.word}
              </span>
              {item.meaning_ar && (
                <span className="text-base font-semibold text-[var(--pp-accent-text)]" lang="ar">
                  {item.meaning_ar}
                </span>
              )}
              {item.example && (
                <span className="basis-full text-sm text-[var(--pp-muted)]" dir="ltr">
                  {item.example}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function SlideViewer({
  slides,
  onStart,
  startLabel,
}: {
  slides: Slide[];
  onStart: () => void;
  startLabel: string;
}) {
  const [index, setIndex] = useState(0);
  const [moved, setMoved] = useState(0);
  const touch = useRef<{ x: number; id: number } | null>(null);
  const last = index === slides.length - 1;
  const slide = slides[index];

  const go = useCallback(
    (delta: number) => {
      setIndex((current) => stepSlide(current, delta, slides.length));
      setMoved((count) => count + 1);
    },
    [slides.length],
  );

  // The page is right to left, so "next" is the left arrow and a swipe towards the left.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      go(-1);
    }
  }
  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    touch.current = { x: event.clientX, id: event.pointerId };
  }
  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = touch.current;
    touch.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    if (Math.abs(dx) < 48) return;
    go(dx < 0 ? 1 : -1);
  }

  return (
    <div
      role="group"
      aria-roledescription="عارض السلايدات"
      aria-label="سلايدات الدرس"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      className="space-y-3 rounded-[20px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--pp-ink)]"
      style={{ touchAction: "pan-y" }}
    >
      <div key={slide.id} className={moved ? "lesson-slide-in" : undefined}>
        <SlideCard slide={slide} />
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-[var(--pp-grey)]"
        role="presentation"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full bg-[var(--pp-accent)] transition-[width] duration-200 motion-reduce:transition-none"
          style={{ width: `${((index + 1) / slides.length) * 100}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={index === 0}
          aria-label="السلايد السابق"
          className="grid h-11 w-11 place-items-center rounded-lg border-2 border-[var(--pp-ink)] bg-white disabled:opacity-30"
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
        <p className="text-sm font-bold" aria-live="polite" dir="ltr">
          {index + 1} / {slides.length}
        </p>
        {last ? (
          <button
            type="button"
            onClick={onStart}
            className="inline-flex h-11 items-center gap-2 rounded-lg border-2 border-[var(--pp-ink)] bg-[var(--pp-accent)] px-4 text-sm font-bold text-[var(--pp-on-accent)]"
          >
            {startLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="السلايد التالي"
            className="grid h-11 w-11 place-items-center rounded-lg border-2 border-[var(--pp-ink)] bg-white"
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * The card a learner sees before a lesson starts: what they will learn, the
 * slides the teacher chose to share, and the resources. Looking at it records
 * nothing; only "start" opens the lesson.
 */
export function LessonSheet({
  lesson,
  onClose,
  onStart,
}: {
  lesson: PathLesson;
  onClose: () => void;
  onStart: (lesson: PathLesson) => void;
}) {
  const previewFn = useServerFn(getLessonPreview);
  const [preview, setPreview] = useState<LessonPreview | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    previewFn({ data: { lessonId: lesson.id } })
      .then((result) => {
        if (!cancelled) setPreview(result);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "تعذّر تحميل الدرس.");
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, lesson.id, previewFn]);

  return (
    <LessonSheetView
      lesson={lesson}
      preview={preview}
      error={error}
      onRetry={() => {
        setPreview(null);
        setError("");
        setAttempt((count) => count + 1);
      }}
      onClose={onClose}
      onStart={onStart}
    />
  );
}

/** The card itself, with no data fetching, so every state can be shown and tested. */
export function LessonSheetView({
  lesson,
  preview,
  error,
  onRetry,
  onClose,
  onStart,
}: {
  lesson: PathLesson;
  preview: LessonPreview | null;
  error: string;
  onRetry: () => void;
  onClose: () => void;
  onStart: (lesson: PathLesson) => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const panel = useRef<HTMLDivElement | null>(null);

  const startLabel =
    lesson.state === "done" ? "أعد الدرس" : lesson.in_progress ? "تابع الدرس" : "ابدأ الدرس";

  // Modal behaviour: lock the page behind it, keep focus inside, and give focus back on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => {
      document.body.style.overflow = previous;
      opener?.focus?.();
    };
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !panel.current) return;
    const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (item) => item.offsetParent !== null,
    );
    if (items.length === 0) return;
    const first = items[0];
    const lastItem = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      lastItem.focus();
    } else if (!event.shiftKey && document.activeElement === lastItem) {
      event.preventDefault();
      first.focus();
    }
  }

  const slides = preview?.slides ?? [];
  const resources = preview?.resources ?? [];
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "نظرة" },
    ...(slides.length > 0
      ? [{ id: "slides" as const, label: "السلايدات", count: slides.length }]
      : []),
    ...(resources.length > 0
      ? [{ id: "resources" as const, label: "المراجع", count: resources.length }]
      : []),
  ];
  const title = lesson.title_ar || lesson.title;

  return (
    <div className="fixed inset-0 z-[60]" onKeyDown={onKeyDown}>
      <div
        className="lesson-sheet-backdrop absolute inset-0 bg-[var(--pp-ink)]/55"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lesson-sheet-title"
        dir="rtl"
        className="lesson-sheet-panel absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-[24px] border-2 border-b-0 border-[var(--pp-ink)] bg-white text-[var(--pp-ink)] md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-[30rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[24px] md:border-b-2"
      >
        <header className="flex items-start gap-3 border-b-2 border-[var(--pp-line)] p-4">
          <LessonImage
            src={lesson.image_url}
            alt=""
            className="h-16 w-16 shrink-0 border-2 border-[var(--pp-ink)]"
          />
          <div className="min-w-0 flex-1">
            <h2
              id="lesson-sheet-title"
              className="text-lg font-bold leading-snug [overflow-wrap:anywhere]"
            >
              {title}
            </h2>
            {lesson.title_ar && lesson.title && (
              <p
                className="text-sm font-semibold text-[var(--pp-muted)] [overflow-wrap:anywhere]"
                dir="ltr"
              >
                {lesson.title}
              </p>
            )}
            <div className="mt-1">
              <LessonStars stars={lesson.stars} size={18} />
            </div>
          </div>
          <button
            type="button"
            data-autofocus
            onClick={onClose}
            aria-label="إغلاق"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border-2 border-transparent hover:border-[var(--pp-ink)]"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {tabs.length > 1 && (
          <div
            role="tablist"
            aria-label="أقسام الدرس"
            className="flex gap-2 overflow-x-auto px-4 pt-3"
          >
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
                className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-lg border-2 border-[var(--pp-ink)] px-4 text-sm font-bold ${
                  tab === item.id ? "bg-[var(--pp-ink)] text-white" : "bg-white"
                }`}
              >
                {item.label}
                {item.count !== undefined && (
                  <span
                    className={`rounded-md px-1.5 text-xs ${
                      tab === item.id ? "bg-white/20" : "bg-[var(--pp-grey)]"
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="min-h-[12rem] flex-1 overflow-y-auto p-4" role="tabpanel">
          {!preview && !error && (
            <div
              role="status"
              className="grid place-items-center py-12 text-[var(--pp-accent-text)]"
            >
              <Loader2 className="animate-spin" aria-label="جارٍ التحميل" />
            </div>
          )}
          {error && (
            <div role="alert" className="rounded-2xl bg-[var(--pp-grey)] p-4 text-center">
              <p className="text-sm font-bold">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-lg border-2 border-[var(--pp-ink)] bg-white px-4 text-sm font-bold"
              >
                <RotateCcw size={16} aria-hidden="true" />
                أعد المحاولة
              </button>
              <p className="mt-2 text-xs text-[var(--pp-muted)]">
                يمكنك بدء الدرس بدونها في أي وقت.
              </p>
            </div>
          )}

          {preview && tab === "overview" && (
            <div className="space-y-4">
              {preview.lesson.topic && (
                <p className="text-sm font-semibold text-[var(--pp-muted)]" dir="auto">
                  {preview.lesson.topic}
                </p>
              )}
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold">
                  <Target size={16} aria-hidden="true" />
                  ما ستتعلمه في هذا الدرس
                </h3>
                <ul className="mt-2 space-y-2">
                  {preview.lesson.objectives.map((objective) => (
                    <li
                      key={objective.id}
                      className="rounded-xl border-2 border-[var(--pp-line)] px-3 py-2 text-sm font-semibold leading-snug"
                    >
                      {objective.text_ar || objective.text}
                    </li>
                  ))}
                </ul>
              </div>
              {(slides.length > 0 || resources.length > 0) && (
                <div className="grid gap-2">
                  {slides.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setTab("slides")}
                      className="flex min-h-[56px] items-center gap-3 rounded-2xl border-2 border-[var(--pp-ink)] bg-white px-3 text-start hover:bg-[var(--pp-accent-soft)]"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border-2 border-[var(--pp-ink)]">
                        <Presentation size={20} aria-hidden="true" />
                      </span>
                      <span className="flex-1 text-sm font-bold">شاهد السلايدات أولًا</span>
                      <span className="text-xs font-semibold text-[var(--pp-muted)]">
                        {slides.length} سلايد
                      </span>
                      <ChevronLeft size={18} aria-hidden="true" />
                    </button>
                  )}
                  {resources.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setTab("resources")}
                      className="flex min-h-[56px] items-center gap-3 rounded-2xl border-2 border-[var(--pp-ink)] bg-white px-3 text-start hover:bg-[var(--pp-accent-soft)]"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border-2 border-[var(--pp-ink)]">
                        <FileText size={20} aria-hidden="true" />
                      </span>
                      <span className="flex-1 text-sm font-bold">مراجع الدرس</span>
                      <span className="text-xs font-semibold text-[var(--pp-muted)]">
                        {resources.length}
                      </span>
                      <ChevronLeft size={18} aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {preview && tab === "slides" && slides.length > 0 && (
            <SlideViewer slides={slides} startLabel={startLabel} onStart={() => onStart(lesson)} />
          )}

          {preview && tab === "resources" && (
            <ul className="space-y-2">
              {resources.map((resource) => {
                const Icon = RESOURCE_ICON[resource.kind];
                const meta =
                  resource.kind === "pdf" && resource.size
                    ? `${KIND_LABEL_AR.pdf} · ${formatBytes(resource.size)}`
                    : `${KIND_LABEL_AR[resource.kind]}${resource.host ? ` · ${resource.host}` : ""}`;
                return (
                  <li key={resource.id}>
                    <a
                      href={resource.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-[56px] items-center gap-3 rounded-2xl border-2 border-[var(--pp-ink)] bg-white px-3 py-2.5 hover:bg-[var(--pp-accent-soft)]"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border-2 border-[var(--pp-ink)]">
                        <Icon size={20} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-bold leading-snug [overflow-wrap:anywhere]">
                          {resource.title}
                        </span>
                        {resource.note && (
                          <span className="mt-0.5 block text-[13px] text-[var(--pp-muted)] [overflow-wrap:anywhere]">
                            {resource.note}
                          </span>
                        )}
                        <span
                          className="mt-0.5 block text-xs font-semibold text-[var(--pp-muted)]"
                          dir="auto"
                        >
                          {meta}
                        </span>
                      </span>
                      <ExternalLink size={16} aria-hidden="true" className="shrink-0" />
                      <span className="sr-only">(يفتح في تبويب جديد)</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="border-t-2 border-[var(--pp-line)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => onStart(lesson)}
            className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg border-2 border-[var(--pp-ink)] bg-[var(--pp-accent)] text-base font-bold text-[var(--pp-on-accent)]"
          >
            <Play size={18} aria-hidden="true" />
            {startLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
