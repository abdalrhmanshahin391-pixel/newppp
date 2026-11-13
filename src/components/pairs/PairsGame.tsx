import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, RotateCcw, Volume2, VolumeX } from "lucide-react";
import {
  accuracy,
  boardEmpty,
  deal,
  isMatch,
  pointsFor,
  refill,
  shuffle,
  START_MS,
  timeAfter,
  timeTone,
  type Board,
  type PairCard,
} from "@/lib/pairs/game";
import { langKey } from "@/lib/language-scope";
import { pairsSounds, readMuted, saveMuted } from "./pairs-sound";

type Lang = "en" | "ar";
type Side = "front" | "back";
type Flash = { kind: "right" | "wrong"; front: number; back: number } | null;

const BEST_KEY = () => langKey("rita_pairs_best");
const reduced = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const buzz = (ms: number | number[]) => {
  if (typeof navigator !== "undefined") navigator.vibrate?.(ms);
};

type Result = {
  score: number;
  right: number;
  wrong: number;
  bestStreak: number;
  cleared: boolean;
  missed: PairCard[];
  best: number;
  newBest: boolean;
};

/** One game: five rows of cards against the clock, then the result. */
export function PairsGame({
  lang,
  pool,
  title,
  onExit,
  onAgain,
}: {
  lang: Lang;
  pool: PairCard[];
  title: string;
  onExit: () => void;
  onAgain: () => void;
}) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const [board, setBoardState] = useState<Board>(() => deal(shuffle(pool)));
  // The board and score as the timers see them right now (state catches up on the next render).
  const boardRef = useRef(board);
  const setBoard = (next: Board) => {
    boardRef.current = next;
    setBoardState(next);
  };
  const scoreRef = useRef(0);
  const [picked, setPicked] = useState<{ side: Side; row: number } | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  /** Rows on their way out after a right match ("f2", "b4"): they take no taps. */
  const [leaving, setLeaving] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [right, setRight] = useState(0);
  const [wrong, setWrong] = useState(0);
  const streak = useRef(0);
  const bestStreak = useRef(0);
  const missed = useRef(new Map<string, PairCard>());
  const [muted, setMuted] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [announce, setAnnounce] = useState("");
  const total = pool.length;

  // ---- the clock: an end time, moved by right and wrong matches, paused while hidden ----------
  const endAt = useRef(Date.now() + START_MS);
  const paused = useRef<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(START_MS / 1000);
  const barRef = useRef<HTMLSpanElement>(null);
  const coinRef = useRef<HTMLSpanElement>(null);
  const over = useRef(false);

  useEffect(() => setMuted(readMuted()), []);
  const play = useCallback((fn: () => void) => {
    if (!readMuted()) fn();
  }, []);

  const msLeft = () => paused.current ?? Math.max(0, endAt.current - Date.now());

  const finish = useCallback(
    (cleared: boolean) => {
      if (over.current) return;
      over.current = true;
      play(cleared ? pairsSounds.cleared : pairsSounds.timeUp);
      buzz(cleared ? [20, 40, 20] : 60);
      const finalScore = scoreRef.current;
      let best = 0;
      try {
        best = Number(window.localStorage.getItem(BEST_KEY())) || 0;
      } catch {
        /* no saved best */
      }
      const newBest = finalScore > best;
      if (newBest)
        try {
          window.localStorage.setItem(BEST_KEY(), String(finalScore));
        } catch {
          /* kept for this visit only */
        }
      setResult({
        score: finalScore,
        right: 0,
        wrong: 0,
        bestStreak: bestStreak.current,
        cleared,
        missed: [...missed.current.values()],
        best: Math.max(best, finalScore),
        newBest,
      });
    },
    [play],
  );

  useEffect(() => {
    let frame = 0;
    let lastSecond = -1;
    const loop = () => {
      if (over.current) return;
      const left = msLeft();
      const share = Math.min(1, left / START_MS);
      if (barRef.current) {
        barRef.current.style.transform = `scaleY(${share})`;
        barRef.current.dataset.tone = timeTone(left);
      }
      const second = Math.ceil(left / 1000);
      if (second !== lastSecond) {
        lastSecond = second;
        setSecondsLeft(second);
        if (second <= 5 && second > 0 && paused.current === null) play(pairsSounds.tick);
        if (second === 10 || second === 5)
          setAnnounce(t(`${second} seconds left`, `باقي ${second} ثواني`));
      }
      if (left <= 0) return finish(false);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    const onVisibility = () => {
      if (document.hidden) paused.current = Math.max(0, endAt.current - Date.now());
      else if (paused.current !== null) {
        endAt.current = Date.now() + paused.current;
        paused.current = null;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finish, play]);

  const moveClock = (isRight: boolean) => {
    const next = timeAfter(msLeft(), isRight);
    endAt.current = Date.now() + next;
  };

  /** A coin flies from the matched card to the score. */
  const flyCoin = (from: HTMLElement | null) => {
    const to = coinRef.current;
    if (!from || !to || reduced()) return;
    const a = from.getBoundingClientRect();
    const b = to.getBoundingClientRect();
    const coin = document.createElement("span");
    coin.className = "pr-coin pr-coin-fly";
    coin.style.left = `${a.left + a.width / 2 - 14}px`;
    coin.style.top = `${a.top + a.height / 2 - 14}px`;
    document.body.appendChild(coin);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    coin
      .animate(
        [
          { transform: "translate(0, 0) scale(1)", opacity: 1 },
          {
            transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 40}px) scale(1.15)`,
            opacity: 1,
            offset: 0.5,
          },
          { transform: `translate(${dx}px, ${dy}px) scale(0.7)`, opacity: 0.9 },
        ],
        { duration: 520, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
      )
      .finished.finally(() => {
        coin.remove();
        to.animate([{ transform: "scale(1.25)" }, { transform: "scale(1)" }], { duration: 180 });
      });
  };

  const cellRefs = useRef(new Map<string, HTMLButtonElement | null>());

  function choose(side: Side, row: number) {
    if (over.current) return;
    const key = `${side[0]}${row}`;
    if (leaving.includes(key)) return;
    const card = side === "front" ? boardRef.current.left[row] : boardRef.current.right[row];
    if (!card) return;
    if (!picked || picked.side === side) {
      setPicked(picked && picked.side === side && picked.row === row ? null : { side, row });
      play(pairsSounds.pick);
      return;
    }
    const frontRow = side === "front" ? row : picked.row;
    const backRow = side === "back" ? row : picked.row;
    const front = boardRef.current.left[frontRow]!;
    const back = boardRef.current.right[backRow]!;
    setPicked(null);
    if (isMatch(front, back)) {
      streak.current += 1;
      bestStreak.current = Math.max(bestStreak.current, streak.current);
      const inRow = streak.current;
      scoreRef.current += pointsFor(inRow);
      setScore(scoreRef.current);
      setRight((n) => n + 1);
      moveClock(true);
      play(() => pairsSounds.right(inRow));
      buzz(12);
      setFlash({ kind: "right", front: frontRow, back: backRow });
      setAnnounce(t(`Right: ${front.front} = ${back.back}`, `صح: ${front.front} = ${back.back}`));
      flyCoin(cellRefs.current.get(`b${backRow}`) ?? null);
      const out = [`f${frontRow}`, `b${backRow}`];
      setLeaving((l) => [...l, ...out]);
      window.setTimeout(
        () => {
          setFlash((f) => (f && f.front === frontRow && f.back === backRow ? null : f));
          setLeaving((l) => l.filter((k) => !out.includes(k)));
          const next = refill(boardRef.current, frontRow, backRow);
          setBoard(next);
          if (boardEmpty(next)) window.setTimeout(() => finish(true), 120);
        },
        reduced() ? 120 : 320,
      );
    } else {
      streak.current = 0;
      setWrong((n) => n + 1);
      moveClock(false);
      play(pairsSounds.wrong);
      buzz([30, 30, 30]);
      missed.current.set(front.id, front);
      setFlash({ kind: "wrong", front: frontRow, back: backRow });
      setAnnounce(t(`Not a pair: ${front.front}`, `مش زوج: ${front.front}`));
      window.setTimeout(
        () =>
          setFlash((f) =>
            f && f.kind === "wrong" && f.front === frontRow && f.back === backRow ? null : f,
          ),
        450,
      );
    }
  }

  const progress = Math.min(1, right / Math.max(1, total));

  if (result)
    return (
      <Results
        lang={lang}
        result={{ ...result, right, wrong }}
        title={title}
        onAgain={onAgain}
        onExit={onExit}
      />
    );

  return (
    <section className="pr-game" aria-label={t("Pairs game", "لعبة اقرن")}>
      <div className="pr-top">
        <button
          type="button"
          className="pr-back"
          onClick={onExit}
          aria-label={t("Leave the game", "اطلع من اللعبة")}
        >
          <ArrowRight size={22} className="ltr:rotate-180" aria-hidden="true" />
        </button>
        <div
          className="pr-track"
          role="progressbar"
          aria-label={t("Pairs found", "الأزواج اللي لقيتها")}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={right}
        >
          <span className="pr-track-fill" style={{ transform: `scaleX(${progress})` }} />
        </div>
        <span className="pr-score">
          <span ref={coinRef} className="pr-coin" aria-hidden="true" />
          <span className="pr-score-n" aria-label={t(`${score} points`, `${score} نقطة`)}>
            {score}
          </span>
        </span>
        <button
          type="button"
          className="pr-back is-small"
          onClick={() => {
            const next = !muted;
            setMuted(next);
            saveMuted(next);
          }}
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
      </div>

      <h2 className="pr-ask">{t("Match each word with its meaning", "اقرن الكلمة مع معناها")}</h2>

      {/* The clock: a bar down the left edge of the screen that empties from the top. */}
      <div className="pr-clock" aria-hidden="true">
        <span className="pr-clock-track">
          <span ref={barRef} className="pr-clock-fill" data-tone="calm" />
        </span>
        <span className="pr-clock-n" data-tone={timeTone(secondsLeft * 1000)}>
          {secondsLeft}
        </span>
      </div>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      <div className="pr-grid" data-size={boardSize(board)}>
        {board.left.map((_, row) => (
          <Fragment key={row}>
            {(["front", "back"] as Side[]).map((side) => {
              const card = side === "front" ? board.left[row] : board.right[row];
              const key = `${side[0]}${row}`;
              const state =
                flash && (side === "front" ? flash.front : flash.back) === row
                  ? flash.kind
                  : picked && picked.side === side && picked.row === row
                    ? "picked"
                    : undefined;
              if (!card) return <span key={key} className="pr-cell is-empty" aria-hidden="true" />;
              const text = side === "front" ? card.front : card.back;
              return (
                <button
                  key={`${key}-${card.id}`}
                  ref={(el) => {
                    cellRefs.current.set(key, el);
                  }}
                  type="button"
                  className="pr-cell"
                  data-state={state}
                  data-leaving={leaving.includes(key) || undefined}
                  aria-pressed={state === "picked"}
                  onClick={() => choose(side, row)}
                >
                  <span dir="auto">{text}</span>
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>
    </section>
  );
}

/** The board's text size, from its longest card ("m" and "s" are smaller). */
function boardSize(board: Board): "m" | "s" | undefined {
  const longest = Math.max(
    0,
    ...[...board.left, ...board.right].map((c) =>
      c ? Math.max(c.front.length, c.back.length) : 0,
    ),
  );
  return longest > 60 ? "s" : longest > 24 ? "m" : undefined;
}

/** The end: points, the best score on this device, the numbers, and the cards to look at again. */
function Results({
  lang,
  result,
  title,
  onAgain,
  onExit,
}: {
  lang: Lang;
  result: Result;
  title: string;
  onAgain: () => void;
  onExit: () => void;
}) {
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const stats = useMemo(
    () => [
      { label: t("Right", "صح"), value: result.right },
      { label: t("Wrong", "غلط"), value: result.wrong },
      { label: t("Best streak", "أطول سلسلة"), value: result.bestStreak },
      { label: t("Accuracy", "الدقة"), value: `${accuracy(result.right, result.wrong)}%` },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result, lang],
  );
  return (
    <section className="pr-result" aria-labelledby="pr-result-title">
      <div className="pr-result-card">
        <p className="pr-result-eyebrow">
          {result.cleared
            ? t("Board cleared!", "خلّصت كل البطاقات!")
            : t("Time's up!", "خلص الوقت!")}
        </p>
        <h1 id="pr-result-title" ref={heading} tabIndex={-1} className="pr-result-score">
          <span className="pr-coin is-big" aria-hidden="true" />
          {result.score}
          <span className="sr-only">{t(" points", " نقطة")}</span>
        </h1>
        <p className="pr-result-best">
          {result.newBest
            ? t("A new best on this device!", "أعلى نتيجة إلك على هالجهاز!")
            : t(`Best on this device: ${result.best}`, `أعلى نتيجة على هالجهاز: ${result.best}`)}
        </p>
        <p className="pr-result-title">{title}</p>
        <dl className="pr-stats">
          {stats.map((s) => (
            <div key={s.label}>
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
        <div className="pr-result-actions">
          <button type="button" className="pr-start" onClick={onAgain}>
            <RotateCcw size={18} aria-hidden="true" />
            {t("Play again", "العب كمان مرة")}
          </button>
          <button type="button" className="pr-ghost" onClick={onExit}>
            {t("Change subjects", "غيّر المواد")}
          </button>
        </div>
      </div>

      <div className="pr-missed">
        <h2 className="pr-missed-title">
          {result.missed.length
            ? t("Cards to look at again", "بطاقات بدها مراجعة")
            : t("No mistakes this time", "ولا غلطة هالمرة")}
          {result.missed.length ? null : <Check size={18} aria-hidden="true" />}
        </h2>
        {result.missed.length ? (
          <ul>
            {result.missed.map((c) => (
              <li key={c.id}>
                <span dir="auto">{c.front}</span>
                <span className="pr-missed-sep" aria-hidden="true">
                  =
                </span>
                <span dir="auto">{c.back}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
