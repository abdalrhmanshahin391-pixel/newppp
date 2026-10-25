import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Lightbulb, Loader2, Pause, Play, RotateCcw, X } from "lucide-react";
import type { Feedback, LessonStep } from "@/lib/rita-lesson-engine";
import type { PublicItem } from "@/lib/rita-lesson-grader";
import { ChatText } from "@/components/rita/ChatText";
import type { LessonRunHandle } from "./useLessonRun";

/** How long a settled answer stays on screen before the next question, unless "Next" is pressed. */
const HOLD_MS = 1600;

const ITEM_PHASES = new Set(["guided", "practice", "remediation"]);

// Layout effect in the browser (no flash of the next question), plain effect on the server.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function exerciseOpen(step: LessonStep | null): boolean {
  return Boolean(
    step && !step.paused && (ITEM_PHASES.has(step.phase) || step.phase === "section_result"),
  );
}

type Chosen = { kind: "choice"; value: string } | { kind: "tiles"; ids: string[] };

/** A finished question kept on screen with its result, while the next one waits behind it. */
type Held = { item: PublicItem; chosen: Chosen | null; feedback: Feedback; step: LessonStep };

function phaseLabel(step: LessonStep): string {
  if (step.phase === "guided") return "مثال مع مساعدة";
  if (step.phase === "remediation") return "مراجعة";
  if (step.phase === "section_result") return "نتيجة الجزء";
  return "تمرين";
}

/**
 * The exercise window. It opens over the lesson when the learner is ready to practise: a sheet from
 * the bottom on phones, a centred window on wider screens. One question at a time, answered by
 * tapping; the server checks every answer. Closing it (Esc, back, Pause) pauses the lesson on the
 * same question; nothing is lost.
 */
