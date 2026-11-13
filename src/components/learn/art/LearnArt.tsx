/**
 * The illustrations on the /learn game cards. Hand-drawn inline SVG in one style: flat shapes with
 * a darker "depth" copy under each one, soft ground shadows, and the same small palette on every
 * card (green, yellow, sky, pink, white). No characters and no text that needs translating, so the
 * art never flips in Arabic. All are decorative: the card's link carries the name.
 */
import type { ReactNode } from "react";

const W = "#ffffff";
const W2 = "#e4e1f2";
const G = "#41d27a";
const G2 = "#1f9e56";
const Y = "#ffd43b";
const Y2 = "#e9a800";
const S = "#4cc6ff";
const S2 = "#1d8fd6";
const P = "#ff7eb0";
const P2 = "#e2508a";
const R = "#ff5a5f";
const R2 = "#c9343a";
const LINE = "#e1e5f0";
const INK = "#1d1640";

function Svg({ children, box = "0 0 320 220" }: { children: ReactNode; box?: string }) {
  return (
    <svg
      viewBox={box}
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
      focusable="false"
      className="gc-svg"
    >
      {children}
    </svg>
  );
}

function Ground({ cx = 160, rx = 96, cy = 210 }: { cx?: number; rx?: number; cy?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={9} fill="#000" opacity={0.16} />;
}

/** A five-point star with its darker depth just below it. */
function Star({ x, y, r, tilt = 0 }: { x: number; y: number; r: number; tilt?: number }) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 === 0 ? r : r * 0.48;
    const angle = ((i * 36 - 90 + tilt) * Math.PI) / 180;
    return `${(x + radius * Math.cos(angle)).toFixed(1)},${(y + radius * Math.sin(angle)).toFixed(1)}`;
  }).join(" ");
  return (
    <g>
      <polygon points={points} fill={Y2} transform="translate(0 4)" strokeLinejoin="round" />
      <polygon points={points} fill={Y} strokeLinejoin="round" />
    </g>
  );
}

function Sparkle({ x, y, s = 1, fill = W }: { x: number; y: number; s?: number; fill?: string }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 -10C1 -3 3 -1 10 0C3 1 1 3 0 10C-1 3 -3 1 -10 0C-3 -1 -1 -3 0 -10Z"
      fill={fill}
    />
  );
}

/** A rounded block with its depth: the shape every card stands on. */
function Block({
  x,
  y,
  w,
  h,
  r = 14,
  fill,
  depth,
  d = 6,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
  fill: string;
  depth: string;
  d?: number;
}) {
  return (
    <g>
      <rect x={x} y={y + d} width={w} height={h} rx={r} fill={depth} />
      <rect x={x} y={y} width={w} height={h} rx={r} fill={fill} />
    </g>
  );
}

