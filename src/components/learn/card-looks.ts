/** The look of every card on /learn: tone, logo text and style, button word and art. */
import type { ComponentType } from "react";
import {
  AllInOneArt,
  ExamsArt,
  FlashcardsArt,
  GermanArt,
  LectureArt,
  LessonsArt,
  MemoryArt,
  QuestionBankArt,
  SharedArt,
  SpacesArt,
  SummaryArt,
  TalkArt,
  TodoArt,
} from "./art/LearnArt";

type Lang = "en" | "ar";
type Bi = { en: string; ar: string };

/** How a card's name is drawn: each card has its own logo treatment (styles in `.gc-logo`). */
export type LogoStyle =
  | "script"
  | "star"
  | "bold"
  | "tiles"
  | "marker"
  | "spark"
  | "bubble"
  | "wave"
  | "check"
  | "stamp"
  | "linked"
  | "retro"
  | "flag";

export type Look = {
  /** Picks the gradient and the button colour (`.gc[data-tone]`). */
  tone: string;
  logo: Bi;
  style: LogoStyle;
  /** The short word on the white button. */
  go: Bi;
  Art: ComponentType;
};

/** One look per destination on /learn. A destination without one falls back to `DEFAULT_LOOK`. */
export const LOOKS: Record<string, Look> = {
  "rita-conversations": {
    tone: "talk",
    logo: { en: "Talk to Rita", ar: "تحدث مع ريتا" },
    style: "script",
    go: { en: "Start talking", ar: "ابدأ الحديث" },
    Art: TalkArt,
  },
  "rita-lessons": {
    tone: "lessons",
    logo: { en: "Lessons", ar: "الدروس" },
    style: "star",
    go: { en: "Start", ar: "ابدأ" },
    Art: LessonsArt,
  },
  flashcards: {
    tone: "cards",
    logo: { en: "Flashcards", ar: "بطاقاتي" },
    style: "bold",
    go: { en: "Study", ar: "ادرس" },
    Art: FlashcardsArt,
  },
  "memory-lab": {
    tone: "memory",
    logo: { en: "Memory Lab", ar: "مختبر الذاكرة" },
    style: "tiles",
    go: { en: "Play", ar: "العب" },
    Art: MemoryArt,
  },
  "pdf-summary": {
    tone: "summary",
    logo: { en: "PDF Summary", ar: "ملخص PDF" },
    style: "marker",
    go: { en: "Summarise", ar: "لخّص" },
    Art: SummaryArt,
  },
  "all-in-one": {
    tone: "allinone",
    logo: { en: "All in One", ar: "ريتا الشاملة" },
    style: "spark",
    go: { en: "Start", ar: "ابدأ" },
    Art: AllInOneArt,
  },
  "question-bank": {
    tone: "qbank",
    logo: { en: "Question Bank", ar: "بنك الأسئلة" },
    style: "bubble",
    go: { en: "Practise", ar: "تدرّب" },
    Art: QuestionBankArt,
  },
  "lecture-lab": {
    tone: "lecture",
    logo: { en: "Lecture Lab", ar: "مختبر المحاضرات" },
    style: "wave",
    go: { en: "Start", ar: "ابدأ" },
    Art: LectureArt,
  },
  todo: {
    tone: "todo",
    logo: { en: "To-do", ar: "مهامي" },
    style: "check",
    go: { en: "Plan", ar: "خطّط" },
    Art: TodoArt,
  },
  exams: {
    tone: "exams",
    logo: { en: "Exams", ar: "الامتحانات" },
    style: "stamp",
    go: { en: "Open", ar: "افتح" },
    Art: ExamsArt,
  },
  "shared-decks": {
    tone: "shared",
    logo: { en: "Shared Decks", ar: "بطاقات مشتركة" },
    style: "linked",
    go: { en: "Browse", ar: "تصفّح" },
    Art: SharedArt,
  },
  spaces: {
    tone: "spaces",
    logo: { en: "Classrooms", ar: "الصفوف" },
    style: "retro",
    go: { en: "Join", ar: "ادخل" },
    Art: SpacesArt,
  },
  "german-lab": {
    tone: "german",
    logo: { en: "Deutsch Lab", ar: "مختبر الألمانية" },
    style: "flag",
    go: { en: "Play", ar: "العب" },
    Art: GermanArt,
  },
};

export function lookFor(key: string, name: Bi): Look {
  return (
    LOOKS[key] ?? {
      tone: "cards",
      logo: name,
      style: "bold",
      go: { en: "Open", ar: "افتح" },
      Art: FlashcardsArt,
    }
  );
}
