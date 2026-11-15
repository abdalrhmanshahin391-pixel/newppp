// «احفظ»: under the practice in the floating window (a lesson or a book). Questions go to Lecture
// Lab as a small lecture in a sub-subject the learner picks or makes here; cards go to the
// flashcards board (the learning language's board) the same way. Every item starts ticked; the
// learner can untick any. Nothing is reported as saved until it really is.
import { useEffect, useId, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, FolderPlus, Loader2, Plus } from "lucide-react";
import {
  lqAddSubject,
  lqAddSubtopic,
  lqBoard,
  lqSaveStudyQuestions,
} from "@/lib/lecture-lab.functions";
import { useStudySubjects } from "@/lib/use-study-subjects";
import { CARD_LIMIT, readCards, writeCards } from "@/lib/use-flashcards";
import {
  cardFaces,
  newCards,
  picked,
  savedLectureTitle,
  toLectureQuestions,
} from "@/lib/study/practice-save";
import type { StudyCard, StudyMcq } from "@/lib/study/study-practice";

type Source = { title: string; quote: string };
type Done = { text: string; to: "/study/lectures" | "/study" };

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function errorText(cause: unknown) {
  return cause instanceof Error && cause.message ? cause.message : "ما زبط الحفظ. جرّب مرة ثانية.";
}

export function PracticeSave({
  kind,
  cards,
  questions,
  source,
}: {
  kind: "cards" | "questions";
  cards: StudyCard[];
  questions: StudyMcq[];
  source: Source;
}) {
  const items = kind === "cards" ? cards : questions;
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const noun = kind === "cards" ? "البطاقات" : "الأسئلة";
  const where = kind === "cards" ? "الفلاش كاردز" : "مختبر المحاضرات";
  if (!items.length) return null;
  return (
    <section className="st-save" aria-label={`احفظ ${noun}`}>
      {done && !open ? (
        <p className="st-save-done" role="status">
          <Check size={16} aria-hidden="true" />
          <span>{done.text}</span>
          <Link to={done.to} className="st-save-link">
            افتح
          </Link>
          <button type="button" className="st-save-again" onClick={() => setOpen(true)}>
            احفظ بمكان ثاني
          </button>
        </p>
      ) : !open ? (
        <button type="button" className="st-save-open" onClick={() => setOpen(true)}>
          <FolderPlus size={17} aria-hidden="true" />
          احفظ {noun} في {where}
        </button>
      ) : kind === "cards" ? (
        <SaveCards
          cards={cards}
          onCancel={() => setOpen(false)}
          onDone={(next) => {
            setDone(next);
            setOpen(false);
          }}
        />
      ) : (
        <SaveQuestions
          questions={questions}
          source={source}
          onCancel={() => setOpen(false)}
          onDone={(next) => {
            setDone(next);
            setOpen(false);
          }}
        />
      )}
    </section>
  );
}

