import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Pencil, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { readBoard, writeBoard } from "@/lib/local-board";
import { readCards, writeCards } from "@/lib/use-flashcards";
import { ensurePlace, mergeCards, removeCards } from "@/lib/card-save";

export type DeckCard = { id: string; front: string; back: string; note: string; on: boolean };

export type Deck = {
  cards: DeckCard[];
  status: "loading" | "ready" | "error";
  message: string;
  quote: string;
};

const LAST_SUBJECT = "uzyra-cards-last-subject";
const NEW = "__new__";

function remembered(): string {
  try {
    return window.localStorage.getItem(LAST_SUBJECT) ?? "";
  } catch {
    return "";
  }
}

/**
 * The flashcards made from selections, inside the floating window. Each card flips between its
 * word and its meaning, can be edited, removed or left out, and the chosen ones are saved straight
 * into the learner's flashcards: an existing subject and sub-subject, or new ones typed right here.
 * Repeats are skipped, and the last save can be undone.
 */
export function CardsPanel({
  deck,
  lessonTitle,
  onChange,
  onRetry,
}: {
  deck: Deck;
  lessonTitle: string;
  onChange: (cards: DeckCard[]) => void;
  onRetry: () => void;
}) {
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState("");
  const [draft, setDraft] = useState({ front: "", back: "" });
  const [board, setBoard] = useState(() => readBoard());
  const [subject, setSubject] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [sub, setSub] = useState("");
  const [newSub, setNewSub] = useState("");
  const [saved, setSaved] = useState<{
    subject: string;
    sub: string;
    ids: string[];
    added: number;
    skipped: number;
  } | null>(null);

  // First choice: the subject used last time (when it still exists), and a sub-subject named
  // after this lesson.
  useEffect(() => {
    const list = readBoard();
    setBoard(list);
    const last = remembered();
    const pick = list.find((s) => s.name === last)?.name ?? list[0]?.name ?? NEW;
    setSubject(pick);
    const subs = list.find((s) => s.name === pick)?.subs ?? [];
    const lesson = subs.find((x) => x.name === lessonTitle);
    setSub(lesson ? lesson.name : NEW);
    setNewSub(lessonTitle.slice(0, 60));
  }, [lessonTitle]);

  const subsOf = useMemo(() => board.find((s) => s.name === subject)?.subs ?? [], [board, subject]);
  const chosen = deck.cards.filter((card) => card.on);
  const subjectName = subject === NEW ? newSubject.trim() : subject;
  const subName = sub === NEW ? newSub.trim() : sub;
  const canSave = chosen.length > 0 && subjectName.length > 0 && subName.length > 0;

  function update(id: string, patch: Partial<DeckCard>) {
    onChange(deck.cards.map((card) => (card.id === id ? { ...card, ...patch } : card)));
  }

  function save() {
    if (!canSave) return;
    const place = ensurePlace(readBoard(), subjectName, subName);
    writeBoard(place.board);
    const existing = readCards(place.subject, place.sub);
    const stamp = Date.now().toString(36);
    const { added, skipped } = mergeCards(existing, chosen, (index) => `${stamp}-uz-${index}`);
    writeCards(place.subject, place.sub, [...existing, ...added]);
    try {
      window.localStorage.setItem(LAST_SUBJECT, place.subject);
    } catch {
      /* the choice is not remembered this time */
    }
    setBoard(place.board);
    setSubject(place.subject);
    setSub(place.sub);
    setSaved({
      subject: place.subject,
      sub: place.sub,
      ids: added.map((card) => card.id),
      added: added.length,
      skipped,
    });
  }

  function undo() {
    if (!saved) return;
    writeCards(
      saved.subject,
      saved.sub,
      removeCards(readCards(saved.subject, saved.sub), saved.ids),
    );
    setSaved(null);
  }

  return (
    <div className="cp" dir="rtl">
      <div className="cp-head">
        <p className="cp-count">
          {deck.cards.length} {deck.cards.length === 1 ? "بطاقة" : "بطاقات"}
          {chosen.length !== deck.cards.length && (
            <span className="cp-muted"> · محدد {chosen.length}</span>
          )}
        </p>
        {deck.quote && (
          <p className="cp-quote" dir="auto">
            «{deck.quote.length > 70 ? `${deck.quote.slice(0, 70)}…` : deck.quote}»
          </p>
        )}
      </div>

      <div className="cp-list">
        {deck.cards.map((card, index) =>
          editing === card.id ? (
            <div key={card.id} className="cp-card is-editing">
              <input
                dir="auto"
                value={draft.front}
                onChange={(event) => setDraft({ ...draft, front: event.target.value })}
                aria-label="وجه البطاقة"
                maxLength={120}
              />
              <textarea
                dir="auto"
                value={draft.back}
                onChange={(event) => setDraft({ ...draft, back: event.target.value })}
                aria-label="المعنى"
                rows={2}
                maxLength={250}
              />
              <div className="cp-edit-actions">
                <button type="button" onClick={() => setEditing("")}>
                  إلغاء
                </button>
                <button
                  type="button"
                  className="is-primary"
                  disabled={!draft.front.trim() || !draft.back.trim()}
                  onClick={() => {
                    update(card.id, { front: draft.front.trim(), back: draft.back.trim() });
                    setEditing("");
                  }}
                >
                  احفظ
                </button>
              </div>
            </div>
          ) : (
            <div
              key={card.id}
              className="cp-card"
              data-off={card.on ? undefined : ""}
              data-flipped={flipped.has(card.id) ? "" : undefined}
              style={{ ["--i" as string]: index }}
            >
              <button
                type="button"
                className="cp-flip"
                onClick={() =>
                  setFlipped((current) => {
                    const next = new Set(current);
                    if (next.has(card.id)) next.delete(card.id);
                    else next.add(card.id);
                    return next;
                  })
                }
                aria-label={`اقلب البطاقة: ${card.front}`}
              >
                <span className="cp-face is-front" dir="auto">
                  {card.front}
                </span>
                <span className="cp-face is-back" dir="auto">
                  {card.back}
                  {card.note && <small>{card.note}</small>}
                </span>
              </button>
              <div className="cp-tools">
                <button
                  type="button"
                  className="cp-check"
                  aria-pressed={card.on}
                  aria-label={card.on ? "شيلها من الحفظ" : "رجّعها للحفظ"}
                  onClick={() => update(card.id, { on: !card.on })}
                >
                  {card.on && <Check size={11} strokeWidth={3.2} />}
                </button>
                <button
                  type="button"
                  aria-label="عدّل البطاقة"
                  onClick={() => {
                    setDraft({ front: card.front, back: card.back });
                    setEditing(card.id);
                  }}
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  aria-label="احذف البطاقة"
                  onClick={() => onChange(deck.cards.filter((item) => item.id !== card.id))}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ),
        )}
        {deck.status === "loading" &&
          [0, 1, 2].map((n) => (
            <div key={`s${n}`} className="cp-card is-skeleton" aria-hidden="true" />
          ))}
      </div>

      {deck.status === "loading" && (
        <p className="cp-state" role="status">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          بتجهّز البطاقات…
        </p>
      )}
      {deck.status === "error" && (
        <div className="cp-state is-error" role="alert">
          <p>{deck.message}</p>
          <button type="button" onClick={onRetry}>
            <RotateCcw size={13} aria-hidden="true" />
            جرّب مرة ثانية
          </button>
        </div>
      )}
      {deck.status === "ready" && deck.cards.length === 0 && (
        <p className="cp-state">ما ضل بطاقات. حدّد جزء ثاني واختار «بطاقات».</p>
      )}

      <div className="cp-save">
        {saved ? (
          <div className="cp-done" role="status">
            <p>
              انحفظت {saved.added} بـ <b>{saved.subject}</b> · {saved.sub}
              {saved.skipped > 0 && (
                <span className="cp-muted"> · تخطّينا {saved.skipped} مكررين</span>
              )}
            </p>
            <div className="cp-done-actions">
              <button type="button" onClick={undo}>
                <Undo2 size={13} aria-hidden="true" />
                تراجع
              </button>
              <Link to="/study" className="is-primary">
                افتح البطاقات
              </Link>
              <button type="button" onClick={() => setSaved(null)}>
                احفظ بمكان ثاني
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="cp-fields">
              <label>
                <span>المادة</span>
                <select
                  value={subject}
                  onChange={(event) => {
                    setSubject(event.target.value);
                    const subs = board.find((s) => s.name === event.target.value)?.subs ?? [];
                    setSub(subs.find((x) => x.name === lessonTitle)?.name ?? NEW);
                  }}
                >
                  {board.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                  <option value={NEW}>+ مادة جديدة</option>
                </select>
                {subject === NEW && (
                  <input
                    dir="auto"
                    value={newSubject}
                    onChange={(event) => setNewSubject(event.target.value)}
                    placeholder="اسم المادة"
                    maxLength={60}
                    autoFocus
                  />
                )}
              </label>
              <label>
                <span>القسم</span>
                <select value={sub} onChange={(event) => setSub(event.target.value)}>
                  {subject !== NEW &&
                    subsOf.map((x) => (
                      <option key={x.name} value={x.name}>
                        {x.name}
                      </option>
                    ))}
                  <option value={NEW}>+ قسم جديد</option>
                </select>
                {sub === NEW && (
                  <input
                    dir="auto"
                    value={newSub}
                    onChange={(event) => setNewSub(event.target.value)}
                    placeholder="اسم القسم"
                    maxLength={60}
                  />
                )}
              </label>
            </div>
            <button type="button" className="cp-go" disabled={!canSave} onClick={save}>
              احفظ {chosen.length} {chosen.length === 1 ? "بطاقة" : "بطاقات"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
