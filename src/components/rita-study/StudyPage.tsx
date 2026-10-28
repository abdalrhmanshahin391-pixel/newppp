import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Group, Panel, Separator } from "react-resizable-panels";
import { ArrowRight, Download, Loader2, Minus, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { RitaRealtimeV3, type StudyBridge } from "@/components/rita/RitaRealtimeV3";
import { studyGuideDownload } from "@/lib/study/study.functions";
import type { StudyLessonData } from "@/lib/study/study-types";
import { sectionId } from "@/lib/guides/guide-blocks";
import { GuideFrame, SHEET_PX, type GuideFrameHandle } from "./GuideFrame";
import { readStudyMemory, writeStudyMemory } from "./study-memory";

const ZOOM_MIN = 0.75;
const ZOOM_MAX = 2;

function useWide(min: number): boolean {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${min}px)`);
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [min]);
  return wide;
}

/**
 * "Rita - interactive study": the guide on the right, Rita on the left (always, even in Arabic),
 * a draggable divider on wide screens and two tabs on phones. Rita never starts teaching on her own
 * here; the learner reads and asks.
 */
export function StudyPage({ data }: { data: StudyLessonData }) {
  const { lesson, guide, preview } = data;
  const wide = useWide(900);
  const [tab, setTab] = useState<"guide" | "rita">("guide");
  const frame = useRef<GuideFrameHandle | null>(null);
  const guideBox = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fitted, setFitted] = useState(true);
  const [current, setCurrent] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [ritaSpeaking, setRitaSpeaking] = useState(false);
  const downloadFn = useServerFn(studyGuideDownload);
  const title = lesson.title_ar || lesson.title || guide.title;

  const sections = useMemo(
    () =>
      guide.content.sections.map((section, index) => ({
        id: sectionId(index),
        heading: section.heading,
      })),
    [guide.content],
  );

  // One object for the whole visit: Rita fills `send` while her call is ready.
  const bridge = useMemo<StudyBridge>(() => ({ send: null }), []);
  const lastFocus = useRef("");

  const sendFocus = useCallback(
    (section: string) => {
      if (!section || section === lastFocus.current) return;
      lastFocus.current = section;
      const heading = sections.find((item) => item.id === section)?.heading ?? "";
      bridge.send?.("rita-study-focus", { section, text: heading });
    },
    [bridge, sections],
  );

  useEffect(() => {
    bridge.onEvent = (event) => {
      if (event === "speaking") setRitaSpeaking(true);
      if (event === "quiet" || event === "ended") setRitaSpeaking(false);
      if (event !== "ready") return;
      bridge.send?.("rita-study-state", { state: "reading" });
      const memory = readStudyMemory(lesson.id);
      const heading = sections.find((item) => item.id === memory.section)?.heading;
      // One short line, once: the first visit says how this works; later visits say where we were.
      const line = !memory.introduced
        ? "الدرس قدّامك. اسألني بالصوت، أو حدّد أي جزء من الملف واكبس على الدائرة."
        : heading
          ? `كمّلنا من «${heading}».`
          : "";
      if (line && !preview) bridge.send?.("rita-study-say", { text: line });
      if (!preview) writeStudyMemory(lesson.id, { introduced: true });
      lastFocus.current = "";
      sendFocus(current || memory.section || "");
    };
  }, [bridge, current, lesson.id, preview, sections, sendFocus]);

  // The fitted zoom keeps the whole sheet in view on narrow screens.
  useEffect(() => {
    const box = guideBox.current;
    if (!box || !fitted) return;
    const resize = () => {
      const width = box.clientWidth;
      if (width > 0) setZoom(Math.min(1, Math.max(0.5, (width - 8) / SHEET_PX)));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(box);
    return () => observer.disconnect();
  }, [fitted, wide, tab]);

  const changeZoom = (step: number) => {
    setFitted(false);
    setZoom((value) =>
      Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((value + step) * 100) / 100)),
    );
  };

  // The section in view becomes Rita's focus, and where the next visit starts.
  const onGuideLoad = useCallback(
    (doc: Document) => {
      const win = doc.defaultView;
      if (!win) return;
      const memory = readStudyMemory(lesson.id);
      if (memory.section) doc.getElementById(memory.section)?.scrollIntoView({ block: "start" });
      let timer = 0;
      win.addEventListener(
        "scroll",
        () => {
          window.clearTimeout(timer);
          timer = window.setTimeout(() => {
            const middle = win.innerHeight / 3;
            let seen = "";
            for (const element of doc.querySelectorAll<HTMLElement>("[data-section]")) {
              if (element.getBoundingClientRect().top <= middle)
                seen = element.dataset.section ?? "";
            }
            const section = seen || sections[0]?.id || "";
            setCurrent(section);
            if (!preview) writeStudyMemory(lesson.id, { section });
            sendFocus(section);
          }, 250);
        },
        { passive: true },
      );
    },
    [lesson.id, preview, sections, sendFocus],
  );

  async function download() {
    setDownloading(true);
    try {
      const { url } = await downloadFn({ data: { lessonId: lesson.id, preview } });
      window.location.assign(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ما قدرت أفتح الملف.");
    } finally {
      setDownloading(false);
    }
  }

  const guidePane = (
    <div className="flex h-full min-h-0 flex-col bg-[#f4f4f8]" dir="rtl">
      <div
        className="flex flex-wrap items-center gap-1.5 border-b border-[var(--pp-line)] bg-white px-3 py-2"
        role="toolbar"
        aria-label="شريط الملف"
      >
        {sections.length > 1 && (
          <label className="flex items-center gap-1.5 text-[14px]">
            <span className="sr-only">القسم</span>
            <select
              value={current || sections[0]?.id}
              onChange={(event) => {
                setCurrent(event.target.value);
                frame.current?.scrollToSection(event.target.value);
              }}
              className="h-9 max-w-[14rem] rounded-lg border border-[var(--pp-line)] bg-white px-2 text-[14px]"
              dir="ltr"
            >
              {sections.map((section, index) => (
                <option key={section.id} value={section.id}>
                  {index + 1}. {section.heading}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="ms-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => changeZoom(-0.1)}
            disabled={zoom <= ZOOM_MIN}
            aria-label="تصغير"
            className="rita-btn rita-btn-quiet rita-btn-sm !h-9 !w-9 !px-0"
          >
            <Minus size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setFitted(true)}
            aria-pressed={fitted}
            className="rita-btn rita-btn-quiet rita-btn-sm !h-9 tabular-nums"
            title="ملاءمة العرض"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => changeZoom(0.1)}
            disabled={zoom >= ZOOM_MAX}
            aria-label="تكبير"
            className="rita-btn rita-btn-quiet rita-btn-sm !h-9 !w-9 !px-0"
          >
            <Plus size={16} aria-hidden="true" />
          </button>
          {guide.allow_download && (
            <button
              type="button"
              onClick={() => void download()}
              disabled={downloading}
              className="rita-btn rita-btn-soft rita-btn-sm gap-1.5 !h-9"
            >
              {downloading ? (
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              ) : (
                <Download size={15} aria-hidden="true" />
              )}
              PDF
            </button>
          )}
        </div>
      </div>
      <div ref={guideBox} className="relative min-h-0 flex-1">
        <GuideFrame
          ref={frame}
          content={guide.content}
          zoom={zoom}
          title={title}
          onLoad={onGuideLoad}
        />
      </div>
    </div>
  );

  const ritaPane = (
    <div className="flex h-full min-h-0 flex-col" dir="rtl">
      <RitaRealtimeV3 study={{ lessonId: lesson.id, preview, title: "ريتا", bridge }} />
    </div>
  );

  return (
    <div className="edith-premium flex h-[100dvh] flex-col bg-white text-[var(--pp-ink)]" dir="rtl">
      <header className="flex items-center gap-3 border-b border-[var(--pp-line)] px-4 py-2.5">
        <Link
          to="/rita-lessons"
          className="rita-btn rita-btn-quiet rita-btn-sm gap-1 !px-2"
          aria-label="رجوع للدروس"
        >
          <ArrowRight size={17} aria-hidden="true" />
          <span className="hidden sm:inline">الدروس</span>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-bold leading-6">{title}</h1>
          <p className="text-[12.5px] font-semibold text-[var(--pp-accent-text)]">
            ريتا — دراسة تفاعلية{preview ? " · معاينة أدمن (ما بينحفظ إشي)" : ""}
          </p>
        </div>
        <Link
          to="/rita-live"
          search={{ lesson: lesson.id, ...(preview ? { preview: true } : {}) }}
          className="rita-btn rita-btn-soft rita-btn-sm gap-1.5"
        >
          <Star size={15} aria-hidden="true" />
          تحدّي الدرس
        </Link>
      </header>

      {wide ? (
        // Rita is always on the left and the guide on the right: the group is laid out left to right.
        <Group orientation="horizontal" dir="ltr" className="min-h-0 flex-1">
          <Panel id="rita" defaultSize="44" minSize={340}>
            {ritaPane}
          </Panel>
          <Separator
            className="w-1.5 bg-[var(--pp-line)] transition-colors hover:bg-[var(--pp-accent)] focus-visible:bg-[var(--pp-accent)] focus-visible:outline-none"
            aria-label="غيّر عرض الملف وريتا"
          />
          <Panel id="guide" defaultSize="56" minSize={420}>
            {guidePane}
          </Panel>
        </Group>
      ) : (
        <>
          <div
            role="tablist"
            aria-label="الدرس وريتا"
            className="flex border-b border-[var(--pp-line)]"
          >
            {(
              [
                ["guide", "الدرس"],
                ["rita", ritaSpeaking ? "ريتا بتحكي…" : "ريتا"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={`h-11 flex-1 text-[15px] font-semibold ${
                  tab === value
                    ? "border-b-2 border-[var(--pp-accent)] text-[var(--pp-ink)]"
                    : "text-[var(--pp-muted)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {/* Both stay mounted so the call keeps going and the reading place is kept. */}
          <div className={`min-h-0 flex-1 ${tab === "guide" ? "" : "hidden"}`}>{guidePane}</div>
          <div className={`min-h-0 flex-1 ${tab === "rita" ? "" : "hidden"}`}>{ritaPane}</div>
        </>
      )}
    </div>
  );
}
