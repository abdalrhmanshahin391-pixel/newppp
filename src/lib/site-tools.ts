import {
  BookOpen,
  Brain,
  CalendarDays,
  CheckSquare,
  FileText,
  Languages,
  Layers,
  ListChecks,
  Share2,
  Sparkles,
  Users,
  Wand2,
  type LucideIcon,
} from "lucide-react";

import flashcardsArt from "@/assets/mode-flashcards.jpg";
import summaryArt from "@/assets/mode-summary.jpg";
import todoArt from "@/assets/mode-todo.jpg";
import memoryArt from "@/assets/mode-memory.jpg";
import germanArt from "@/assets/mode-german.jpg";
import shareArt from "@/assets/mode-share.jpg";
import spacesArt from "@/assets/mode-spaces.jpg";
import examsArt from "@/assets/mode-exams.jpg";
import allInOneArt from "@/assets/mode-allinone.jpg";
import ritaArt from "@/assets/mode-ritaai.jpg";
import qbankArt from "@/assets/mode-qbank.jpg";
import lectureArt from "@/assets/mode-lecturelab.jpg";

/**
 * One catalog for every study tool on RitaJet.
 *
 * Everything that lists tools reads from here: the three doors on /learn, the
 * three section pages, the header Study menu, the /tour tutorials, the
 * "How it works" button inside a tool and the admin on/off switches.
 */

export type Bi = { en: string; ar: string };

export type DemoKind =
  | "cards"
  | "match"
  | "summary"
  | "todo"
  | "calendar"
  | "timer"
  | "allinone"
  | "qbank"
  | "lecture"
  | "share"
  | "spaces"
  | "german";

export type ToolDef = {
  key: string;
  section: SectionId;
  column: "no-ai" | "ai" | "together" | "german";
  to: string;
  params?: Record<string, string>;
  href: string;
  icon: LucideIcon;
  image?: string;
  soft: string;
  ink: string;
  name: Bi;
  tag: Bi;
  line: Bi;
  cta: Bi;
  demo: DemoKind;
  steps: Bi[];
  sample?: boolean;
};

export type SectionId = "study-space" | "study-room" | "german";

export type SectionDef = {
  key: SectionId;
  to: "/learn/study-space" | "/learn/study-room" | "/learn/german";
  title: Bi;
  intro: Bi;
  tint: string;
  ink: string;
  icon: LucideIcon;
  columns: { id: ToolDef["column"]; label: Bi; note: Bi }[];
};

export const SECTIONS: SectionDef[] = [
  {
    key: "study-space",
    to: "/learn/study-space",
    title: { en: "My Study Space", ar: "مساحتي الدراسية" },
    intro: {
      en: "Everything that belongs to you alone — your cards, your plan and your AI tools.",
      ar: "كل ما يخصك وحدك — بطاقاتك وخطتك وأدوات الذكاء الاصطناعي.",
    },
    tint: "#fdf1de",
    ink: "#7a4b16",
    icon: Layers,
    columns: [
      {
        id: "no-ai",
        label: { en: "Without AI", ar: "بدون ذكاء اصطناعي" },
        note: { en: "You build it, you own it.", ar: "أنت تبنيها وأنت تملكها." },
      },
      {
        id: "ai",
        label: { en: "With AI", ar: "مع الذكاء الاصطناعي" },
        note: { en: "Rita does the heavy lifting.", ar: "ريتا تقوم بالعمل الشاق." },
      },
    ],
  },
  {
    key: "study-room",
    to: "/learn/study-room",
    title: { en: "Study Room", ar: "غرفة الدراسة" },
    intro: {
      en: "Study with your class, your group and the rest of RitaJet.",
      ar: "ادرس مع صفك ومجموعتك وبقية طلاب ريتاجت.",
    },
    tint: "#eef6ea",
    ink: "#3d5c14",
    icon: Users,
    columns: [
      {
        id: "together",
        label: { en: "Study together", ar: "الدراسة الجماعية" },
        note: { en: "Share decks and join your classroom.", ar: "شارك المجموعات وانضم لصفك." },
      },
    ],
  },
  {
    key: "german",
    to: "/learn/german",
    title: { en: "German", ar: "الألمانية" },
    intro: {
      en: "All the German study tools, feeding from one shared shelf of words.",
      ar: "كل أدوات تعلم الألمانية تعمل على رفٍّ واحد من الكلمات.",
    },
    tint: "#eef2fb",
    ink: "#12315e",
    icon: Languages,
    columns: [
      {
        id: "german",
        label: { en: "German study tools", ar: "أدوات الألمانية" },
        note: {
          en: "Articles, pronunciation and sentence building.",
          ar: "الأدوات: التعريف، اللفظ، وبناء الجمل.",
        },
      },
    ],
  },
];

