import { memo, useMemo, useRef, type ComponentType, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { ImageSlot } from "@/components/learn/ImageSlot";
import {
  AllInOneCardArt,
  FlashcardsCardArt,
  LectureCardArt,
  LessonsCardArt,
  MemoryCardArt,
  PairsCardArt,
  QuestionBankCardArt,
  SummaryCardArt,
  TalkCardArt,
  WordcraftCardArt,
} from "./PlayCardArt";
import { useLearnSection } from "./useLearnSection";
import { TOOLS, type ToolDef } from "@/lib/site-tools";

type Lang = "en" | "ar";
export type Bi = { en: string; ar: string };

type Row = {
  key: string;
  slot: string;
  name: Bi;
  line: Bi;
  to: string;
  params?: Record<string, string>;
  search?: Record<string, string>;
  ai?: boolean;
  chip?: Bi | null;
};

type SectionDef = { id: string; title: Bi; rows: Row[] };

const SECTION_IDS = ["rita", "study", "plan", "together", "german"] as const;

function rowOf(tool: ToolDef): Row {
  return {
    key: tool.key,
    slot: tool.key,
    name: tool.name,
    line: tool.line,
    to: tool.to,
    params: tool.params,
    ai: tool.column === "ai",
  };
}

const tool = (key: string) => TOOLS.find((t) => t.key === key)!;

/** Every destination in one list: Uzyra first, then the study tools, grouped by what they are for. */
function buildSections(chips: { flashcards: Bi | null; lessons: Bi | null }): SectionDef[] {
  return [
    {
      id: "rita",
      title: { en: "Talk to Uzyra", ar: "تحدث مع يوزرا" },
      rows: [
        {
          key: "rita-conversations",
          slot: "rita-conversations",
          name: { en: "Free conversation", ar: "محادثة حرة" },
          line: {
            en: "Talk about anything. Uzyra answers out loud and corrects you gently.",
            ar: "تحدث عن أي شيء. يوزرا ترد بصوتها وتصحح لك بلطف.",
          },
          to: "/rita-conversations",
        },
        {
          key: "rita-lessons",
          slot: "rita-lessons",
          name: { en: "Lessons", ar: "الدروس" },
          line: {
            en: "Short lessons with clear goals. Earn stars as you reach them.",
            ar: "دروس قصيرة بأهداف واضحة. اكسب نجومًا كلما حققتها.",
          },
          to: "/rita-lessons",
          chip: chips.lessons,
        },
      ],
    },
    {
      id: "study",
      title: { en: "Study with your own material", ar: "ادرس بمادتك الخاصة" },
      rows: [
        { ...rowOf(tool("flashcards")), chip: chips.flashcards },
        rowOf(tool("memory-lab")),
        {
          key: "pairs",
          slot: "pairs",
          name: { en: "Pairs", ar: "اقرن" },
          line: {
            en: "Match your flashcards' fronts and backs against the clock.",
            ar: "اقرن وجه بطاقاتك مع ظهرها قبل ما يخلص الوقت.",
          },
          to: "/study/pairs",
        },
        {
          key: "wordcraft",
          slot: "wordcraft",
          name: { en: "Wordcraft", ar: "Wordcraft" },
          line: {
            en: "Pick easy, medium or hard: find four new English words in the letters and learn what they mean.",
            ar: "اختار سهل أو متوسط أو صعب: لاقي أربع كلمات إنجليزية جديدة بين الحروف وتعلّم معانيها.",
          },
          to: "/wordcraft",
        },
        rowOf(tool("pdf-summary")),
        rowOf(tool("all-in-one")),
        rowOf(tool("question-bank")),
        rowOf(tool("lecture-lab")),
      ],
    },
    {
      id: "plan",
      title: { en: "Plan your time", ar: "نظّم وقتك" },
      rows: [rowOf(tool("todo")), rowOf(tool("exams"))],
    },
    {
      id: "together",
      title: { en: "Study together", ar: "ادرس مع غيرك" },
      rows: [rowOf(tool("shared-decks")), rowOf(tool("spaces"))],
    },
    {
      id: "german",
      title: { en: "German", ar: "الألمانية" },
      rows: [rowOf(tool("german-lab"))],
    },
  ];
}

const RAIL: { id: (typeof SECTION_IDS)[number]; label: Bi }[] = [
  { id: "rita", label: { en: "Talk to Uzyra", ar: "تحدث مع يوزرا" } },
  { id: "study", label: { en: "My study space", ar: "مساحتي الدراسية" } },
  { id: "plan", label: { en: "Plan", ar: "الخطة" } },
  { id: "together", label: { en: "Together", ar: "مع غيري" } },
  { id: "german", label: { en: "German", ar: "الألمانية" } },
];

function SideList({
  lang,
  rail,
  active,
  onChoose,
}: {
  lang: Lang;
  rail: typeof RAIL;
  active: string;
  onChoose: (id: string) => void;
}) {
  return (
    <nav aria-label={lang === "ar" ? "أقسام التعلم" : "Learning sections"} className="uz-rail">
      {rail.map(({ id, label }) => (
        <a
          key={id}
          href={`#${id}`}
          onClick={(event) => {
            event.preventDefault();
            onChoose(id);
          }}
          aria-current={active === id ? "page" : undefined}
          aria-controls={`learn-panel-${id}`}
          className="uz-rail-item"
        >
          {label[lang]}
        </a>
      ))}
    </nav>
  );
}

type Play = { Art: ComponentType; go: Bi; line?: Bi };

/**
 * Destinations already redesigned as game cards (two or three at a time). The rest keep the
 * monochrome tile until their turn.
 */
const PLAY: Record<string, Play> = {
  "rita-conversations": {
    Art: TalkCardArt,
    go: { en: "Start talking", ar: "ابدأ الحديث" },
  },
  "rita-lessons": {
    Art: LessonsCardArt,
    go: { en: "Start", ar: "ابدأ" },
    line: { en: "Short lessons with clear goals.", ar: "دروس قصيرة بأهداف واضحة." },
  },
  flashcards: { Art: FlashcardsCardArt, go: { en: "Study", ar: "ادرس" } },
  "memory-lab": { Art: MemoryCardArt, go: { en: "Play", ar: "العب" } },
  pairs: { Art: PairsCardArt, go: { en: "Play", ar: "العب" } },
  wordcraft: { Art: WordcraftCardArt, go: { en: "Play", ar: "العب" } },
  "pdf-summary": { Art: SummaryCardArt, go: { en: "Summarise", ar: "لخّص" } },
  "all-in-one": { Art: AllInOneCardArt, go: { en: "Start", ar: "ابدأ" } },
  "question-bank": { Art: QuestionBankCardArt, go: { en: "Practise", ar: "تدرّب" } },
  "lecture-lab": { Art: LectureCardArt, go: { en: "Start", ar: "ابدأ" } },
};

/**
 * A game card: one solid colour, a big centred title, one line, the drawing at the bottom and a
 * white button with a lip over the bottom of the drawing.
 */
function PlayCard({
  row,
  play,
  lang,
  lead = false,
  title,
}: {
  row: Row;
  play: Play;
  lang: Lang;
  lead?: boolean;
  title?: ReactNode;
}) {
  return (
    <Link
      to={row.to}
      params={row.params as never}
      search={row.search as never}
      data-learn-row={row.key}
      data-lead={lead || undefined}
      className="uz-play"
    >
      {title ?? <span className="uz-play-title">{row.name[lang]}</span>}
      <span className="uz-play-line">{(play.line ?? row.line)[lang]}</span>
      {row.ai || row.chip ? (
        <span className="uz-play-pills">
          {row.ai ? <span className="uz-play-pill">AI</span> : null}
          {row.chip ? <span className="uz-play-pill">{row.chip[lang]}</span> : null}
        </span>
      ) : null}
      <span className="uz-play-art" aria-hidden="true">
        <play.Art />
      </span>
      <span className="uz-play-btn">{play.go[lang]}</span>
    </Link>
  );
}

/** One destination: its picture on black, its name and one line. The first of a section is big. */
function ToolTile({ row, lang, lead }: { row: Row; lang: Lang; lead: boolean }) {
  const play = PLAY[row.key];
  if (play) return <PlayCard row={row} play={play} lang={lang} lead={lead} />;
  return (
    <Link
      to={row.to}
      params={row.params as never}
      search={row.search as never}
      data-learn-row={row.key}
      data-lead={lead || undefined}
      className="uz-tile"
    >
      <ImageSlot slot={row.slot} lang={lang} priority={lead} />
      <span className="uz-tile-text">
        <span className="uz-tile-name">
          {row.name[lang]}
          {row.ai ? <span className="uz-tile-tag">AI</span> : null}
          {row.chip ? <span className="uz-tile-tag">{row.chip[lang]}</span> : null}
        </span>
        <span className="uz-tile-line">{row.line[lang]}</span>
      </span>
      <span className="uz-tile-go" aria-hidden="true">
        <ArrowRight size={18} className="rtl:rotate-180" />
      </span>
    </Link>
  );
}

/** Uzyra's two cards: free talk (the section's heading) and lessons. */
function RitaStage({ section, lang }: { section: SectionDef; lang: Lang }) {
  const talk = section.rows.find((row) => row.key === "rita-conversations");
  const lessons = section.rows.find((row) => row.key === "rita-lessons");
  return (
    <section aria-labelledby="rita-title" className="uz-pane uz-rita">
      {talk ? (
        <PlayCard
          row={talk}
          play={PLAY[talk.key]}
          lang={lang}
          title={
            <h2 id="rita-title" className="uz-play-title">
              {lang === "ar" ? "محادثة حرة مع يوزرا" : "Free talk with Uzyra"}
            </h2>
          }
        />
      ) : null}
      {lessons ? <ToolTile row={lessons} lang={lang} lead={false} /> : null}
    </section>
  );
}

const Section = memo(function Section({ section, lang }: { section: SectionDef; lang: Lang }) {
  if (section.id === "rita") return <RitaStage section={section} lang={lang} />;
  return (
    <section aria-labelledby={`${section.id}-title`} className="uz-pane">
      <h2 id={`${section.id}-title`} className="uz-section-title">
        {section.title[lang]}
      </h2>
      <ul className="uz-tiles" data-count={section.rows.length}>
        {section.rows.map((row, index) => (
          <li key={row.key} data-lead={index === 0 || undefined}>
            <ToolTile row={row} lang={lang} lead={index === 0} />
          </li>
        ))}
      </ul>
    </section>
  );
});

// Keep visited panels mounted: returning to a section reuses its decoded images and DOM.
// Only the current panel is visible or keyboard reachable.
export function LearnSections({
  lang,
  showGerman,
  chips,
}: {
  lang: Lang;
  showGerman: boolean;
  chips: { flashcards: Bi | null; lessons: Bi | null };
}) {
  const sections = useMemo(() => buildSections(chips), [chips]);
  const rail = useMemo(
    () => (showGerman ? RAIL : RAIL.filter((entry) => entry.id !== "german")),
    [showGerman],
  );
  const ids: readonly string[] = useMemo(() => rail.map((entry) => entry.id), [rail]);
  const { active, visited, choose } = useLearnSection(ids);
  const content = useRef<HTMLDivElement>(null);

  function select(id: string) {
    if (id === active) return;
    // A shorter section must not leave a scrolled page looking at its footer.
    // Read once before changing the panel; no animated height or competing smooth scroll.
    const top = content.current?.getBoundingClientRect().top;
    const header = content.current?.closest(".uz-learn")?.querySelector("header");
    const offset = (header?.getBoundingClientRect().height ?? 64) + 24;
    if (top != null && top < offset) {
      window.scrollTo({ top: Math.max(0, window.scrollY + top - offset), behavior: "instant" });
    }
    choose(id);
  }

  return (
    <div className="uz-learn-grid" ref={content} dir={lang === "ar" ? "rtl" : "ltr"}>
      <SideList lang={lang} rail={rail} active={active} onChoose={select} />
      <div className="uz-panels">
        {sections
          .filter((section) => ids.includes(section.id))
          .map((section) => {
            const current = section.id === active;
            return (
              <div
                key={section.id}
                id={`learn-panel-${section.id}`}
                className="uz-panel"
                hidden={!current}
                inert={!current}
                aria-hidden={!current}
              >
                {visited.has(section.id) || current ? (
                  <Section section={section} lang={lang} />
                ) : null}
              </div>
            );
          })}
      </div>
    </div>
  );
}
