import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  CircleHelp,
  Lightbulb,
  RotateCcw,
  Undo2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { RitaFace } from "@/components/brand/RitaBrand";
import { CATEGORY_COLORS } from "@/lib/books";
import { checkMove, maskOf, type Path } from "@/lib/wordcraft/engine";
import { DICTIONARY, type Round } from "@/lib/wordcraft/round";
import {
  extendPath,
  hintTiles,
  tileAt,
  tilesAlong,
  type BoardGeometry,
  clock,
} from "@/lib/wordcraft/game";
import { LEVEL_NAMES } from "./levels";
import { sounds } from "./wordcraft-sound";

type Lang = "en" | "ar";
type Tone = "info" | "good" | "warn";

/** Found words take these calm colours in turn (a colour codes a word; it is never the only sign). */
const WORD_TONES = (["teal", "amber", "violet", "rose", "sky", "green"] as const).map(
  (k) => CATEGORY_COLORS[k],
);

const reduced = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * One Wordcraft round: Rita's line, the letter grid, the word slots with their Arabic meanings,
 * and, once every tile is used, the words with their examples to learn from.
 */
export function WordcraftGame({
  round: puzzle,
  lang,
  muted,
  onMute,
  onNext,
  note,
}: {
  round: Round;
  lang: Lang;
  muted: boolean;
  onMute: () => void;
  /** Starts a new round at the same level. */
  onNext: () => void;
  /** A quiet line under the board (where the words came from, when it matters). */
  note?: string | null;
}) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const grid = useMemo(
    () => ({ rows: puzzle.rows, cols: puzzle.cols, letters: puzzle.letters }),
    [puzzle],
  );
  const total = puzzle.rows * puzzle.cols;
  const [solved, setSolved] = useState<number[]>([]);
  const [path, setPath] = useState<Path>([]);
  const [focus, setFocus] = useState(0);
  const [hints, setHints] = useState<Record<number, number>>({});
  const [hintCount, setHintCount] = useState(0);
  const [bubble, setBubble] = useState<{ tone: Tone; text: string }>({
    tone: "info",
    text: t(
      "Slide across neighbouring letters to make the words. Their meanings are below.",
      "مرّر إصبعك على الحروف المتجاورة وكوّن الكلمات. معانيها تحت.",
    ),
  });
  const [help, setHelp] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const started = useRef(Date.now());
  const board = useRef<HTMLDivElement>(null);
  const tilesBox = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const fly = useRef<{ word: number; from: DOMRect[] } | null>(null);
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    moved: boolean;
    startLen: number;
  } | null>(null);
  const play = useCallback(
    (fn: () => void) => {
      if (!muted) fn();
    },
    [muted],
  );

  const solvedSet = useMemo(() => new Set(solved), [solved]);
  const usedTiles = useMemo(() => {
    const set = new Set<number>();
    for (const i of solved) for (const p of puzzle.paths[i]) set.add(p);
    return set;
  }, [solved, puzzle.paths]);
  const done = solved.length === puzzle.words.length;
  const toneOf = (wordIndex: number) => WORD_TONES[solved.indexOf(wordIndex) % WORD_TONES.length];
  const tileWord = useMemo(() => {
    const map = new Map<number, number>();
    for (const i of solved) for (const p of puzzle.paths[i]) map.set(p, i);
    return map;
  }, [solved, puzzle.paths]);
  // Tiles a hint shows: the first unsolved word with a hint, in order.
  const hinted = useMemo(() => {
    const out = new Map<number, number>();
    for (const [w, level] of Object.entries(hints)) {
      const i = Number(w);
      if (solvedSet.has(i)) continue;
      hintTiles(puzzle.paths[i], level).forEach((tile, k) => out.set(tile, k + 1));
    }
    return out;
  }, [hints, solvedSet, puzzle.paths]);

  // A new puzzle starts fresh.
  useEffect(() => {
    setSolved([]);
    setPath([]);
    setHints({});
    setHintCount(0);
    setFocus(0);
    started.current = Date.now();
    setSeconds(0);
  }, [puzzle]);

  // Letters of a found word travel from the grid into its slot.
  useLayoutEffect(() => {
    const job = fly.current;
    fly.current = null;
    if (!job || reduced()) return;
    job.from.forEach((rect, k) => {
      const el = document.querySelector<HTMLElement>(`[data-slot-cell="${job.word}-${k}"]`);
      if (!el) return;
      const to = el.getBoundingClientRect();
      const dx = rect.left + rect.width / 2 - (to.left + to.width / 2);
      const dy = rect.top + rect.height / 2 - (to.top + to.height / 2);
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${rect.width / Math.max(1, to.width)})` },
          { transform: "none" },
        ],
        {
          duration: 320,
          delay: k * 30,
          easing: "cubic-bezier(0.23, 1, 0.32, 1)",
          fill: "backwards",
        },
      );
    });
  }, [solved]);

  function say(tone: Tone, text: string) {
    setBubble({ tone, text });
  }

  function shake() {
    if (reduced()) return;
    board.current?.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-6px)" },
        { transform: "translateX(6px)" },
        { transform: "translateX(-3px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 200, easing: "ease-out" },
    );
  }

  function finish() {
    const secs = Math.round((Date.now() - started.current) / 1000);
    setSeconds(secs);
    play(sounds.done);
    say(
      "good",
      t("The whole grid is done. Here are your words.", "خلّصت الشبكة كلها. هاي كلماتك."),
    );
  }

  function submit(candidate: Path) {
    if (candidate.length < 2) return;
    const used = maskOf([...usedTiles]);
    const result = checkMove(grid, puzzle.words, solvedSet, used, candidate, DICTIONARY);
    const typed = candidate.map((p) => puzzle.letters[p]).join("");
    if (result.kind === "locked") {
      fly.current = {
        word: result.index,
        from: candidate.map((p) => tileRefs.current[p]!.getBoundingClientRect()),
      };
      const next = [...solved, result.index];
      setSolved(next);
      setPath([]);
      say("good", `${result.word} = ${puzzle.info[result.index]?.ar ?? ""}`);
      if (typeof navigator !== "undefined") navigator.vibrate?.(10);
      if (next.length === puzzle.words.length) finish();
      else play(sounds.word);
      return;
    }
    setPath([]);
    play(sounds.miss);
    shake();
    if (result.kind === "blocks")
      say(
        "warn",
        t(
          `${typed} is right, but that route leaves letters you cannot use. Try another way.`,
          `${typed} صحيحة، بس طريقها بيترك حروف ما بتنفع. جرّب طريق تاني.`,
        ),
      );
    else if (result.kind === "other_word")
      say(
        "warn",
        t(
          `${typed} is a real word, but not one of this round's.`,
          `${typed} كلمة إنجليزية، بس مش من كلمات هالجولة.`,
        ),
      );
    else
      say(
        "warn",
        t(
          `${typed} is not one of the words. Try again.`,
          `${typed} مش من كلمات الجولة. جرّب كمان مرة.`,
        ),
      );
  }

  // ---- pointer: drag across tiles, or tap them one by one ----------------------------------

  /** The tile area: equal cells, each tile drawn inside its cell (the gap is the cell's margin). */
  function geometry(): BoardGeometry | null {
    const box = tilesBox.current?.getBoundingClientRect();
    if (!box) return null;
    const pitch = box.width / puzzle.cols;
    return {
      left: box.left,
      top: box.top,
      pitch,
      size: pitch,
      rows: puzzle.rows,
      cols: puzzle.cols,
    };
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (done || event.button > 0) return;
    const g = geometry();
    if (!g) return;
    const tile = tileAt(event.clientX, event.clientY, g, 0.92);
    if (tile < 0 || usedTiles.has(tile)) return;
    event.preventDefault();
    // Tapping the last letter again sends the word (tapping letters one by one).
    if (path.length >= 2 && path[path.length - 1] === tile) return submit(path);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* the pointer may already be gone */
    }
    // A tap next to the end of the path carries on (tapping letters one by one); otherwise a
    // new path starts here.
    const carried = extendPath(path, tile, puzzle.cols, usedTiles);
    const next = carried !== path && path.length ? carried : [tile];
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      startLen: next.length,
    };
    setPath(next);
    setFocus(tile);
    play(() => sounds.tick(next.length));
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    const g = geometry();
    if (!g) return;
    const passed = tilesAlong(d.x, d.y, event.clientX, event.clientY, g);
    d.x = event.clientX;
    d.y = event.clientY;
    if (!passed.length) return;
    setPath((current) => {
      let next = current;
      for (const tile of passed) next = extendPath(next, tile, puzzle.cols, usedTiles);
      if (next !== current) {
        d.moved = true;
        if (next.length > current.length) play(() => sounds.tick(next.length));
        setFocus(next[next.length - 1] ?? 0);
      }
      return next;
    });
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    drag.current = null;
    if (event.type === "pointercancel") return setPath([]);
    // A drag sends the word when the finger lifts; taps send it once it spells an open word.
    if (d.moved) return submit(path);
    autoSubmit(path);
  }

  function autoSubmit(candidate: Path) {
    const word = candidate.map((p) => puzzle.letters[p]).join("");
    if (puzzle.words.some((w, i) => w === word && !solvedSet.has(i))) submit(candidate);
  }

  // ---- keyboard: arrows move, Space adds the letter, Enter sends, Backspace takes one off -----

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (done) return;
    const r = Math.floor(focus / puzzle.cols);
    const c = focus % puzzle.cols;
    const move = (to: number) => {
      event.preventDefault();
      setFocus(to);
      tileRefs.current[to]?.focus();
    };
    // The grid is English, left to right, whatever the page direction.
    if (event.key === "ArrowRight" && c < puzzle.cols - 1) return move(focus + 1);
    if (event.key === "ArrowLeft" && c > 0) return move(focus - 1);
    if (event.key === "ArrowDown" && r < puzzle.rows - 1) return move(focus + puzzle.cols);
    if (event.key === "ArrowUp" && r > 0) return move(focus - puzzle.cols);
    if (event.key === " " || (event.key === "Enter" && path[path.length - 1] !== focus)) {
      event.preventDefault();
      if (usedTiles.has(focus)) return;
      const next = path.length ? extendPath(path, focus, puzzle.cols, usedTiles) : [focus];
      const fresh = next === path ? [focus] : next;
      setPath(fresh);
      play(() => sounds.tick(fresh.length));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      return submit(path);
    }
    if (event.key === "Backspace") {
      event.preventDefault();
      return setPath((p) => p.slice(0, -1));
    }
    if (event.key === "Escape") return setPath([]);
  }

  // ---- tools ---------------------------------------------------------------------------------

  /**
   * A hint shows one more tile of a word, in order (the word already being hinted first), so the
   * player still traces it: first its start, then the next letter, up to the whole route.
   */
  function hint() {
    const started = Object.keys(hints)
      .map(Number)
      .find((w) => !solvedSet.has(w) && hints[w] < puzzle.words[w].length);
    const i =
      started ??
      puzzle.words.findIndex(
        (_, w) => !solvedSet.has(w) && (hints[w] ?? 0) < puzzle.words[w].length,
      );
    if (i < 0) return;
    const level = (hints[i] ?? 0) + 1;
    setHints((h) => ({ ...h, [i]: level }));
    setHintCount((n) => n + 1);
    setPath([]);
    const meaning = puzzle.info[i]?.ar ?? "";
    say(
      "info",
      level === 1
        ? t(
            `The word for «${meaning}» starts at the marked letter.`,
            `كلمة «${meaning}» بتبلّش من الحرف المعلّم.`,
          )
        : t(`Follow the numbers for «${meaning}».`, `اتبع الأرقام لكلمة «${meaning}».`),
    );
  }

  function undo() {
    if (!solved.length) return;
    const last = solved[solved.length - 1];
    setSolved(solved.slice(0, -1));
    setPath([]);
    say(
      "info",
      t(`${puzzle.words[last]} is back on the grid.`, `رجعت ${puzzle.words[last]} للشبكة.`),
    );
  }

  function restart() {
    setSolved([]);
    setPath([]);
    setHints({});
    setHintCount(0);
    started.current = Date.now();
    say("info", t("A fresh start.", "من أول وجديد."));
  }

  const typed = path.map((p) => puzzle.letters[p]).join("");
  /** A path as polyline points in tile units (the line layer's view box is cols × rows). */
  const lineOf = (p: Path) =>
    p
      .map((tile) => `${(tile % puzzle.cols) + 0.5},${Math.floor(tile / puzzle.cols) + 0.5}`)
      .join(" ");

  return (
    <div
      className="wc-game"
      style={{ ["--wc-cols" as string]: puzzle.cols, ["--wc-rows" as string]: puzzle.rows }}
    >
      <h1 className="sr-only">{`Wordcraft · ${LEVEL_NAMES[puzzle.level][lang]}`}</h1>
      <div className="wc-bar">
        <Link
          to="/wordcraft"
          className="wc-icon-btn"
          aria-label={t("Change difficulty", "غيّر الصعوبة")}
        >
          <ArrowRight size={18} className="ltr:rotate-180" aria-hidden="true" />
        </Link>
        <p className="wc-bar-title">
          <span className="wc-bar-brand">Wordcraft</span>
          <span className="wc-bar-level">{LEVEL_NAMES[puzzle.level][lang]}</span>
        </p>
        <div className="wc-bar-tools">
          <button
            type="button"
            className="wc-icon-btn"
            onClick={hint}
            disabled={done}
            aria-label={t("Hint", "تلميح")}
            title={t("Hint", "تلميح")}
          >
            <Lightbulb size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="wc-icon-btn"
            onClick={undo}
            disabled={!solved.length || done}
            aria-label={t("Undo the last word", "تراجع عن آخر كلمة")}
            title={t("Undo", "تراجع")}
          >
            <Undo2 size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="wc-icon-btn"
            onClick={restart}
            disabled={!solved.length && !path.length}
            aria-label={t("Start again", "ابدأ من جديد")}
            title={t("Start again", "ابدأ من جديد")}
          >
            <RotateCcw size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="wc-icon-btn"
            onClick={onMute}
            aria-pressed={muted}
            aria-label={
              muted ? t("Turn sounds on", "شغّل الأصوات") : t("Mute sounds", "اكتم الأصوات")
            }
          >
            {muted ? (
              <VolumeX size={18} aria-hidden="true" />
            ) : (
              <Volume2 size={18} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            className="wc-icon-btn"
            onClick={() => setHelp((h) => !h)}
            aria-expanded={help}
            aria-label={t("How to play", "طريقة اللعب")}
          >
            <CircleHelp size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {help && (
        <div className="wc-help" role="note">
          <button
            type="button"
            className="wc-help-x"
            onClick={() => setHelp(false)}
            aria-label={t("Close", "سكّر")}
          >
            <X size={16} aria-hidden="true" />
          </button>
          <p className="wc-help-title">{t("How to play", "طريقة اللعب")}</p>
          <ul>
            <li>
              {t(
                "Join letters that touch: up, down, left or right. No diagonals.",
                "وصّل حروف متلاصقة: فوق، تحت، يمين أو يسار. بدون أقطار.",
              )}
            </li>
            <li>
              {t("A word can turn as many times as it needs.", "الكلمة بتقدر تلف قد ما بدها.")}
            </li>
            <li>
              {t(
                "Every letter is used once, and every letter is used.",
                "كل حرف بينستخدم مرة وحدة، وكل الحروف لازم تنستخدم.",
              )}
            </li>
            <li>
              {t(
                "The Arabic under each set of boxes is the word's meaning.",
                "العربي تحت كل خانات هو معنى الكلمة.",
              )}
            </li>
            <li>
              {t(
                "No mouse? Arrows move, Space adds a letter, Enter sends, Backspace takes one off.",
                "بالكيبورد: الأسهم بتتنقّل، Space بيضيف حرف، Enter بيرسل، Backspace بيشيل حرف.",
              )}
            </li>
          </ul>
        </div>
      )}

      <div className="wc-rita" data-tone={bubble.tone}>
        <RitaFace size={44} />
        <p className="wc-bubble" role="status" aria-live="polite" dir="auto">
          {bubble.text}
        </p>
      </div>

      <div className="wc-stage">
        <p className="wc-typed" aria-hidden="true" data-on={typed ? "" : undefined} dir="ltr">
          {typed || " "}
        </p>
        <div
          ref={board}
          className="wc-board"
          role="grid"
          aria-label={t("Letter grid", "شبكة الحروف")}
          dir="ltr"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
        >
          <div ref={tilesBox} className="wc-tiles">
            <svg
              className="wc-lines"
              viewBox={`0 0 ${puzzle.cols} ${puzzle.rows}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {solved.map((i) => (
                <polyline
                  key={i}
                  points={lineOf(puzzle.paths[i])}
                  style={{ stroke: toneOf(i).c }}
                />
              ))}
              {path.length > 1 && <polyline className="is-live" points={lineOf(path)} />}
            </svg>
            {Array.from({ length: puzzle.rows }, (_, r) => (
              <div role="row" key={r} className="wc-row">
                {Array.from({ length: puzzle.cols }, (_, c) => {
                  const i = r * puzzle.cols + c;
                  const word = tileWord.get(i);
                  const onPath = path.indexOf(i);
                  const tone = word !== undefined ? toneOf(word) : null;
                  const hint = hinted.get(i);
                  return (
                    <button
                      key={i}
                      ref={(el) => {
                        tileRefs.current[i] = el;
                      }}
                      type="button"
                      role="gridcell"
                      tabIndex={focus === i ? 0 : -1}
                      className="wc-tile"
                      data-state={word !== undefined ? "found" : onPath >= 0 ? "path" : undefined}
                      data-hint={hint ?? undefined}
                      style={
                        tone
                          ? { ["--t" as string]: tone.c, ["--ts" as string]: tone.soft }
                          : undefined
                      }
                      aria-label={`${puzzle.letters[i]}, ${t("row", "صف")} ${r + 1}, ${t("column", "عمود")} ${c + 1}${
                        word !== undefined
                          ? `, ${t("used", "مستخدم")}`
                          : onPath >= 0
                            ? `, ${t("selected", "محدد")} ${onPath + 1}`
                            : ""
                      }`}
                      aria-selected={onPath >= 0}
                      onFocus={() => setFocus(i)}
                      onClick={(event) => event.preventDefault()}
                    >
                      {puzzle.letters[i]}
                      {hint && word === undefined ? (
                        <span className="wc-hint-n">{hint}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {done ? (
        <Summary round={puzzle} lang={lang} seconds={seconds} hints={hintCount} onNext={onNext} />
      ) : (
        <ol className="wc-slots" aria-label={t("Words to find", "الكلمات المطلوبة")}>
          {puzzle.words.map((word, i) => {
            const found = solvedSet.has(i);
            const tone = found ? toneOf(i) : null;
            const entry = puzzle.info[i];
            return (
              <li
                key={word}
                className="wc-slot"
                data-found={found || undefined}
                style={
                  tone ? { ["--t" as string]: tone.c, ["--ts" as string]: tone.soft } : undefined
                }
                aria-label={
                  found
                    ? `${word}: ${entry?.ar}`
                    : t(
                        `${word.length} letters, meaning ${entry?.ar}`,
                        `${word.length} حروف، معناها ${entry?.ar}`,
                      )
                }
              >
                <span className="wc-slot-cells" dir="ltr" aria-hidden="true">
                  {word.split("").map((letter, k) => (
                    <span key={k} className="wc-slot-cell" data-slot-cell={`${i}-${k}`}>
                      {found ? letter : ""}
                    </span>
                  ))}
                </span>
                <span className="wc-slot-clue" lang="ar" dir="rtl">
                  {found && <Check size={14} aria-hidden="true" />}
                  {entry?.ar}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {note ? <p className="wc-note-line">{note}</p> : null}
      <span className="sr-only">
        {progressLabel(lang, solved.length, puzzle.words.length, total)}
      </span>
    </div>
  );
}

function progressLabel(lang: Lang, found: number, words: number, tiles: number) {
  return lang === "ar"
    ? `لقيت ${found} من ${words} كلمات على شبكة من ${tiles} حرف.`
    : `${found} of ${words} words found on a grid of ${tiles} letters.`;
}

function speak(word: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(word.toLowerCase());
  u.lang = "en-US";
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
}

/** The end of a round: the words you found, each with its meaning and an example. */
function Summary({
  round,
  lang,
  seconds,
  hints,
  onNext,
}: {
  round: Round;
  lang: Lang;
  seconds: number;
  hints: number;
  onNext: () => void;
}) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <section className="wc-summary" aria-labelledby="wc-summary-title">
      <h2 id="wc-summary-title" ref={heading} tabIndex={-1} className="wc-summary-title">
        {t("The words you found", "الكلمات اللي لقيتها")}
      </h2>
      <p className="wc-summary-meta">
        {t(`${clock(seconds)} · ${hints} hints`, `${clock(seconds)} · ${hints} تلميح`)}
      </p>
      <ul className="wc-words">
        {round.info.map((e) => (
          <li key={e.word} className="wc-word">
            <div className="wc-word-head">
              <span className="wc-word-en" dir="ltr" lang="en">
                {e.word.toLowerCase()}
              </span>
              <span className="wc-word-ar" lang="ar" dir="rtl">
                {e.ar}
              </span>
              {canSpeak && (
                <button
                  type="button"
                  className="wc-icon-btn is-small"
                  onClick={() => speak(e.word)}
                  aria-label={t(`Say ${e.word.toLowerCase()}`, `اسمع ${e.word.toLowerCase()}`)}
                >
                  <Volume2 size={16} aria-hidden="true" />
                </button>
              )}
            </div>
            <p className="wc-word-ex" dir="ltr" lang="en">
              {e.example}
            </p>
            <p className="wc-word-ex-ar" dir="rtl" lang="ar">
              {e.exampleAr}
            </p>
          </li>
        ))}
      </ul>
      <div className="wc-summary-actions">
        <button type="button" className="rita-btn rita-btn-primary" onClick={onNext}>
          {t("New round", "جولة جديدة")}
          <ArrowRight size={17} className="rtl:rotate-180" aria-hidden="true" />
        </button>
        <Link to="/wordcraft" className="rita-btn rita-btn-secondary">
          {t("Change difficulty", "غيّر الصعوبة")}
        </Link>
      </div>
    </section>
  );
}