export const TOOLS: ToolDef[] = [
  {
    key: "flashcards",
    section: "study-space",
    column: "no-ai",
    to: "/study",
    href: "/study",
    icon: Layers,
    image: flashcardsArt,
    soft: "#fbe3c8",
    ink: "#7a4b16",
    name: { en: "My flashcards", ar: "بطاقاتي" },
    tag: { en: "Active recall", ar: "استرجاع نشط" },
    line: {
      en: "Build subjects, fill them with cards and study the combo you pick.",
      ar: "أنشئ المواد، املأها ببطاقات، وادرس ما تختاره منها.",
    },
    cta: { en: "Open flashcards", ar: "افتح البطاقات" },
    demo: "cards",
    sample: true,
    steps: [
      {
        en: "Create a subject, then a sub-subject inside it — this is your shelf.",
        ar: "أنشئ مادة ثم مادة فرعية داخلها — هذا هو رفّك.",
      },
      {
        en: "Add cards: the question on the front, the answer on the back.",
        ar: "أضف بطاقات: السؤال في الأمام والجواب في الخلف.",
      },
      {
        en: "Press study and flip each card, then say if you knew it or not.",
        ar: "اضغط ادرس واقلب كل بطاقة، ثم حدد إن كنت تعرفها أم لا.",
      },
      {
        en: "Smart Review brings back the cards you missed at the right time.",
        ar: "المراجعة الذكية تعيد البطاقات التي نسيتها في الوقت المناسب.",
      },
    ],
  },
  {
    key: "memory-lab",
    section: "study-space",
    column: "no-ai",
    to: "/study/match",
    href: "/study/match",
    icon: Brain,
    image: memoryArt,
    soft: "#f6ddd5",
    ink: "#7d3421",
    name: { en: "My memory lab", ar: "مختبر الذاكرة" },
    tag: { en: "Matching games", ar: "ألعاب المطابقة" },
    line: {
      en: "Pair up the facts that won't stick and play match, speed or recall.",
      ar: "اربط المعلومات الصعبة والعب المطابقة أو السرعة أو الاسترجاع.",
    },
    cta: { en: "Open Memory Lab", ar: "افتح مختبر الذاكرة" },
    demo: "match",
    sample: true,
    steps: [
      { en: "Pick the subject you want to play with.", ar: "اختر المادة التي تريد اللعب بها." },
      { en: "Choose a game: match, speed round or recall.", ar: "اختر لعبة: مطابقة، سرعة، أو استرجاع." },
      { en: "Tap the two halves that belong together.", ar: "اضغط على الجزئين المتطابقين." },
      { en: "Your score shows which pairs still need work.", ar: "نتيجتك تُظهر الأزواج التي تحتاج تدريبًا." },
    ],
  },
  {
    key: "pdf-summary",
    section: "study-space",
    column: "no-ai",
    to: "/study/pdf",
    href: "/study/pdf",
    icon: FileText,
    image: summaryArt,
    soft: "#e4dcf3",
    ink: "#4a3877",
    name: { en: "PDF summary", ar: "ملخص PDF" },
    tag: { en: "One-page sheets", ar: "ورقة واحدة" },
    line: {
      en: "Turn a lecture PDF into a clean, printable summary sheet.",
      ar: "حوّل محاضرة PDF إلى ورقة ملخص نظيفة قابلة للطباعة.",
    },
    cta: { en: "Create summary", ar: "أنشئ ملخصًا" },
    demo: "summary",
    steps: [
      { en: "Upload the lecture PDF or paste your notes.", ar: "ارفع ملف المحاضرة أو الصق ملاحظاتك." },
      { en: "Choose how short the summary should be.", ar: "اختر طول الملخص المطلوب." },
      { en: "Read the sheet, edit any line you want.", ar: "اقرأ الورقة وعدّل أي سطر تريده." },
      { en: "Save it to your summaries or print it.", ar: "احفظها في ملخصاتك أو اطبعها." },
    ],
  },
  {
    key: "todo",
    section: "study-space",
    column: "no-ai",
    to: "/study/todo",
    href: "/study/todo",
    icon: CheckSquare,
    image: todoArt,
    soft: "#d8ecdd",
    ink: "#215237",
    name: { en: "To-do list", ar: "قائمة المهام" },
    tag: { en: "Study planner", ar: "مخطط الدراسة" },
    line: {
      en: "Plan the day, set priorities and keep your revision streak alive.",
      ar: "خطّط يومك، رتّب الأولويات، وحافظ على سلسلة مراجعتك.",
    },
    cta: { en: "Open to-do list", ar: "افتح المهام" },
    demo: "todo",
    sample: true,
    steps: [
      { en: "Write a task and give it a day.", ar: "اكتب مهمة وحدد لها يومًا." },
      { en: "Star what matters most today.", ar: "ضع نجمة على الأهم اليوم." },
      { en: "Tick it off when it's done.", ar: "علّم عليها عند الانتهاء." },
      { en: "Select several tasks to move or delete them at once.", ar: "حدد عدة مهام لنقلها أو حذفها معًا." },
    ],
  },
  {
    key: "exams",
    section: "study-space",
    column: "no-ai",
    to: "/study/exams",
    href: "/study/exams",
    icon: CalendarDays,
    image: examsArt,
    soft: "#e6f0d8",
    ink: "#2f6318",
    name: { en: "Exam schedule", ar: "جدول الامتحانات" },
    tag: { en: "Month calendar", ar: "تقويم شهري" },
    line: {
      en: "Drop every exam onto a clean month calendar and see what is next.",
      ar: "ضع كل امتحان على تقويم شهري واضح واعرف ما القادم.",
    },
    cta: { en: "Open exam schedule", ar: "افتح الجدول" },
    demo: "calendar",
    steps: [
      { en: "Add an exam with its subject and date.", ar: "أضف امتحانًا مع المادة والتاريخ." },
      { en: "The calendar shows the countdown for each one.", ar: "التقويم يعرض العد التنازلي لكل امتحان." },
      { en: "Open a day to see everything planned for it.", ar: "افتح يومًا لرؤية كل ما فيه." },
    ],
  },
  {
    key: "all-in-one",
    section: "study-space",
    column: "ai",
    to: "/study/all-in-one",
    href: "/study/all-in-one",
    icon: Wand2,
    image: allInOneArt,
    soft: "#e7dcf7",
    ink: "#3f2c73",
    name: { en: "All in one Rita AI", ar: "ريتا الشاملة" },
    tag: { en: "One upload · everything", ar: "رفع واحد · كل شيء" },
    line: {
      en: "Upload one lecture and get the study guide, summary, flashcards and questions together.",
      ar: "ارفع محاضرة واحدة واحصل على الدليل والملخص والبطاقات والأسئلة معًا.",
    },
    cta: { en: "Open All in one", ar: "افتح الشاملة" },
    demo: "allinone",
    steps: [
      { en: "Upload the lecture PDF.", ar: "ارفع ملف المحاضرة." },
      { en: "Pick what you want: summary, cards, questions.", ar: "اختر ما تريد: ملخص، بطاقات، أسئلة." },
      { en: "Wait for Rita to finish — it runs in one pass.", ar: "انتظر ريتا لتنتهي — كل شيء بمرة واحدة." },
      { en: "Everything lands in your own study space.", ar: "كل شيء يُحفظ في مساحتك الدراسية." },
    ],
  },
  {
    key: "question-bank",
    section: "study-space",
    column: "ai",
    to: "/courses/$courseId",
    params: { courseId: "question-bank" },
    href: "/courses/question-bank",
    icon: ListChecks,
    image: qbankArt,
    soft: "#d9ecf7",
    ink: "#1d4d6b",
    name: { en: "Question bank", ar: "بنك الأسئلة" },
    tag: { en: "Study · session · exam", ar: "دراسة · جلسة · امتحان" },
    line: {
      en: "Pick a subject, choose sub-subjects and run a session with full explanations.",
      ar: "اختر مادة وموادها الفرعية وابدأ جلسة مع شرح كامل.",
    },
    cta: { en: "Open question bank", ar: "افتح بنك الأسئلة" },
    demo: "qbank",
    sample: true,
    steps: [
      { en: "Pick the subject you are revising.", ar: "اختر المادة التي تراجعها." },
      { en: "Tick the sub-subjects you want in the session.", ar: "حدد المواد الفرعية للجلسة." },
      { en: "Choose study mode or exam mode.", ar: "اختر وضع الدراسة أو الامتحان." },
      { en: "Read the explanation after every answer.", ar: "اقرأ الشرح بعد كل جواب." },
    ],
  },
  {
    key: "lecture-lab",
    section: "study-space",
    column: "ai",
    to: "/study/lectures",
    href: "/study/lectures",
    icon: BookOpen,
    image: lectureArt,
    soft: "#e6f0d8",
    ink: "#2f6318",
    name: { en: "Lecture Lab", ar: "مختبر المحاضرات" },
    tag: { en: "Lecture → quiz", ar: "محاضرة ← اختبار" },
    line: {
      en: "Drop today's lecture in and get short questions with two-line notes.",
      ar: "ارفع محاضرة اليوم واحصل على أسئلة قصيرة مع ملاحظات مختصرة.",
    },
    cta: { en: "Open Lecture Lab", ar: "افتح المختبر" },
    demo: "lecture",
    sample: true,
    steps: [
      { en: "Create a subject, then a sub-subject for the lecture.", ar: "أنشئ مادة ثم مادة فرعية للمحاضرة." },
      { en: "Upload the lecture file — your plan must allow it.", ar: "ارفع ملف المحاضرة — يجب أن تسمح خطتك بذلك." },
      { en: "Rita writes the questions with short notes.", ar: "تكتب ريتا الأسئلة مع ملاحظات قصيرة." },
      { en: "Run the quiz whenever you revise.", ar: "شغّل الاختبار عند كل مراجعة." },
    ],
  },
  {
    key: "shared-decks",
    section: "study-room",
    column: "together",
    to: "/share",
    href: "/share",
    icon: Share2,
    image: shareArt,
    soft: "#e6f4d8",
    ink: "#3d5c14",
    name: { en: "Shared flashcards", ar: "بطاقات مشتركة" },
    tag: { en: "Community decks", ar: "مجموعات الطلاب" },
    line: {
      en: "Publish your decks and save the ones other students made.",
      ar: "انشر مجموعاتك واحفظ ما نشره غيرك.",
    },
    cta: { en: "Browse shared decks", ar: "استعرض المشترك" },
    demo: "share",
    steps: [
      { en: "Open a deck you own and press share.", ar: "افتح مجموعة تملكها واضغط شارك." },
      { en: "Choose everyone, or only one classroom.", ar: "اختر الجميع أو صفًا واحدًا فقط." },
      { en: "Save any deck you like into your own subjects.", ar: "احفظ أي مجموعة تعجبك في موادك." },
      { en: "You can unshare or delete your deck at any time.", ar: "يمكنك إلغاء المشاركة أو الحذف في أي وقت." },
    ],
  },
  {
    key: "spaces",
    section: "study-room",
    column: "together",
    to: "/spaces",
    href: "/spaces",
    icon: Users,
    image: spacesArt,
    soft: "#f3e8ff",
    ink: "#4a3877",
    name: { en: "Classrooms & groups", ar: "الصفوف والمجموعات" },
    tag: { en: "Study together", ar: "دراسة جماعية" },
    line: {
      en: "Shared deck folders, members and announcements in one place.",
      ar: "مجلدات مشتركة وأعضاء وإعلانات في مكان واحد.",
    },
    cta: { en: "Open my spaces", ar: "افتح مساحاتي" },
    demo: "spaces",
    steps: [
      { en: "Create a classroom or join one with its code.", ar: "أنشئ صفًا أو انضم بالرمز." },
      { en: "Add decks into folders so members find them.", ar: "أضف المجموعات في مجلدات ليجدها الأعضاء." },
      { en: "Post an announcement for everyone inside.", ar: "انشر إعلانًا لكل الأعضاء." },
      { en: "Owners can remove decks and members.", ar: "يمكن للمالك إزالة المجموعات والأعضاء." },
    ],
  },
  {
    key: "german-lab",
    section: "german",
    column: "german",
    to: "/german",
    href: "/german",
    icon: Languages,
    image: germanArt,
    soft: "#dceafb",
    ink: "#12315e",
    name: { en: "German Lab", ar: "مختبر الألمانية" },
    tag: { en: "der · die · das", ar: "der · die · das" },
    line: {
      en: "One shared word shelf feeding article games, pronunciation coaching and sentence building.",
      ar: "رفّ كلمات واحد يغذّي ألعاب التعريف واللفظ وبناء الجمل.",
    },
    cta: { en: "Open German Lab", ar: "افتح المختبر" },
    demo: "german",
    sample: true,
    steps: [
      { en: "Save a word once with its article and meaning.", ar: "احفظ الكلمة مرة واحدة مع أداتها ومعناها." },
      { en: "The same word appears in all three German modes.", ar: "تظهر الكلمة نفسها في الأنماط الثلاثة." },
      { en: "Play der/die/das, practise the sound, build sentences.", ar: "العب der/die/das، تدرّب على اللفظ، ابنِ جملًا." },
      { en: "Words that a mode cannot use are skipped with a note.", ar: "الكلمات غير الصالحة لنمط تُستثنى مع ملاحظة." },
    ],
  },
];

export function toolsOf(section: SectionId) {
  return TOOLS.filter((t) => t.section === section);
}

export function sectionOf(key: SectionId) {
  return SECTIONS.find((s) => s.key === key)!;
}

export function toolByKey(key: string) {
  return TOOLS.find((t) => t.key === key);
}

/** Find the tool that owns the given pathname (longest matching route). */
export function toolForPath(pathname: string): ToolDef | undefined {
  let best: ToolDef | undefined;
  for (const t of TOOLS) {
    const base = t.href;
    if (pathname === base || pathname.startsWith(`${base}/`)) {
      if (!best || base.length > best.href.length) best = t;
    }
  }
  return best;
}

export const SECTION_FLAG = (key: SectionId) => `section.${key}`;
export const TOOL_FLAG = (key: string) => `tool.${key}`;
export const BYLINE_FLAG = "brand.byline";
