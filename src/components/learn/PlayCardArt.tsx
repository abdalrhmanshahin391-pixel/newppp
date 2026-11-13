import type { ReactNode } from "react";
import { UZYRA_MARK_PATHS, UZYRA_MARK_VIEWBOX } from "@/lib/brand";

/**
 * The drawings on the two Uzyra cards at the top of /learn. Flat shapes with a darker "lip" under
 * each one, like the white button below them; the Uzyra mark is the hero, never a character.
 * Decorative only: the card's link carries the name.
 */

const MARK_RATIO = 636 / 875;

function Mark({ x, y, h, fill }: { x: number; y: number; h: number; fill: string }) {
  return (
    <svg x={x} y={y} height={h} width={h * MARK_RATIO} viewBox={UZYRA_MARK_VIEWBOX}>
      <g fill={fill}>
        {UZYRA_MARK_PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}

function Shadow() {
  return <ellipse cx={180} cy={232} rx={120} ry={8} fill="#000" opacity={0.12} />;
}

function TypingBubble({
  x,
  y,
  fill,
  lip,
  dot,
}: {
  x: number;
  y: number;
  fill: string;
  lip: string;
  dot: string;
}) {
  return (
    <g>
      <rect x={x} y={y + 6} width={78} height={46} rx={23} fill={lip} />
      <rect x={x} y={y} width={78} height={46} rx={23} fill={fill} />
      {[23, 39, 55].map((dx) => (
        <circle key={dx} cx={x + dx} cy={y + 23} r={5.5} fill={dot} />
      ))}
    </g>
  );
}

/** Free talk: the Uzyra mark in a big speech bubble, with two "typing" bubbles beside it. */
export function TalkCardArt() {
  return (
    <svg
      viewBox="0 0 360 240"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
      focusable="false"
    >
      <Shadow />
      <rect x={104} y={14} width={152} height={140} rx={40} fill="#d4e3f7" />
      <path d="M138 150L118 184L172 150Z" fill="#d4e3f7" />
      <rect x={104} y={6} width={152} height={140} rx={40} fill="#fff" />
      <path d="M138 142L118 176L172 142Z" fill="#fff" />
      <Mark x={143} y={20} h={112} fill="#2b73c7" />
      <TypingBubble x={22} y={40} fill="#ffd23f" lip="#e3b800" dot="#8a5a00" />
      <TypingBubble x={262} y={82} fill="#62d27e" lip="#3fae5c" dot="#fff" />
    </svg>
  );
}

/** Lessons: a yellow book with the Uzyra mark on its cover, a pink ribbon and a green book behind. */
export function LessonsCardArt() {
  return (
    <svg
      viewBox="36 0 288 240"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
      focusable="false"
    >
      <Shadow />
      <g transform="rotate(-8 120 130)">
        <rect x={66} y={46} width={96} height={140} rx={12} fill="#3fae5c" />
        <rect x={66} y={40} width={96} height={140} rx={12} fill="#62d27e" />
        <rect x={66} y={40} width={16} height={140} rx={6} fill="#3fae5c" />
      </g>
      <rect x={132} y={20} width={134} height={200} rx={14} fill="#f4f6fb" />
      <rect x={128} y={16} width={134} height={200} rx={14} fill="#e3b800" />
      <rect x={128} y={10} width={134} height={200} rx={14} fill="#ffd23f" />
      <rect x={128} y={10} width={20} height={200} rx={8} fill="#e3b800" />
      <Mark x={162} y={30} h={104} fill="#fff" />
      <path d="M232 10V72L244 62L256 72V10Z" fill="#ff6b8a" />
    </svg>
  );
}

/** A flat card with its lip, optionally tilted around its centre. */
function Card({
  x,
  y,
  w,
  h,
  fill,
  lip,
  tilt = 0,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  lip: string;
  tilt?: number;
  children?: ReactNode;
}) {
  return (
    <g transform={tilt ? `rotate(${tilt} ${x + w / 2} ${y + h / 2})` : undefined}>
      <rect x={x} y={y + 7} width={w} height={h} rx={16} fill={lip} />
      <rect x={x} y={y} width={w} height={h} rx={16} fill={fill} />
      {children}
    </g>
  );
}

/** Flashcards: a fanned stack, the front card showing the Uzyra mark. */
export function FlashcardsCardArt() {
  return (
    <svg
      viewBox="0 0 360 240"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
      focusable="false"
    >
      <Shadow />
      <Card x={110} y={30} w={140} h={150} fill="#62d27e" lip="#3fae5c" tilt={-14} />
      <Card x={110} y={24} w={140} h={150} fill="#ffd23f" lip="#e3b800" tilt={9} />
      <Card x={110} y={16} w={140} h={156} fill="#fff" lip="#d4e3f7">
        <Mark x={147} y={32} h={92} fill="#2b73c7" />
        <rect x={140} y={140} width={80} height={10} rx={5} fill="#d4e3f7" />
      </Card>
    </svg>
  );
}

/** Memory Lab: a memory game board, two tiles turned over to show the mark, two face down. */
export function MemoryCardArt() {
  const tile = (x: number, y: number, open: boolean, fill = "#fff", lip = "#d4e3f7") => (
    <Card
      key={`${x}-${y}`}
      x={x}
      y={y}
      w={88}
      h={70}
      fill={open ? "#fff" : fill}
      lip={open ? "#d4e3f7" : lip}
    >
      {open ? <Mark x={x + 26} y={y + 9} h={52} fill="#2b73c7" /> : null}
      {open ? null : <circle cx={x + 44} cy={y + 35} r={11} fill="#fff" opacity={0.5} />}
    </Card>
  );
  return (
    <svg
      viewBox="62 0 236 240"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
      focusable="false"
    >
      <Shadow />
      <rect x={80} y={6} width={200} height={190} rx={26} fill="#1f5ea8" />
      {tile(90, 16, true)}
      {tile(182, 16, false, "#ffd23f", "#e3b800")}
      {tile(90, 100, false, "#62d27e", "#3fae5c")}
      {tile(182, 100, true)}
    </svg>
  );
}

/** Pairs: two matching cards leaning together, a green tick above them. */
export function PairsCardArt() {
  return (
    <svg
      viewBox="44 0 272 240"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
      focusable="false"
    >
      <Shadow />
      <Card x={68} y={44} w={116} h={146} fill="#fff" lip="#d4e3f7" tilt={-10}>
        <Mark x={99} y={64} h={78} fill="#2b73c7" />
      </Card>
      <Card x={176} y={44} w={116} h={146} fill="#ffd23f" lip="#e3b800" tilt={10}>
        <Mark x={207} y={64} h={78} fill="#fff" />
      </Card>
      <circle cx={180} cy={36} r={28} fill="#3fae5c" />
      <circle cx={180} cy={30} r={28} fill="#62d27e" />
      <path
        d="M167 30l9 9 17-18"
        fill="none"
        stroke="#fff"
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const LETTER_FONT = "Inter Tight, Figtree, Helvetica, Arial, sans-serif";

/** Wordcraft: a letter board; a found word is green, the middle tile carries the mark. */
export function WordcraftCardArt() {
  const letters = ["W", "O", "R", "K", "", "D", "S", "A", "Y"];
  const found = new Set([0, 1, 2, 5]);
  return (
    <svg
      viewBox="58 0 244 240"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
      focusable="false"
    >
      <Shadow />
      <g transform="rotate(-6 180 100)">
        <rect x={80} y={4} width={200} height={176} rx={24} fill="#f7d9a8" />
        {letters.map((letter, i) => {
          const x = 90 + (i % 3) * 62;
          const y = 14 + Math.floor(i / 3) * 54;
          const green = found.has(i);
          return (
            <Card
              key={i}
              x={x}
              y={y}
              w={56}
              h={44}
              fill={green ? "#62d27e" : "#fff"}
              lip={green ? "#3fae5c" : "#d4e3f7"}
            >
              {i === 4 ? (
                <Mark x={x + 14} y={y + 5} h={34} fill="#2b73c7" />
              ) : letter ? (
                <text
                  x={x + 28}
                  y={y + 31}
                  textAnchor="middle"
                  fontFamily={LETTER_FONT}
                  fontSize={26}
                  fontWeight={800}
                  fill={green ? "#fff" : "#1d1640"}
                >
                  {letter}
                </text>
              ) : null}
            </Card>
          );
        })}
      </g>
    </svg>
  );
}

/** PDF summary: a page with the mark at the top, highlighted lines and a red PDF label. */
export function SummaryCardArt() {
  return (
    <svg
      viewBox="58 0 244 240"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
      focusable="false"
    >
      <Shadow />
      <path d="M110 14H222L256 48V182H110Z" fill="#d4e3f7" />
      <path d="M106 8H218L252 42V176H106Z" fill="#fff" />
      <path d="M218 8V42H252Z" fill="#d4e3f7" />
      <Mark x={128} y={24} h={56} fill="#2b73c7" />
      {[
        [92, 104, false],
        [110, 84, true],
        [128, 110, false],
        [146, 70, true],
      ].map(([y, w, hi]) => (
        <g key={y as number}>
          {hi ? (
            <rect
              x={122}
              y={(y as number) - 5}
              width={(w as number) + 8}
              height={17}
              rx={4}
              fill="#ffd23f"
            />
          ) : null}
          <rect x={126} y={y as number} width={w as number} height={8} rx={4} fill="#c9d3e4" />
        </g>
      ))}
      <rect x={84} y={60} width={60} height={30} rx={10} fill="#c9343a" />
      <rect x={84} y={56} width={60} height={30} rx={10} fill="#ff5a5f" />
      <text
        x={114}
        y={77}
        textAnchor="middle"
        fontFamily={LETTER_FONT}
        fontSize={15}
        fontWeight={800}
        fill="#fff"
      >
        PDF
      </text>
    </svg>
  );
}

/** All in one: an open box with the mark on it, and a card and a page coming out of it. */
export function AllInOneCardArt() {
  return (
    <svg
      viewBox="40 0 280 240"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
      focusable="false"
    >
      <Shadow />
      <Card x={92} y={10} w={70} h={86} fill="#62d27e" lip="#3fae5c" tilt={-16}>
        <rect x={105} y={28} width={44} height={8} rx={4} fill="#fff" opacity={0.75} />
        <rect x={105} y={44} width={32} height={8} rx={4} fill="#fff" opacity={0.75} />
      </Card>
      <Card x={198} y={10} w={70} h={86} fill="#ffd23f" lip="#e3b800" tilt={16}>
        <circle cx={233} cy={42} r={16} fill="#fff" opacity={0.8} />
        <text
          x={233}
          y={49}
          textAnchor="middle"
          fontFamily={LETTER_FONT}
          fontSize={20}
          fontWeight={800}
          fill="#a87a00"
        >
          ?
        </text>
      </Card>
      <Card x={145} y={2} w={70} h={84} fill="#fff" lip="#d4e3f7">
        <rect x={158} y={18} width={44} height={8} rx={4} fill="#d4e3f7" />
        <rect x={158} y={34} width={36} height={8} rx={4} fill="#d4e3f7" />
        <rect x={158} y={50} width={44} height={8} rx={4} fill="#d4e3f7" />
      </Card>
      <path d="M90 72H270L256 92H104Z" fill="#1f5ea8" />
      <rect x={98} y={88} width={164} height={92} rx={18} fill="#e3b800" />
      <rect x={98} y={82} width={164} height={92} rx={18} fill="#ffd23f" />
      <Mark x={159} y={92} h={70} fill="#fff" />
    </svg>
  );
}

/** Question bank: the mark in a question bubble, and three answers, one marked right. */
export function QuestionBankCardArt() {
  const answer = (y: number, right: boolean) => (
    <g key={y}>
      <rect
        x={196}
        y={y + 5}
        width={118}
        height={38}
        rx={19}
        fill={right ? "#3fae5c" : "#d4e3f7"}
      />
      <rect x={196} y={y} width={118} height={38} rx={19} fill={right ? "#62d27e" : "#fff"} />
      <circle cx={216} cy={y + 19} r={10} fill={right ? "#fff" : "#e3ebf7"} />
      {right ? (
        <path
          d={`M211 ${y + 19}l4 4 8-8`}
          fill="none"
          stroke="#3fae5c"
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      <rect x={234} y={y + 15} width={62} height={8} rx={4} fill={right ? "#fff" : "#d4e3f7"} />
    </g>
  );
  return (
    <svg
      viewBox="30 0 300 240"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
      focusable="false"
    >
      <Shadow />
      <rect x={46} y={18} width={136} height={128} rx={34} fill="#d4e3f7" />
      <path d="M82 140L68 176L120 140Z" fill="#d4e3f7" />
      <rect x={46} y={10} width={136} height={128} rx={34} fill="#fff" />
      <path d="M82 132L68 168L120 132Z" fill="#fff" />
      <Mark x={84} y={28} h={86} fill="#2b73c7" />
      <circle cx={170} cy={22} r={18} fill="#e3b800" />
      <circle cx={170} cy={18} r={18} fill="#ffd23f" />
      <text
        x={170}
        y={26}
        textAnchor="middle"
        fontFamily={LETTER_FONT}
        fontSize={22}
        fontWeight={800}
        fill="#8a5a00"
      >
        ?
      </text>
      {answer(14, false)}
      {answer(62, true)}
      {answer(110, false)}
    </svg>
  );
}

/** Lecture Lab: a slide on an easel with the mark, and a yellow note of short questions. */
export function LectureCardArt() {
  return (
    <svg
      viewBox="40 0 280 240"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
      focusable="false"
    >
      <Shadow />
      <g stroke="#d4e3f7" strokeWidth={8} strokeLinecap="round">
        <line x1={170} y1={140} x2={136} y2={200} />
        <line x1={170} y1={140} x2={204} y2={200} />
      </g>
      <rect x={80} y={14} width={180} height={126} rx={16} fill="#d4e3f7" />
      <rect x={80} y={6} width={180} height={126} rx={16} fill="#fff" />
      <Mark x={102} y={26} h={86} fill="#2b73c7" />
      <rect x={178} y={34} width={64} height={10} rx={5} fill="#d4e3f7" />
      <rect x={178} y={56} width={48} height={10} rx={5} fill="#62d27e" />
      <rect x={178} y={78} width={58} height={10} rx={5} fill="#d4e3f7" />
      <rect x={178} y={100} width={40} height={10} rx={5} fill="#ffd23f" />
      <Card x={232} y={92} w={68} h={74} fill="#ffd23f" lip="#e3b800" tilt={10}>
        <text
          x={266}
          y={124}
          textAnchor="middle"
          fontFamily={LETTER_FONT}
          fontSize={24}
          fontWeight={800}
          fill="#8a5a00"
        >
          ?
        </text>
        <rect x={246} y={138} width={40} height={7} rx={3.5} fill="#fff" opacity={0.85} />
      </Card>
    </svg>
  );
}