export function ExerciseWindow({ run }: { run: LessonRunHandle }) {
  const step = run.step;
  const [held, setHeld] = useState<Held | null>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const open = exerciseOpen(step) || held !== null;
  const shown = held?.step ?? step;

  // The question on screen and what the learner picked, so a finished question can stay visible
  // with its result however it finished (an answer, a reveal, or later a spoken answer).
  const lastShown = useRef<{ item: PublicItem; step: LessonStep } | null>(null);
  const lastChosen = useRef<Chosen | null>(null);
  useIsomorphicLayoutEffect(() => {
    const previous = lastShown.current;
    const feedback = step?.feedback;
    if (
      previous &&
      feedback?.settled &&
      feedback.item_id === previous.item.id &&
      step?.item?.id !== previous.item.id
    ) {
      setHeld({
        item: previous.item,
        chosen: lastChosen.current,
        feedback,
        step: { ...previous.step, feedback },
      });
    }
    if (step?.item && step.item.id !== previous?.item.id) lastChosen.current = null;
    lastShown.current = step?.item ? { item: step.item, step } : null;
  }, [step]);

  useEffect(() => {
    if (!held) return;
    const timer = window.setTimeout(() => setHeld(null), HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [held]);

  if (!step || !shown) return null;

  return (
    <>
      <Dialog.Root
        open={open}
        onOpenChange={(next) => {
          if (!next && !run.busy) {
            setHeld(null);
            void run.send({ type: "pause" });
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="rita-ex-overlay edith-premium" />
          <Dialog.Content
            className="rita-ex-window edith-premium"
            dir="rtl"
            aria-describedby={undefined}
            ref={windowRef}
            // Focus goes to the window itself, not to the first answer, so Enter or Space cannot
            // pick an answer by accident; Tab then moves through the window.
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              windowRef.current?.focus();
            }}
          >
            <WindowHeader
              step={shown}
              busy={run.busy}
              onPause={() => void run.send({ type: "pause" })}
            />
            <div className="rita-ex-body">
              {held ? (
                <QuestionView
                  key={`held-${held.item.id}`}
                  item={held.item}
                  step={held.step}
                  run={run}
                  held={held}
                  onNext={() => setHeld(null)}
                />
              ) : step.phase === "section_result" ? (
                <SectionResult step={step} run={run} />
              ) : step.item ? (
                <QuestionView
                  key={`${step.item.id}-${step.tries}`}
                  item={step.item}
                  step={step}
                  run={run}
                  held={null}
                  onChoose={(chosen) => {
                    lastChosen.current = chosen;
                  }}
                />
              ) : null}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {step.paused && (ITEM_PHASES.has(step.phase) || step.phase === "section_result") && (
        <PausedBar step={step} run={run} />
      )}
    </>
  );
}

function WindowHeader({
  step,
  busy,
  onPause,
}: {
  step: LessonStep;
  busy: boolean;
  onPause: () => void;
}) {
  const section = step.section;
  const progress = step.item_count ? (step.item_number - 1) / step.item_count : 1;
  return (
    <header className="rita-ex-header">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-[var(--pp-muted)]">
            {section ? `الجزء ${section.index + 1} من ${section.count}` : ""}
            {section ? " · " : ""}
            {phaseLabel(step)}
          </p>
          <Dialog.Title className="mt-0.5 truncate text-[18px] font-bold leading-snug text-[var(--pp-ink)]">
            {section?.title_ar || section?.title || "تمرين"}
          </Dialog.Title>
        </div>
        <button
          type="button"
          onClick={onPause}
          disabled={busy}
          className="rita-btn rita-btn-soft rita-btn-sm shrink-0 gap-1.5"
        >
          <Pause size={15} aria-hidden="true" />
          إيقاف مؤقت
        </button>
      </div>
      {step.item_count > 0 && (
        <div className="mt-3 flex items-center gap-3">
          <div
            className="rita-ex-progress"
            role="progressbar"
            aria-label="التقدم في هذا الجزء"
            aria-valuemin={0}
            aria-valuemax={step.item_count}
            aria-valuenow={step.item_number - 1}
          >
            <span style={{ transform: `scaleX(${progress})` }} />
          </div>
          <p className="shrink-0 text-[13px] font-semibold tabular-nums text-[var(--pp-muted)]">
            سؤال {step.item_number} من {step.item_count}
          </p>
        </div>
      )}
    </header>
  );
}

/** The prompt with its gap drawn as a line, read left to right inside the Arabic window. */
function Prompt({ item, filled }: { item: PublicItem; filled: string }) {
  if (item.template === "meaning_choice") {
    return (
      <p dir="ltr" lang="en" className="rita-ex-prompt text-center">
        {item.word}
      </p>
    );
  }
  if (item.template === "syllable_tiles") {
    // The word itself is the answer, so the learner sees its meaning (and later hears it).
    return item.clue_ar ? (
      <p dir="rtl" className="rita-ex-prompt rita-ex-clue">
        {item.clue_ar}
      </p>
    ) : null;
  }
  if (item.template === "word_order") return null;
  const [before, after] = item.prompt.split("___");
  return (
    <p dir="ltr" lang="en" className="rita-ex-prompt">
      {before}
      <span className={`rita-ex-gap ${filled ? "is-filled" : ""}`}>{filled || " "}</span>
      {after ?? ""}
    </p>
  );
}

function QuestionView({
  item,
  step,
  run,
  held,
  onChoose,
  onNext,
}: {
  item: PublicItem;
  step: LessonStep;
  run: LessonRunHandle;
  held: Held | null;
  onChoose?: (chosen: Chosen) => void;
  onNext?: () => void;
}) {
  const [placed, setPlaced] = useState<string[]>(
    held?.chosen?.kind === "tiles" ? held.chosen.ids : [],
  );
  const [pending, setPending] = useState<Chosen | null>(null);
  const lastChoice = useRef<Chosen | null>(held?.chosen ?? null);
  const feedback = held?.feedback ?? (step.feedback?.item_id === item.id ? step.feedback : null);
  const locked = Boolean(held) || run.busy;
  const usesTiles = item.template === "word_order" || item.template === "syllable_tiles";
  const tileText = useMemo(
    () => new Map(item.tiles.map((tile) => [tile.id, tile.text])),
    [item.tiles],
  );

  const submit = useCallback(
    async (chosen: Chosen) => {
      if (locked) return;
      lastChoice.current = chosen;
      onChoose?.(chosen);
      setPending(chosen);
      const response =
        chosen.kind === "choice"
          ? { kind: "choice" as const, value: chosen.value }
          : { kind: "tiles" as const, order: chosen.ids };
      await run.answer(item.id, response, "tap");
      setPending(null);
    },
    [item, locked, onChoose, run],
  );

  // Number keys pick an option; Enter confirms the tiles.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (locked || event.altKey || event.ctrlKey || event.metaKey) return;
      const index = Number(event.key) - 1;
      if (item.options.length && index >= 0 && index < item.options.length) {
        event.preventDefault();
        void submit({ kind: "choice", value: item.options[index] });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item.options, locked, submit]);

  const chosenValue =
    (held?.chosen?.kind === "choice" && held.chosen.value) ||
    (pending?.kind === "choice" && pending.value) ||
    (feedback && lastChoice.current?.kind === "choice" ? lastChoice.current.value : "");
  const filled =
    feedback?.settled && item.template === "choice_fill" ? feedback.answer : chosenValue || "";

  return (
    <div className="flex flex-col gap-5">
      {(item.instruction_ar || item.template === "word_order") && (
        <p className="text-[15px] font-semibold text-[var(--pp-muted)]">
          {item.instruction_ar || "رتّب الكلمات"}
        </p>
      )}
      <Prompt item={item} filled={item.template === "choice_fill" ? filled : ""} />

      {item.options.length > 0 && (
        <div role="group" aria-label="الخيارات" className="rita-ex-options" dir="ltr">
          {item.options.map((option, index) => {
            const isChosen = chosenValue === option;
            const isAnswer = Boolean(feedback?.settled && feedback.answer === option);
            const state = isAnswer
              ? "right"
              : isChosen && feedback && feedback.status !== "unclear" && feedback.status !== "hint"
                ? "wrong"
                : isChosen
                  ? "chosen"
                  : "idle";
            return (
              <button
                key={option}
                type="button"
                data-state={state}
                disabled={locked}
                aria-pressed={isChosen}
                onClick={() => void submit({ kind: "choice", value: option })}
                className="rita-ex-option"
                dir="auto"
              >
                <span className="rita-ex-key" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 text-start">{option}</span>
                {pending?.kind === "choice" && pending.value === option && (
                  <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                )}
                {state === "right" && <Check size={20} aria-label="الجواب الصحيح" />}
                {state === "wrong" && <X size={20} aria-label="مش هاد" />}
              </button>
            );
          })}
        </div>
      )}

      {usesTiles && (
        <TileBuilder
          item={item}
          placed={placed}
          tileText={tileText}
          locked={locked}
          onPlace={(id) => setPlaced((list) => [...list, id])}
          onRemove={(id) => setPlaced((list) => list.filter((value) => value !== id))}
          settled={feedback?.settled ? feedback : null}
        />
      )}

      <FeedbackLine feedback={feedback} item={item} />

      {run.failed && !held && (
        <div role="alert" className="rita-ex-alert">
          <span>ما وصل جوابك. جرّب كمان مرة.</span>
          <button
            type="button"
            className="rita-btn rita-btn-soft rita-btn-sm gap-1.5"
            onClick={() => void run.retry()}
          >
            <RotateCcw size={15} aria-hidden="true" />
            أعد الإرسال
          </button>
        </div>
      )}

      <div className="rita-ex-actions">
        {held ? (
          <button type="button" className="rita-btn rita-btn-primary" onClick={onNext}>
            التالي
          </button>
        ) : (
          <>
            {usesTiles && (
              <button
                type="button"
                className="rita-btn rita-btn-primary gap-2"
                disabled={locked || placed.length !== item.tiles.length}
                onClick={() => void submit({ kind: "tiles", ids: placed })}
              >
                {pending?.kind === "tiles" && (
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                )}
                تأكيد
              </button>
            )}
            <button
              type="button"
              className="rita-btn rita-btn-quiet rita-btn-sm gap-1.5"
              disabled={locked || feedback?.status === "hint"}
              onClick={() => void run.send({ type: "hint", item_id: item.id })}
            >
              <Lightbulb size={15} aria-hidden="true" />
              تلميح
            </button>
            {step.allowed.includes("reveal") && (
              <button
                type="button"
                className="rita-btn rita-btn-quiet rita-btn-sm"
                disabled={locked}
                onClick={() => void run.send({ type: "reveal", item_id: item.id })}
              >
                أظهر الجواب
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TileBuilder({
  item,
  placed,
  tileText,
  locked,
  onPlace,
  onRemove,
  settled,
}: {
  item: PublicItem;
  placed: string[];
  tileText: Map<string, string>;
  locked: boolean;
  onPlace: (id: string) => void;
  onRemove: (id: string) => void;
  settled: Feedback | null;
}) {
  const bank = item.tiles.filter((tile) => !placed.includes(tile.id));
  // Once the question is finished without a right answer, the line shows the right order.
  if (settled && settled.status !== "correct") {
    const words = item.template === "syllable_tiles" ? [settled.answer] : settled.answer.split(" ");
    return (
      <div className="rita-ex-line" dir="ltr" aria-label="الترتيب الصحيح">
        {words.map((word, index) => (
          <span key={`${word}-${index}`} className="rita-ex-tile is-answer">
            {word}
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4" dir="ltr">
      <div
        className="rita-ex-line"
        aria-label={
          item.template === "syllable_tiles" ? "الكلمة اللي ركّبتها" : "الجملة اللي رتّبتها"
        }
        aria-live="polite"
      >
        {placed.length === 0 && (
          <span className="text-[15px] text-[var(--pp-muted)]" dir="rtl">
            اضغط على القطع بالترتيب
          </span>
        )}
        {placed.map((id) => (
          <button
            key={id}
            type="button"
            className="rita-ex-tile is-placed"
            disabled={locked}
            onClick={() => onRemove(id)}
            aria-label={`${tileText.get(id)}، اضغط لترجيعها`}
          >
            {tileText.get(id)}
          </button>
        ))}
      </div>
      <div className="rita-ex-bank" role="group" aria-label="القطع">
        {bank.map((tile) => (
          <button
            key={tile.id}
            type="button"
            className="rita-ex-tile"
            disabled={locked}
            onClick={() => onPlace(tile.id)}
          >
            {tile.text}
          </button>
        ))}
      </div>
    </div>
  );
}

function FeedbackLine({ feedback, item }: { feedback: Feedback | null; item: PublicItem }) {
  if (!feedback || feedback.item_id !== item.id) return <p role="status" className="sr-only" />;
  let tone: "right" | "wrong" | "info" = "info";
  let title = "";
  let answer = "";
  let body = "";
  switch (feedback.status) {
    case "correct":
      tone = "right";
      title = "صح";
      body = feedback.explain_ar;
      break;
    case "wrong":
      tone = "wrong";
      title = "مش هيك، جرّب مرة ثانية";
      body = feedback.hint_ar;
      break;
    case "revealed":
      tone = "wrong";
      title = "الجواب الصحيح:";
      answer = feedback.answer;
      body = feedback.explain_ar;
      break;
    case "hint":
      title = "تلميح";
      body = feedback.hint_ar || "فكّر بالفاعل: مين عم نحكي عنه؟";
      break;
    case "unclear":
      title =
        feedback.unclear_reason === "tap_to_answer"
          ? "هاد التمرين بالضغط، رتّب القطع"
          : "ما سمعتها منيح، اضغط على الخيار";
      break;
  }
  return (
    <div role="status" className="rita-ex-feedback" data-tone={tone}>
      <p className="flex items-center gap-2 font-bold">
        {tone === "right" && <Check size={18} aria-hidden="true" />}
        {tone === "wrong" && <X size={18} aria-hidden="true" />}
        {tone === "info" && <Lightbulb size={18} aria-hidden="true" />}
        <span>{title}</span>
        {answer && (
          <bdi dir="ltr" lang="en">
            {answer}
          </bdi>
        )}
      </p>
      {body && <ChatText text={body} className="mt-1 text-[15px] leading-relaxed" />}
    </div>
  );
}

function SectionResult({ step, run }: { step: LessonStep; run: LessonRunHandle }) {
  const result = step.section_result;
  if (!result) return null;
  const title =
    result.outcome === "passed"
      ? "ممتاز، خلصنا هالجزء"
      : result.outcome === "passed_after_help"
        ? "تمام، بعد المراجعة صارت أوضح"
        : "بنكمل، وبنرجع لهالنقطة بالمراجعة";
  const last = step.section && step.section.index + 1 >= step.section.count;
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <p className="text-[44px] font-bold leading-none tabular-nums text-[var(--pp-ink)]">
        {result.first_try}{" "}
        <span className="text-[24px] text-[var(--pp-muted)]">من {result.asked}</span>
      </p>
      <p className="text-[15px] font-semibold text-[var(--pp-muted)]">صح من أول مرة، بدون مساعدة</p>
      <p role="status" className="text-[20px] font-bold text-[var(--pp-ink)]">
        {title}
      </p>
      <button
        type="button"
        className="rita-btn rita-btn-primary mt-2 gap-2"
        disabled={run.busy}
        onClick={() => void run.send({ type: "ready" })}
      >
        {run.busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
        {last ? "للملخص" : "للجزء الجاي"}
      </button>
    </div>
  );
}

function PausedBar({ step, run }: { step: LessonStep; run: LessonRunHandle }) {
  return (
    <div
      className="rita-ex-paused edith-premium"
      dir="rtl"
      role="region"
      aria-label="التمرين متوقف"
    >
      <p className="min-w-0 flex-1 truncate text-[15px] font-semibold">
        التمرين متوقف
        {step.item_count ? ` · سؤال ${step.item_number} من ${step.item_count}` : ""}
      </p>
      <button
        type="button"
        className="rita-btn rita-btn-primary rita-btn-sm gap-1.5"
        disabled={run.busy}
        onClick={() => void run.send({ type: "resume" })}
      >
        <Play size={15} aria-hidden="true" />
        كمّل
      </button>
    </div>
  );
}
