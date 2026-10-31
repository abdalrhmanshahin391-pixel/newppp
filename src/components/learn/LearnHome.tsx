import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
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

/** Which section is under the top of the screen, for the highlight in the side list. */
function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = useState<string>(ids[0] ?? "");
  // After a tap the page is still gliding to the section; do not let the scroll watcher
  // highlight the sections it passes on the way (or the last one, near the page end).
  const heldUntil = useRef(0);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!elements.length) return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        if (Date.now() < heldUntil.current) return;
        const first = ids.find((id) => visible.has(id));
        if (first) setActive(first);
      },
      { rootMargin: "-96px 0px -55% 0px" },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids]);
  const choose = (id: string) => {
    heldUntil.current = Date.now() + 1200;
    setActive(id);
  };
  return [active, choose] as const;
}

/** Scrolls to a section and keeps the address in step, without going through the router. */
function jumpTo(event: MouseEvent<HTMLAnchorElement>, id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  event.preventDefault();
  const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
  try {
    window.history.replaceState(window.history.state, "", `#${id}`);
  } catch {
    /* the scroll already happened */
  }
}

function SideList({ lang, showGerman }: { lang: Lang; showGerman: boolean }) {
  const rail = useMemo(
    () => (showGerman ? RAIL : RAIL.filter((entry) => entry.id !== "german")),
    [showGerman],
  );
  const railIds = useMemo(() => rail.map((entry) => entry.id), [rail]);
  const [active, choose] = useActiveSection(railIds);
  return (
    <nav aria-label={lang === "ar" ? "أقسام التعلم" : "Learning sections"} className="uz-rail">
      {rail.map(({ id, label }) => (
        <a
          key={id}
          href={`#${id}`}
          onClick={(event) => {
            choose(id);
            jumpTo(event, id);
          }}
          aria-current={active === id ? "location" : undefined}
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
    <section id={section.id} aria-labelledby={`${section.id}-title`} className="uz-section">
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
function useReveal() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const heads = Array.from(document.querySelectorAll<HTMLElement>(".uz-learn [data-reveal]"));
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
  }, []);
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

  useReveal();

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
          <SideList lang={lang} showGerman={showGerman} />
          <div className="min-w-0">
            {sections
              .filter((section) => showGerman || section.id !== "german")
              .map((section) => (
                <Section key={section.id} section={section} lang={lang} />
              ))}
          </div>
        </div>
      </main>
    </div>
  );
}
