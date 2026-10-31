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

/** One destination: its picture, its name and one line. The first of a section is the wide one. */
function ToolTile({ row, lang, lead }: { row: Row; lang: Lang; lead: boolean }) {
  return (
    <Link
      to={row.to}
      params={row.params as never}
      search={row.search as never}
      data-learn-row={row.key}
      data-lead={lead || undefined}
      className="uz-tile group"
    >
      <ImageSlot slot={row.slot} lang={lang} />
      <span className="uz-tile-text">
        <span className="uz-tile-name">
          {row.name[lang]}
          {row.ai ? <span className="uz-tile-tag">AI</span> : null}
          {row.chip ? <span className="uz-tile-tag">{row.chip[lang]}</span> : null}
        </span>
        <span className="uz-tile-line">{row.line[lang]}</span>
        <span className="uz-tile-go" aria-hidden="true">
          {lang === "ar" ? "افتح" : "Open"}
          <ArrowRight size={14} strokeWidth={1.5} className="rtl:rotate-180" />
        </span>
      </span>
    </Link>
  );
}

function Section({ section, lang }: { section: SectionDef; lang: Lang }) {
  return (
    <section id={section.id} aria-labelledby={`${section.id}-title`} className="uz-section uz-pane">
      <div className="uz-section-head" data-reveal>
        <h2 id={`${section.id}-title`} className="uz-section-title">
          {section.title[lang]}
        </h2>
        <span className="uz-section-rule" aria-hidden="true" />
      </div>
      <ul className="uz-tiles">
        {section.rows.map((row, index) => (
          <li key={row.key} data-lead={index === 0 || undefined}>
            <ToolTile row={row} lang={lang} lead={index === 0} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Section titles draw their line once, when they first come into view. Without script, or with
 * reduced motion, everything is simply shown.
 */
function useReveal(section: string) {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const heads = Array.from(
      document.querySelectorAll<HTMLElement>('.uz-learn [data-reveal]:not([data-reveal="in"])'),
    );
    heads.forEach((head) => head.setAttribute("data-reveal", "wait"));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-reveal", "in");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    heads.forEach((head) => observer.observe(head));
    return () => observer.disconnect();
  }, [section]);
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
  useReveal(active);

  return (
    <div className="edith-premium rh-learn-home uz-learn min-h-screen">
      <SiteHeader />

      <main className="uz-learn-main">
        <div className="uz-learn-head" data-reveal>
          <h1 className="uz-learn-title">{lang === "ar" ? "التعلّم" : "Learn"}</h1>
          <span className="uz-section-rule" aria-hidden="true" />
        </div>

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