function Check({ x, y, s = 1, stroke = W }: { x: number; y: number; s?: number; stroke?: string }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M-9 0l6 6L10 -7"
      fill="none"
      stroke={stroke}
      strokeWidth={5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/** Talk to Rita: a studio microphone sending out sound waves. */
export function TalkArt() {
  const wave = { fill: "none", strokeWidth: 9, strokeLinecap: "round" as const };
  return (
    <Svg>
      <Ground rx={78} />
      <path d="M86 74a64 64 0 0 0 0 76" stroke={Y} {...wave} />
      <path d="M62 56a92 92 0 0 0 0 112" stroke={S} {...wave} opacity={0.9} />
      <path d="M234 74a64 64 0 0 1 0 76" stroke={Y} {...wave} />
      <path d="M258 56a92 92 0 0 1 0 112" stroke={S} {...wave} opacity={0.9} />
      <rect x={120} y={192} width={80} height={14} rx={7} fill={W2} />
      <rect x={120} y={188} width={80} height={12} rx={6} fill={W} />
      <rect x={153} y={150} width={14} height={40} rx={4} fill={W2} />
      <path
        d="M110 102v10a50 50 0 0 0 100 0v-10"
        fill="none"
        stroke={W}
        strokeWidth={10}
        strokeLinecap="round"
      />
      <rect x={124} y={28} width={72} height={116} rx={36} fill={W} />
      <path d="M160 28a36 36 0 0 1 36 36v44a36 36 0 0 1-36 36Z" fill={W2} />
      {[54, 68, 82].map((y) => (
        <line
          key={y}
          x1={136}
          x2={184}
          y1={y}
          y2={y}
          stroke="#cfc8ee"
          strokeWidth={4}
          strokeLinecap="round"
        />
      ))}
      <rect x={124} y={100} width={72} height={14} fill={P} />
      <rect x={160} y={100} width={36} height={14} fill={P2} />
      <Sparkle x={40} y={40} s={0.9} />
      <Sparkle x={282} y={34} s={1.1} />
    </Svg>
  );
}

/** Lessons: an open book with stars rising out of it. */
export function LessonsArt() {
  return (
    <Svg>
      <Ground rx={112} />
      <path
        d="M40 124C90 112 130 116 160 132C190 116 230 112 280 124V202C230 192 190 194 160 208C130 194 90 192 40 202Z"
        fill="#0a5c3a"
      />
      <path d="M50 116C92 106 130 110 160 126V198C130 184 92 182 50 190Z" fill={W} />
      <path d="M270 116C228 106 190 110 160 126V198C190 184 228 182 270 190Z" fill="#eef3fb" />
      {[0, 16, 32].map((dy) => (
        <g key={dy} stroke={LINE} strokeWidth={4} strokeLinecap="round" fill="none">
          <path d={`M68 ${134 + dy}C96 ${128 + dy} 122 ${130 + dy} 144 ${139 + dy}`} />
          <path d={`M252 ${134 + dy}C224 ${128 + dy} 198 ${130 + dy} 176 ${139 + dy}`} />
        </g>
      ))}
      <line x1={160} y1={126} x2={160} y2={198} stroke="#d5dbe8" strokeWidth={3} />
      <Star x={160} y={58} r={30} />
      <Star x={98} y={80} r={16} tilt={-12} />
      <Star x={224} y={74} r={19} tilt={10} />
      <Sparkle x={128} y={22} s={0.7} />
      <Sparkle x={262} y={36} s={0.9} />
      <Sparkle x={56} y={50} s={0.8} />
    </Svg>
  );
}

/** Flashcards: a fanned stack, the front card turned over and marked right. */
export function FlashcardsArt() {
  return (
    <Svg>
      <Ground rx={100} />
      <g transform="rotate(-14 160 128)">
        <Block x={86} y={66} w={148} h={102} r={16} fill={P} depth={P2} />
      </g>
      <g transform="rotate(10 160 128)">
        <Block x={86} y={66} w={148} h={102} r={16} fill={Y} depth={Y2} />
      </g>
      <Block x={84} y={84} w={152} h={106} r={16} fill={W} depth={W2} d={7} />
      <circle cx={160} cy={128} r={25} fill={G2} />
      <circle cx={160} cy={124} r={25} fill={G} />
      <Check x={160} y={124} s={1.3} />
      <rect x={118} y={160} width={84} height={9} rx={4.5} fill={LINE} />
      <Sparkle x={62} y={56} />
      <Sparkle x={262} y={46} s={1.2} />
      <Sparkle x={270} y={150} s={0.6} />
    </Svg>
  );
}

const KNOB_TOP_RIGHT = "M0 0H30a15 15 0 1 1 30 0H90V30a15 15 0 1 1 0 30V90H0Z";
const SOCKET_LEFT = "M0 0H30a15 15 0 1 1 30 0H90V90H0V60a15 15 0 1 0 0-30Z";

function Piece({
  d,
  x,
  y,
  fill,
  depth,
  extra = "",
}: {
  d: string;
  x: number;
  y: number;
  fill: string;
  depth: string;
  extra?: string;
}) {
  return (
    <g transform={`translate(${x} ${y}) ${extra}`}>
      <path d={d} fill={depth} transform="translate(0 7)" strokeLinejoin="round" />
      <path d={d} fill={fill} strokeLinejoin="round" />
      <rect x={10} y={12} width={24} height={8} rx={4} fill={W} opacity={0.5} />
    </g>
  );
}

/** Memory Lab: two puzzle pieces that fit, a third on its way. */
export function MemoryArt() {
  return (
    <Svg>
      <Ground rx={104} />
      <Piece d={KNOB_TOP_RIGHT} x={70} y={98} fill={G} depth={G2} />
      <Piece d={SOCKET_LEFT} x={160} y={98} fill={Y} depth={Y2} />
      <Piece d={KNOB_TOP_RIGHT} x={204} y={18} fill={S} depth={S2} extra="rotate(16) scale(0.6)" />
      <Sparkle x={58} y={62} />
      <Sparkle x={188} y={40} s={0.7} />
      <Sparkle x={290} y={110} s={0.8} />
    </Svg>
  );
}

/** PDF summary: a page with highlighted lines and a pen. */
export function SummaryArt() {
  return (
    <Svg>
      <Ground rx={96} />
      <path d="M96 38H196L226 68V206H96Z" fill={W2} transform="translate(0 7)" />
      <path d="M96 38H196L226 68V206H96Z" fill={W} />
      <path d="M196 38V68H226Z" fill={W2} />
      <rect x={110} y={102} width={92} height={14} rx={3} fill={Y} />
      <rect x={110} y={142} width={70} height={14} rx={3} fill={Y} />
      {[
        [106, 88],
        [126, 96],
        [146, 80],
        [166, 92],
        [186, 60],
      ].map(([y, w]) => (
        <rect key={y} x={114} y={y} width={w} height={7} rx={3.5} fill="#d3d8e6" />
      ))}
      <Block x={80} y={58} w={60} h={28} r={9} fill={R} depth={R2} d={4} />
      <text
        x={110}
        y={78}
        textAnchor="middle"
        fill={W}
        fontSize={15}
        fontWeight={800}
        fontFamily="Inter Tight, Figtree, sans-serif"
      >
        PDF
      </text>
      <g transform="rotate(32 236 126)">
        <rect x={227} y={66} width={20} height={104} rx={10} fill={S2} transform="translate(3 0)" />
        <rect x={227} y={66} width={20} height={104} rx={10} fill={S} />
        <rect x={227} y={66} width={20} height={22} rx={10} fill={S2} />
        <path d="M227 166h20l-10 20Z" fill="#ffe7b0" />
        <path d="M234 180h6l-3 6Z" fill={INK} />
      </g>
      <Sparkle x={62} y={140} s={0.8} />
      <Sparkle x={266} y={42} />
    </Svg>
  );
}

/** All in one: one open box, and a book, a card and a question coming out of it. */
export function AllInOneArt() {
  return (
    <Svg>
      <Ground rx={98} />
      <g transform="rotate(-16 108 92)">
        <Block x={80} y={58} w={56} h={70} r={9} fill={G} depth={G2} d={5} />
        <rect x={80} y={58} width={13} height={70} rx={6} fill={G2} />
        <rect x={100} y={74} width={26} height={7} rx={3.5} fill={W} opacity={0.75} />
      </g>
      <g transform="rotate(15 214 84)">
        <Block x={184} y={60} w={64} h={46} r={9} fill={Y} depth={Y2} d={5} />
        <rect x={196} y={76} width={40} height={7} rx={3.5} fill={W} opacity={0.8} />
      </g>
      <circle cx={160} cy={62} r={27} fill={P2} transform="translate(0 4)" />
      <circle cx={160} cy={62} r={27} fill={P} />
      <path
        d="M151 54a9 9 0 1 1 13 8c-3 2-4 3-4 7"
        fill="none"
        stroke={W}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <circle cx={160} cy={77} r={3.5} fill={W} />
      <path d="M94 124H226L212 144H108Z" fill="#c9c3f7" />
      <path d="M102 140L70 116L96 106L120 128Z" fill={W2} />
      <path d="M218 140L250 116L224 106L200 128Z" fill={W2} />
      <Block x={100} y={136} w={120} h={66} r={12} fill={W} depth={W2} d={6} />
      <rect x={100} y={158} width={120} height={13} fill={S} />
      <Sparkle x={52} y={44} />
      <Sparkle x={274} y={38} s={0.8} />
      <Sparkle x={270} y={150} s={0.7} />
    </Svg>
  );
}

/** Question bank: a question and three answers, one of them right. */
export function QuestionBankArt() {
  const option = (y: number, letter: string, right = false) => (
    <g key={letter}>
      <Block
        x={168}
        y={y}
        w={122}
        h={36}
        r={18}
        fill={right ? G : W}
        depth={right ? G2 : W2}
        d={5}
      />
      <circle cx={187} cy={y + 18} r={11} fill={right ? W : "#e8ebf4"} />
      {right ? (
        <Check x={187} y={y + 18} s={0.75} stroke={G2} />
      ) : (
        <text
          x={187}
          y={y + 23}
          textAnchor="middle"
          fontSize={13}
          fontWeight={800}
          fill={INK}
          fontFamily="Inter Tight, Figtree, sans-serif"
        >
          {letter}
        </text>
      )}
      <rect
        x={206}
        y={y + 14}
        width={66}
        height={8}
        rx={4}
        fill={right ? W : LINE}
        opacity={right ? 0.75 : 1}
      />
    </g>
  );
  return (
    <Svg>
      <Ground rx={116} />
      <path d="M70 128L60 156L100 128Z" fill={W2} transform="translate(0 6)" />
      <Block x={36} y={36} w={122} h={98} r={24} fill={W} depth={W2} d={6} />
      <path d="M70 128L60 156L100 128Z" fill={W} />
      <path
        d="M82 70a16 16 0 1 1 24 14c-6 4-7 6-7 13"
        fill="none"
        stroke="#0f766e"
        strokeWidth={10}
        strokeLinecap="round"
      />
      <circle cx={99} cy={113} r={6} fill="#0f766e" />
      {option(44, "A")}
      {option(92, "B", true)}
      {option(140, "C")}
      <Sparkle x={300} y={28} s={0.8} />
      <Sparkle x={24} y={24} s={0.7} />
    </Svg>
  );
}

/** Lecture Lab: a slide on a stand, a microphone and a page of notes. */
export function LectureArt() {
  return (
    <Svg>
      <Ground rx={120} />
      <g stroke={W2} strokeWidth={8} strokeLinecap="round">
        <line x1={165} y1={140} x2={128} y2={204} />
        <line x1={165} y1={140} x2={202} y2={204} />
      </g>
      <Block x={72} y={26} w={186} h={118} r={14} fill={W} depth={W2} d={7} />
      {[
        [86, P],
        [100, Y],
        [114, G],
      ].map(([x, fill]) => (
        <circle key={x as number} cx={x as number} cy={42} r={5} fill={fill as string} />
      ))}
      <line
        x1={92}
        y1={128}
        x2={238}
        y2={128}
        stroke={LINE}
        strokeWidth={4}
        strokeLinecap="round"
      />
      {[
        [100, 96, S],
        [134, 78, G],
        [168, 60, Y],
        [202, 84, P],
      ].map(([x, y, fill]) => (
        <rect
          key={x as number}
          x={x as number}
          y={y as number}
          width={24}
          height={128 - (y as number)}
          rx={6}
          fill={fill as string}
        />
      ))}
      <g>
        <rect x={34} y={182} width={34} height={10} rx={5} fill={W} />
        <rect x={47} y={160} width={8} height={24} rx={3} fill={W2} />
        <rect x={36} y={118} width={30} height={46} rx={15} fill={W} />
        <path d="M51 118a15 15 0 0 1 15 15v16a15 15 0 0 1-15 15Z" fill={W2} />
        <rect x={36} y={144} width={30} height={7} fill={P} />
      </g>
      <g transform="rotate(9 272 168)">
        <Block x={244} y={138} w={56} h={64} r={9} fill={Y} depth={Y2} d={5} />
        {[152, 166, 180].map((y) => (
          <rect key={y} x={254} y={y} width={36} height={6} rx={3} fill={W} opacity={0.85} />
        ))}
      </g>
      <Sparkle x={290} y={30} />
      <Sparkle x={36} y={70} s={0.8} />
    </Svg>
  );
}

/** To-do: a clipboard with two tasks done and one to go, and a pencil. */
export function TodoArt() {
  const row = (y: number, done: boolean, w: number) => (
    <g key={y}>
      {done ? (
        <>
          <rect x={114} y={y} width={24} height={24} rx={7} fill={G} />
          <Check x={126} y={y + 12} s={0.85} />
        </>
      ) : (
        <rect
          x={115.5}
          y={y + 1.5}
          width={21}
          height={21}
          rx={6}
          fill={W}
          stroke="#c9d0e0"
          strokeWidth={3}
        />
      )}
      <rect x={148} y={y + 8} width={w} height={8} rx={4} fill={done ? "#cfd5e3" : LINE} />
    </g>
  );
  return (
    <Svg>
      <Ground rx={92} />
      <Block x={92} y={30} w={136} h={176} r={16} fill={S} depth={S2} d={7} />
      <rect x={104} y={50} width={112} height={146} rx={10} fill={W} />
      <rect x={136} y={22} width={48} height={22} rx={8} fill="#d5d9e6" />
      <rect x={150} y={15} width={20} height={12} rx={6} fill="#bcc2d4" />
      {row(66, true, 56)}
      {row(102, true, 44)}
      {row(138, false, 52)}
      <g transform="rotate(28 252 118)">
        <rect x={244} y={58} width={18} height={96} rx={4} fill={Y2} transform="translate(3 0)" />
        <rect x={244} y={58} width={18} height={96} rx={4} fill={Y} />
        <rect x={244} y={50} width={18} height={16} rx={6} fill={P} />
        <rect x={244} y={64} width={18} height={6} fill="#cfd3e3" />
        <path d="M244 154h18l-9 18Z" fill="#ffe7b0" />
        <path d="M250 166h6l-3 6Z" fill={INK} />
      </g>
      <Sparkle x={62} y={60} />
      <Sparkle x={70} y={160} s={0.7} />
    </Svg>
  );
}

/** Exams: a calendar page with the day circled, and an A+. */
export function ExamsArt() {
  const days = [];
  for (let j = 0; j < 3; j += 1)
    for (let i = 0; i < 4; i += 1)
      days.push(
        <rect
          key={`${i}-${j}`}
          x={102 + i * 31}
          y={98 + j * 28}
          width={22}
          height={18}
          rx={5}
          fill={i === 2 && j === 1 ? "#ffe1e2" : "#eceff7"}
        />,
      );
  return (
    <Svg>
      <Ground rx={100} />
      <Block x={82} y={38} w={156} h={160} r={18} fill={W} depth={W2} d={7} />
      <path d="M100 38H220a18 18 0 0 1 18 18V84H82V56a18 18 0 0 1 18-18Z" fill={R} />
      <rect x={82} y={78} width={156} height={6} fill={R2} />
      <rect x={110} y={24} width={12} height={28} rx={6} fill="#d5d9e6" />
      <rect x={198} y={24} width={12} height={28} rx={6} fill="#d5d9e6" />
      {days}
      <circle cx={175} cy={135} r={19} fill="none" stroke={R} strokeWidth={4.5} />
      <circle cx={238} cy={176} r={30} fill={Y2} transform="translate(0 5)" />
      <circle cx={238} cy={176} r={30} fill={Y} />
      <text
        x={238}
        y={185}
        textAnchor="middle"
        fill="#7a3d00"
        fontSize={24}
        fontWeight={800}
        fontFamily="Inter Tight, Figtree, sans-serif"
      >
        A+
      </text>
      <Sparkle x={56} y={58} />
      <Sparkle x={276} y={112} s={0.7} />
    </Svg>
  );
}

/** Shared decks: three cards passed around, with a share arrow over them. */
export function SharedArt() {
  return (
    <Svg>
      <Ground rx={108} />
      <g transform="rotate(-17 112 142)">
        <Block x={64} y={80} w={92} h={122} r={14} fill={S} depth={S2} />
        <rect x={80} y={100} width={48} height={8} rx={4} fill={W} opacity={0.7} />
      </g>
      <g transform="rotate(17 208 142)">
        <Block x={164} y={80} w={92} h={122} r={14} fill={P} depth={P2} />
        <rect x={180} y={100} width={48} height={8} rx={4} fill={W} opacity={0.7} />
      </g>
      <Block x={114} y={66} w={92} h={124} r={14} fill={W} depth={W2} d={7} />
      <circle cx={160} cy={112} r={20} fill={Y} />
      <circle cx={160} cy={112} r={8} fill={W} />
      <rect x={132} y={146} width={56} height={8} rx={4} fill={LINE} />
      <rect x={140} y={162} width={40} height={8} rx={4} fill={LINE} />
      <path
        d="M92 54C126 14 194 14 226 50"
        fill="none"
        stroke={Y}
        strokeWidth={9}
        strokeLinecap="round"
      />
      <path d="M212 50L236 62L238 36Z" fill={Y} strokeLinejoin="round" />
      <Sparkle x={48} y={44} s={0.8} />
      <Sparkle x={286} y={92} />
    </Svg>
  );
}

/** Classrooms and groups: a conversation in three bubbles. */
export function SpacesArt() {
  const dots = (cx: number, cy: number, fills: string[]) =>
    fills.map((fill, i) => <circle key={i} cx={cx + (i - 1) * 20} cy={cy} r={7} fill={fill} />);
  return (
    <Svg>
      <Ground rx={112} />
      <path d="M66 150L58 178L96 152Z" fill={G2} />
      <Block x={36} y={78} w={124} h={82} r={26} fill={G} depth={G2} d={6} />
      {dots(98, 119, [W, W, W])}
      <path d="M258 162L270 188L234 166Z" fill={Y2} />
      <Block x={164} y={92} w={120} h={78} r={26} fill={Y} depth={Y2} d={6} />
      {dots(224, 131, ["#8a5200", "#8a5200", "#8a5200"])}
      <path d="M146 86L152 108L172 86Z" fill={W} />
      <Block x={108} y={24} w={104} h={66} r={24} fill={W} depth={W2} d={6} />
      {dots(160, 57, [P, S, G])}
      <Sparkle x={292} y={44} />
      <Sparkle x={30} y={42} s={0.8} />
    </Svg>
  );
}

/** German Lab: a "Hallo!" bubble over an open book, with a ribbon in the flag's colours. */
export function GermanArt() {
  const ribbon = (dy: number, fill: string) => (
    <path
      key={fill}
      transform={`translate(0 ${dy})`}
      d="M30 44C80 26 126 62 176 44C222 28 256 52 292 40V56C256 68 222 44 176 60C126 78 80 42 30 60Z"
      fill={fill}
    />
  );
  return (
    <Svg>
      <Ground rx={110} />
      {ribbon(0, "#141416")}
      {ribbon(16, "#e0262b")}
      {ribbon(32, "#ffce00")}
      <path
        d="M70 148C104 138 136 140 160 154C184 140 216 138 250 148V206C216 198 184 198 160 210C136 198 104 198 70 206Z"
        fill="#5a0d0d"
      />
      <path d="M78 142C110 134 138 136 160 150V202C138 190 110 188 78 196Z" fill={W} />
      <path d="M242 142C210 134 182 136 160 150V202C182 190 210 188 242 196Z" fill="#eef3fb" />
      {[0, 14].map((dy) => (
        <g key={dy} stroke={LINE} strokeWidth={4} strokeLinecap="round" fill="none">
          <path d={`M94 ${160 + dy}C116 ${155 + dy} 134 ${157 + dy} 148 ${164 + dy}`} />
          <path d={`M226 ${160 + dy}C204 ${155 + dy} 186 ${157 + dy} 172 ${164 + dy}`} />
        </g>
      ))}
      <path d="M96 126L88 148L122 126Z" fill={W2} transform="translate(0 5)" />
      <Block x={64} y={78} w={132} h={52} r={22} fill={W} depth={W2} d={5} />
      <path d="M96 126L88 148L122 126Z" fill={W} />
      <text
        x={130}
        y={113}
        textAnchor="middle"
        fill={INK}
        fontSize={25}
        fontWeight={800}
        fontFamily="Inter Tight, Figtree, sans-serif"
        lang="de"
      >
        Hallo!
      </text>
      <Block x={206} y={92} w={86} h={38} r={18} fill={Y} depth={Y2} d={4} />
      <text
        x={249}
        y={117}
        textAnchor="middle"
        fill="#7a3d00"
        fontSize={16}
        fontWeight={800}
        fontFamily="Inter Tight, Figtree, sans-serif"
        lang="de"
      >
        Danke
      </text>
      <Sparkle x={292} y={160} s={0.8} />
      <Sparkle x={36} y={120} s={0.7} />
    </Svg>
  );
}
