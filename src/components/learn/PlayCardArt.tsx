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
