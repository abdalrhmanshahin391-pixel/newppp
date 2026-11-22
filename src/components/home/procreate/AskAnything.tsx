import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  Clapperboard,
  FileText,
  GraduationCap,
  Layers,
  ListChecks,
  MessageCircle,
  Repeat2,
  Puzzle,
  type LucideIcon,
} from "lucide-react";
import { useUiLanguage } from "@/components/language/useUiLanguage";
import "./ask-anything.css";

type Ask = { to: string; Icon: LucideIcon; source: [string, string]; ask: [string, string] };

// Each row: the part of Uzyra that answers, and something a learner would ask it.
const ASKS: Ask[] = [
  {
    to: "/rita",
    Icon: MessageCircle,
    source: ["Talk", "المحادثة"],
    ask: ["Let's practise ordering a coffee in English", "خلّينا نتدرّب نطلب قهوة بالإنجليزي"],
  },
  {
    to: "/rita-lessons",
    Icon: GraduationCap,
    source: ["Lessons", "الدروس"],
    ask: ["Explain the present perfect with examples", "اشرحلي الـ present perfect بأمثلة"],
  },
  {
    to: "/books",
    Icon: BookOpen,
    source: ["Library", "المكتبة"],
    ask: ["Find me an easy book about travel", "لاقيلي كتاب سهل عن السفر"],
  },
  {
    to: "/study/lectures",
    Icon: FileText,
    source: ["Lecture Lab", "مختبر المحاضرات"],
    ask: ["Summarise my lecture PDF and quiz me", "لخّصلي محاضرة الـ PDF واسألني عليها"],
  },
  {
    to: "/study",
    Icon: Layers,
    source: ["Flashcards", "البطاقات"],
    ask: ["Go over the words I got wrong", "راجعلي الكلمات اللي غلطت فيها"],
  },
  {
    to: "/study/exams",
    Icon: CalendarDays,
    source: ["Exams", "الامتحانات"],
    ask: ["Which exams do I have this week?", "شو عندي امتحانات هالأسبوع؟"],
  },
  {
    to: "/wordcraft",
    Icon: Puzzle,
    source: ["Wordcraft", "Wordcraft"],
    ask: ["Give me a short word game", "بدّي لعبة كلمات قصيرة"],
  },
  {
    to: "/rita-lessons",
    Icon: Clapperboard,
    source: ["Film clips", "مقاطع الأفلام"],
    ask: ["Teach me a line from a film scene", "علّمني جملة من مقطع فيلم"],
  },
  {
    to: "/study/todo",
    Icon: ListChecks,
    source: ["To-do", "المهام"],
    ask: ["What should I study first today?", "شو أدرس أول اشي اليوم؟"],
  },
  {
    to: "/repeat",
    Icon: Repeat2,
    source: ["Repeat", "كرّر"],
    ask: ["Check how I say “thought” and “through”", "شوف كيف بلفظ thought و through"],
  },
];

const ROW = 58;
const SIDE = 3; // rows shown above and below the middle one
const SCALE = [1, 0.93, 0.86, 0.79];
const FADE = [1, 0.62, 0.45, 0.28];
const SHIFT = [0, 18, 36, 54];
const EVERY_MS = 2400;

/** Signed distance of row `i` from the middle row `active`, in the range around 0. */
function offset(i: number, active: number, n: number) {
  let d = (((i - active) % n) + n) % n;
  if (d > n / 2) d -= n;
  return d;
}

/**
 * «Ask Uzyra anything»: what a learner can ask, turning like a wheel. The middle question is in
 * ink, the ones around it shrink, fade and lean back. It turns every 2.4s while on screen, stops
 * under the pointer or keyboard focus (that question comes to the middle), and stays still with
 * reduced motion. The café picture sits beside it.
 */
export function AskAnything() {
  const ar = useUiLanguage() === "ar";
  const lang = ar ? 1 : 0;
  const n = ASKS.length;
  const [active, setActive] = useState(0);
  const [held, setHeld] = useState(false);
  // The row under the pointer is lit where it stands (moving it would slide it out from under).
  const [hover, setHover] = useState<number | null>(null);
  const [seen, setSeen] = useState(false);
  const [still, setStill] = useState(false);
  const box = useRef<HTMLElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setStill(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setSeen(entry.isIntersecting), {
      threshold: 0.25,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (held || hover !== null || !seen || still) return;
    const timer = window.setInterval(() => setActive((a) => (a + 1) % n), EVERY_MS);
    return () => window.clearInterval(timer);
  }, [held, hover, seen, still, n]);

  return (
    <section ref={box} className="uz-ask" dir={ar ? "rtl" : "ltr"} aria-labelledby="uz-ask-title">
      <div className="uz-ask-copy">
        <h2 id="uz-ask-title" className="uz-ask-title">
          {ar ? "اسأل يوزرا أي شي" : "Ask Uzyra anything"}
        </h2>
        <ul
          className="uz-ask-list"
          aria-label={ar ? "أشياء ممكن تسألها" : "Things you can ask"}
          style={{ height: ROW * (SIDE * 2 + 1) }}
          onMouseLeave={() => setHover(null)}
        >
          {ASKS.map((item, i) => {
            const d = offset(i, active, n);
            const far = Math.abs(d);
            const shown = far <= SIDE;
            const step = Math.min(far, SIDE);
            const lean = (ar ? -1 : 1) * SHIFT[step];
            const Icon = item.Icon;
            return (
              <li
                key={i}
                className="uz-ask-row"
                data-current={hover === null ? d === 0 : hover === i}
                aria-hidden={!shown}
                style={{
                  height: ROW,
                  opacity: shown ? FADE[step] : 0,
                  transform: `translateX(${lean}px) translateY(${(d + SIDE) * ROW}px) scale(${shown ? SCALE[step] : SCALE[SIDE]})`,
                  pointerEvents: shown ? undefined : "none",
                }}
              >
                <Link
                  to={item.to as never}
                  tabIndex={shown ? 0 : -1}
                  className="uz-ask-link"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => {
                    setHeld(true);
                    setActive(i);
                  }}
                  onBlur={() => setHeld(false)}
                >
                  <span className="uz-ask-source">{item.source[lang]}</span>
                  <span className="uz-ask-chevron" aria-hidden="true">
                    <ChevronRight size={18} />
                  </span>
                  <span className="uz-ask-text">
                    <Icon size={20} aria-hidden="true" className="uz-ask-icon" />
                    <span className="uz-ask-q">{item.ask[lang]}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <img
        className="uz-ask-art"
        src="/media/home/cafe-books.webp"
        width={900}
        height={1125}
        loading="lazy"
        decoding="async"
        alt={
          ar
            ? "مقهى صغير للكتب، يوزرا يحضّر القهوة على البار وفوقه زاوية قراءة"
            : "A little café and bookshop: Uzyra makes coffee at the bar, with a reading nook above"
        }
      />
    </section>
  );
}