/** The ticked list: every item starts ticked; "الكل" ticks or unticks them all. */
function Ticks({
  labels,
  chosen,
  onChange,
}: {
  labels: { main: string; sub: string }[];
  chosen: Set<number>;
  onChange: (next: Set<number>) => void;
}) {
  const all = chosen.size === labels.length;
  return (
    <fieldset className="st-save-ticks">
      <legend className="st-save-label">
        شو بدك تحفظ؟
        <button
          type="button"
          className="st-save-all"
          onClick={() => onChange(all ? new Set() : new Set(labels.map((_, index) => index)))}
        >
          {all ? "شيل الكل" : "اختار الكل"}
        </button>
      </legend>
      <ul>
        {labels.map((label, index) => (
          <li key={index}>
            <label className="st-save-tick">
              <input
                type="checkbox"
                checked={chosen.has(index)}
                onChange={(event) => {
                  const next = new Set(chosen);
                  if (event.target.checked) next.add(index);
                  else next.delete(index);
                  onChange(next);
                }}
              />
              <span>
                <span dir="auto" className="st-save-main">
                  {label.main}
                </span>
                {label.sub && (
                  <span dir="auto" className="st-save-sub">
                    {label.sub}
                  </span>
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

/** A picker with "+ new" beside it: choosing «جديدة» turns it into a name field. */
function Picker({
  label,
  value,
  options,
  disabled,
  newLabel,
  placeholder,
  onChoose,
  onCreate,
}: {
  label: string;
  value: string;
  options: { id: string; name: string }[];
  disabled?: boolean;
  newLabel: string;
  placeholder: string;
  onChoose: (id: string) => void;
  onCreate: (name: string) => Promise<void> | void;
}) {
  const id = useId();
  const [making, setMaking] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  async function create() {
    const clean = name.trim();
    if (!clean || busy) return;
    setBusy(true);
    try {
      await onCreate(clean);
      setName("");
      setMaking(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="st-save-field">
      <label htmlFor={id} className="st-save-label">
        {label}
      </label>
      {making ? (
        <div className="st-save-new">
          <input
            id={id}
            value={name}
            autoFocus
            maxLength={120}
            dir="auto"
            placeholder={placeholder}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void create();
              }
              if (event.key === "Escape") setMaking(false);
            }}
          />
          <button
            type="button"
            className="rita-btn rita-btn-primary rita-btn-sm"
            disabled={!name.trim() || busy}
            onClick={() => void create()}
          >
            {busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : "أضف"}
          </button>
          <button
            type="button"
            className="rita-btn rita-btn-quiet rita-btn-sm"
            onClick={() => setMaking(false)}
          >
            إلغاء
          </button>
        </div>
      ) : (
        <div className="st-save-row">
          <select
            id={id}
            value={value}
            disabled={disabled}
            onChange={(event) => onChoose(event.target.value)}
          >
            <option value="">{options.length ? "اختار…" : "ما في لسا"}</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="st-save-plus"
            disabled={disabled}
            onClick={() => setMaking(true)}
          >
            <Plus size={15} aria-hidden="true" />
            {newLabel}
          </button>
        </div>
      )}
    </div>
  );
}

function Actions({
  count,
  noun,
  busy,
  ready,
  error,
  onCancel,
  onSave,
}: {
  count: number;
  noun: string;
  busy: boolean;
  ready: boolean;
  error: string;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <>
      {error && (
        <p className="st-save-error" role="alert" dir="auto">
          {error}
        </p>
      )}
      <div className="st-save-actions">
        <button type="button" className="rita-btn rita-btn-quiet" onClick={onCancel}>
          إلغاء
        </button>
        <button
          type="button"
          className="rita-btn rita-btn-primary"
          disabled={!ready || busy || count === 0}
          onClick={onSave}
        >
          {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          احفظ {count} {noun}
        </button>
      </div>
    </>
  );
}

type Board = {
  subjects: { id: string; name: string }[];
  subtopics: { id: string; subject_id: string; name: string }[];
};

function SaveQuestions({
  questions,
  source,
  onCancel,
  onDone,
}: {
  questions: StudyMcq[];
  source: Source;
  onCancel: () => void;
  onDone: (done: Done) => void;
}) {
  const boardFn = useServerFn(lqBoard);
  const addSubjectFn = useServerFn(lqAddSubject);
  const addSubtopicFn = useServerFn(lqAddSubtopic);
  const saveFn = useServerFn(lqSaveStudyQuestions);
  const [board, setBoard] = useState<Board | null>(null);
  const [subjectId, setSubjectId] = useState("");
  const [subtopicId, setSubtopicId] = useState("");
  const [chosen, setChosen] = useState(() => new Set(questions.map((_, index) => index)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    // Only the learner's own shelf: the example shelf is read-only.
    const result = (await boardFn()) as {
      subjects: { id: string; name: string; is_example?: boolean }[];
      subtopics: { id: string; subject_id: string; name: string; is_example?: boolean }[];
    };
    const next = {
      subjects: result.subjects.filter((row) => !row.is_example),
      subtopics: result.subtopics.filter((row) => !row.is_example),
    };
    setBoard(next);
    return next;
  }
  useEffect(() => {
    load().catch((cause) => setError(errorText(cause)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subtopics = useMemo(
    () => (board?.subtopics ?? []).filter((row) => row.subject_id === subjectId),
    [board, subjectId],
  );

  async function save() {
    const subtopic = board?.subtopics.find((row) => row.id === subtopicId);
    const subject = board?.subjects.find((row) => row.id === subjectId);
    if (!subtopic || !subject) return;
    const ready = toLectureQuestions(picked(questions, chosen), source.quote);
    if (!ready.length) {
      setError("ما في سؤال كامل لنحفظه.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await saveFn({
        data: {
          subtopicId,
          title: savedLectureTitle(source.title, source.quote),
          sourceName: source.title.slice(0, 200),
          questions: ready,
        },
      });
      onDone({
        text: `انحفظ ${result.saved === 1 ? "سؤال" : `${result.saved} أسئلة`} في «${subject.name} / ${subtopic.name}»`,
        to: "/study/lectures",
      });
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="st-save-panel">
      <Ticks
        labels={questions.map((q) => ({ main: q.question, sub: q.options[q.answer] ?? "" }))}
        chosen={chosen}
        onChange={setChosen}
      />
      <p className="st-save-where">
        بتنحفظ بمختبر المحاضرات، وبتقدر تحلّها هناك بوضع الدراسة أو الامتحان.
      </p>
      {!board && !error ? (
        <p className="st-save-loading" role="status">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" /> بنجيب موادك…
        </p>
      ) : (
        <div className="st-save-grid">
          <Picker
            label="المادة"
            value={subjectId}
            options={board?.subjects ?? []}
            newLabel="مادة جديدة"
            placeholder="مثلاً: English Grammar"
            onChoose={(id) => {
              setSubjectId(id);
              setSubtopicId("");
            }}
            onCreate={async (name) => {
              try {
                const { id } = await addSubjectFn({ data: { name } });
                await load();
                setSubjectId(id);
                setSubtopicId("");
              } catch (cause) {
                setError(errorText(cause));
              }
            }}
          />
          <Picker
            label="المادة الفرعية"
            value={subtopicId}
            options={subtopics}
            disabled={!subjectId}
            newLabel="فرعية جديدة"
            placeholder="مثلاً: Present simple"
            onChoose={setSubtopicId}
            onCreate={async (name) => {
              try {
                const { id } = await addSubtopicFn({ data: { subjectId, name } });
                await load();
                setSubtopicId(id);
              } catch (cause) {
                setError(errorText(cause));
              }
            }}
          />
        </div>
      )}
      <Actions
        count={chosen.size}
        noun={chosen.size === 1 ? "سؤال" : "أسئلة"}
        busy={busy}
        ready={Boolean(subjectId && subtopicId)}
        error={error}
        onCancel={onCancel}
        onSave={() => void save()}
      />
    </div>
  );
}

function SaveCards({
  cards,
  onCancel,
  onDone,
}: {
  cards: StudyCard[];
  onCancel: () => void;
  onDone: (done: Done) => void;
}) {
  // The board of the learning language, the same one the flashcards page shows.
  const board = useStudySubjects();
  const [si, setSi] = useState("");
  const [sj, setSj] = useState("");
  const [chosen, setChosen] = useState(() => new Set(cards.map((_, index) => index)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const subject = si === "" ? undefined : board.subjects[Number(si)];
  const sub = sj === "" || !subject ? undefined : subject.subs[Number(sj)];

  function save() {
    if (!subject || !sub) return;
    setBusy(true);
    setError("");
    try {
      const existing = readCards(subject.name, sub.name);
      const faces = picked(cards, chosen).map(cardFaces);
      const { add, skipped } = newCards(existing, faces);
      const room = Math.max(0, CARD_LIMIT - existing.length);
      const kept = add.slice(0, room);
      if (!kept.length) {
        setError(
          add.length
            ? `هالمادة الفرعية مليانة (${CARD_LIMIT} بطاقة). اختار وحدة ثانية.`
            : "كل هالبطاقات موجودة أصلاً بهالمكان.",
        );
        return;
      }
      writeCards(subject.name, sub.name, [
        ...existing,
        ...kept.map((card) => ({ id: newId(), front: card.front, back: card.back })),
      ]);
      const parts = [
        `انحفظ ${kept.length === 1 ? "بطاقة" : `${kept.length} بطاقات`} في «${subject.name} / ${sub.name}»`,
      ];
      if (skipped) parts.push(`${skipped} كانت موجودة`);
      onDone({ text: parts.join(" · "), to: "/study" });
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="st-save-panel">
      <Ticks
        labels={cards.map((card) => ({ main: card.front, sub: card.back }))}
        chosen={chosen}
        onChange={setChosen}
      />
      <p className="st-save-where">بتنحفظ بصفحة الفلاش كاردز، بلغتك الحالية.</p>
      <div className="st-save-grid">
        <Picker
          label="المادة"
          value={si}
          options={board.subjects.map((row, index) => ({ id: String(index), name: row.name }))}
          newLabel="مادة جديدة"
          placeholder="مثلاً: Vocabulary"
          onChoose={(value) => {
            setSi(value);
            setSj("");
          }}
          onCreate={(name) => {
            if (board.subjects.some((row) => row.name.trim() === name)) {
              setSi(String(board.subjects.findIndex((row) => row.name.trim() === name)));
            } else {
              board.addSubject(name);
              setSi(String(board.subjects.length));
            }
            setSj("");
          }}
        />
        <Picker
          label="المادة الفرعية"
          value={sj}
          options={(subject?.subs ?? []).map((row, index) => ({
            id: String(index),
            name: row.name,
          }))}
          disabled={!subject}
          newLabel="فرعية جديدة"
          placeholder="مثلاً: Animals"
          onChoose={setSj}
          onCreate={(name) => {
            if (!subject) return;
            const at = subject.subs.findIndex((row) => row.name.trim() === name);
            if (at >= 0) setSj(String(at));
            else {
              board.addSub(Number(si), name);
              setSj(String(subject.subs.length));
            }
          }}
        />
      </div>
      <Actions
        count={chosen.size}
        noun={chosen.size === 1 ? "بطاقة" : "بطاقات"}
        busy={busy}
        ready={Boolean(subject && sub)}
        error={error}
        onCancel={onCancel}
        onSave={save}
      />
    </div>
  );
}
