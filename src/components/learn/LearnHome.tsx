import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { ImageSlot } from "@/components/learn/ImageSlot";
import { useLessonPath } from "@/components/learn/useLessonPath";
import { useAuth } from "@/hooks/useAuth";
import { useLearningLanguage } from "@/hooks/useLearningLanguage";
import { LanguageChooserCard } from "@/components/language/LanguagePicker";
import { showsGermanLab } from "@/lib/learning-language";
import { useStudyOverview } from "@/lib/use-review";
import { TOOLS, type ToolDef } from "@/lib/site-tools";
import { lessonsDone } from "@/lib/learn-home";

type Lang = "en" | "ar";
type Bi = { en: string; ar: string };

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

/** Every destination in one list: Rita first, then the study tools, grouped by what they are for. */
function buildSections(chips: { flashcards: Bi | null; lessons: Bi | null }): SectionDef[] {
  return [
    {
      id: "rita",
      title: { en: "Talk to Rita", ar: "تحدث مع ريتا" },
      rows: [
        {
          key: "rita-conversations",
          slot: "rita-conversations",
          name: { en: "Free conversation", ar: "محادثة حرة" },
          line: {
            en: "Talk about anything. Rita answers out loud and corrects you gently.",
            ar: "تحدث عن أي شيء. ريتا ترد بصوتها وتصحح لك بلطف.",
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

/**
 * The section shown, kept in the address (`/learn#study`) so back, reload and shared links land on
 * the same one. It starts on the first section so the server and the first paint agree.
 */
function useSection(ids: readonly string[]) {
  const [active, setActive] = useState<string>(ids[0] ?? "");
  useEffect(() => {
    const fromHash = () => {
      const id = window.location.hash.replace("#", "");
      if (ids.includes(id)) setActive(id);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [ids]);
  const choose = (id: string) => {
    setActive(id);
    try {
      window.history.replaceState(window.history.state, "", `#${id}`);
    } catch {
      /* the section already changed */
    }
  };
  return [ids.includes(active) ? active : (ids[0] ?? ""), choose] as const;
}

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
          className="uz-rail-item"
        >
          {label[lang]}
        </a>
      ))}
      <Link to="/study/progress" className="uz-rail-item uz-rail-extra">
        {lang === "ar" ? "تقدمي" : "Progress"}
      </Link>
    </nav>
  );
}

/** One destination: its picture on black, its name and one line. The first of a section is big. */
function ToolTile({ row, lang, lead }: { row: Row; lang: Lang; lead: boolean }) {
  return (
    <Link
      to={row.to}
      params={row.params as never}
      search={row.search as never}
      data-learn-row={row.key}
      data-lead={lead || undefined}
      className="uz-tile"
    >
      <ImageSlot slot={row.slot} lang={lang} />
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

const PHRASES = [
  { text: "Guten Morgen", lang: "de", spot: "uz-float-a", delay: 0 },
  { text: "How do I say…?", lang: "en", spot: "uz-float-b", delay: 1500 },
  { text: "كيف أحكي؟", lang: "ar", spot: "uz-float-c", delay: 3000 },
];

/** "Talk to Rita": the conversation as the big blue stage with Rita's orb, lessons beside it. */
function RitaStage({ section, lang }: { section: SectionDef; lang: Lang }) {
  const talk = section.rows.find((row) => row.key === "rita-conversations");
  const lessons = section.rows.find((row) => row.key === "rita-lessons");
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  return (
    <section id={section.id} aria-labelledby="rita-title" className="uz-pane uz-rita">
      {talk ? (
        <Link to={talk.to} data-learn-row={talk.key} className="uz-stage">
          <span className="uz-stage-text">
            <h2 id="rita-title" className="uz-stage-title">
              {t("Talk to Rita now", "تحدث مع ريتا الآن")}
            </h2>
            <span className="uz-stage-line">{talk.line[lang]}</span>
            <span className="rita-btn rita-btn-primary uz-stage-btn">
              {t("Start talking", "ابدأ الحديث")}
              <ArrowRight size={18} aria-hidden="true" className="rtl:rotate-180" />
            </span>
          </span>
          <span className="uz-orb-zone" aria-hidden="true">
            <span className="rh-ring uz-orb-ring" />
            <span className="rh-ring uz-orb-ring" style={{ ["--rh-d" as string]: "1800ms" }} />
            <span className="uz-orb">
              <span className="uz-orb-waves">
                {[0, 200, 100, 300, 150].map((delay, i) => (
                  <span
                    key={i}
                    className="rh-wave"
                    style={{ ["--rh-d" as string]: `${delay}ms` }}
                  />
                ))}
              </span>
            </span>
            {PHRASES.map((phrase) => (
              <span
                key={phrase.text}
                lang={phrase.lang}
                dir={phrase.lang === "ar" ? "rtl" : "ltr"}
                className={`rh-float uz-float ${phrase.spot}`}
                style={{ ["--rh-d" as string]: `${phrase.delay}ms` }}
              >
                {phrase.text}
              </span>
            ))}
          </span>
        </Link>
      ) : null}
      {lessons ? (
        <Link to={lessons.to} data-learn-row={lessons.key} className="uz-lessons">
          <ImageSlot slot={lessons.slot} lang={lang} />
          <span className="uz-tile-text">
            <span className="uz-tile-name">
              {lessons.name[lang]}
              {lessons.chip ? <span className="uz-tile-tag">{lessons.chip[lang]}</span> : null}
            </span>
            <span className="uz-tile-line">{lessons.line[lang]}</span>
          </span>
          <span className="uz-tile-go" aria-hidden="true">
            <ArrowRight size={18} className="rtl:rotate-180" />
          </span>
        </Link>
      ) : null}
    </section>
  );
}

function Section({ section, lang }: { section: SectionDef; lang: Lang }) {
  if (section.id === "rita") return <RitaStage section={section} lang={lang} />;
  return (
    <section id={section.id} aria-labelledby={`${section.id}-title`} className="uz-pane">
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
}

/** /learn: Rita and every study tool in one place. */
export function LearnHome() {
  const { i18n } = useTranslation();
  const lang: Lang = (i18n.language ?? "").startsWith("ar") ? "ar" : "en";
  const { user } = useAuth();
  const signedIn = Boolean(user);
  const overview = useStudyOverview();
  const lessons = useLessonPath(signedIn);
  const learning = useLearningLanguage();

  const path = lessonsDone(lessons.lessons);
  const showGerman = showsGermanLab(learning.code);
  const sections = buildSections({
    flashcards:
      overview.data && overview.data.due > 0
        ? { en: `${overview.data.due} due`, ar: `${overview.data.due} مستحقة` }
        : null,
    lessons:
      path.total > 0
        ? { en: `${path.done} of ${path.total} done`, ar: `${path.done} من ${path.total} منجزة` }
        : null,
  });

  const rail = useMemo(
    () => (showGerman ? RAIL : RAIL.filter((entry) => entry.id !== "german")),
    [showGerman],
  );
  const railIds = useMemo(() => rail.map((entry) => entry.id), [rail]);
  const [active, choose] = useSection(railIds);

  return (
    <div className="edith-premium edith-light rh-learn-home uz-learn min-h-screen">
      <SiteHeader />

      <main className="uz-learn-main">
        <h1 className="sr-only">{lang === "ar" ? "التعلّم" : "Learn"}</h1>

        {signedIn && learning.ready && learning.code === null ? (
          <div className="mb-10">
            <LanguageChooserCard />
          </div>
        ) : null}

        <div className="uz-learn-grid">
          <SideList lang={lang} rail={rail} active={active} onChoose={choose} />
          <div className="min-w-0">
            {sections
              .filter((section) => section.id === active)
              .map((section) => (
                <Section key={section.id} section={section} lang={lang} />
              ))}
          </div>
        </div>
      </main>
    </div>
  );
}
