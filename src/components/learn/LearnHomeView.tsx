import { memo, useMemo, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { Logo } from "./CardLogo";
import { lookFor } from "./card-looks";
import { TalkArt } from "./art/LearnArt";
import { useLearnSection } from "./useLearnSection";
import { TOOLS, type ToolDef } from "@/lib/site-tools";

type Lang = "en" | "ar";
export type Bi = { en: string; ar: string };

type Row = {
  key: string;
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
    name: tool.name,
    line: tool.line,
    to: tool.to,
    params: tool.params,
    ai: tool.column === "ai",
  };
}

const tool = (key: string) => TOOLS.find((t) => t.key === key)!;

/** Every destination in one list: Rita first, then the study tools, grouped by what they are for. */
function buildSections(chips: { flashcards: Bi | null; lessons: Bi | null }): SectionDef[] {
  return [
    {
      id: "rita",
      title: { en: "Talk to Rita", ar: "تحدث مع ريتا" },
      rows: [
        {
          key: "rita-conversations",
          name: { en: "Free conversation", ar: "محادثة حرة" },
          line: {
            en: "Talk about anything. Rita answers out loud and corrects you gently.",
            ar: "تحدث عن أي شيء. ريتا ترد بصوتها وتصحح لك بلطف.",
          },
          to: "/rita-conversations",
        },
        {
          key: "rita-lessons",
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
  { id: "rita", label: { en: "Talk to Rita", ar: "تحدث مع ريتا" } },
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

function Pills({ row, lang }: { row: Row; lang: Lang }) {
  if (!row.ai && !row.chip) return null;
  return (
    <span className="gc-pills">
      {row.ai ? <span className="gc-pill">AI</span> : null}
      {row.chip ? <span className="gc-pill">{row.chip[lang]}</span> : null}
    </span>
  );
}

/**
 * One destination as a game card: its own gradient, its name drawn as a logo, one line, an
 * illustration and a white button over the art. The first card of a section is wider.
 */
function ToolTile({ row, lang, lead }: { row: Row; lang: Lang; lead: boolean }) {
  const look = lookFor(row.key, row.name);
  return (
    <Link
      to={row.to}
      params={row.params as never}
      search={row.search as never}
      data-learn-row={row.key}
      data-lead={lead || undefined}
      data-tone={look.tone}
      className="gc"
    >
      <span className="gc-head">
        <span className="gc-sr">{row.name[lang]}</span>
        <Logo look={look} lang={lang} />
        <span className="gc-line">{row.line[lang]}</span>
        <Pills row={row} lang={lang} />
      </span>
      <span className="gc-art" aria-hidden="true">
        <look.Art />
      </span>
      <span className="gc-btn">{look.go[lang]}</span>
    </Link>
  );
}

const PHRASES = [
  { text: "Guten Morgen", lang: "de", spot: "gc-float-a" },
  { text: "How do I say…?", lang: "en", spot: "gc-float-b" },
  { text: "كيف أحكي؟", lang: "ar", spot: "gc-float-c" },
];

/** The conversation stage (the biggest card) and the lessons card beside it. */
function RitaStage({ section, lang }: { section: SectionDef; lang: Lang }) {
  const talk = section.rows.find((row) => row.key === "rita-conversations");
  const lessons = section.rows.find((row) => row.key === "rita-lessons");
  const look = talk ? lookFor(talk.key, talk.name) : null;
  return (
    <section aria-labelledby="rita-title" className="uz-pane uz-rita">
      {talk && look ? (
        <Link
          to={talk.to}
          data-learn-row={talk.key}
          data-tone={look.tone}
          data-stage
          className="gc"
        >
          <span className="gc-head">
            <h2 id="rita-title" className="gc-h">
              <span className="gc-sr">
                {lang === "ar" ? "تحدث مع ريتا الآن" : "Talk to Rita now"}
              </span>
              <Logo look={look} lang={lang} />
            </h2>
            <span className="gc-line">{talk.line[lang]}</span>
            <span className="gc-btn">{look.go[lang]}</span>
          </span>
          <span className="gc-art" aria-hidden="true">
            <TalkArt />
            {PHRASES.map((phrase) => (
              <span
                key={phrase.text}
                lang={phrase.lang}
                dir={phrase.lang === "ar" ? "rtl" : "ltr"}
                className={`gc-float ${phrase.spot}`}
              >
                {phrase.text}
              </span>
            ))}
          </span>
        </Link>
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
