// Temporary design fixtures only. No model calls, storage or lesson progress.
export type PreviewLanguage = "ar" | "en";
type Text = Record<PreviewLanguage, string>;
export type PreviewQuestion = {
  id: string;
  question: Text;
  options: [string, string, string, string];
  answer: number;
  why: Text;
};

export const PREVIEW_QUESTIONS: PreviewQuestion[] = [
  {
    id: "watch",
    question: {
      en: "Choose the correct sentence in the simple present.",
      ar: "اختار الجملة الصحيحة بالمضارع البسيط.",
    },
    options: [
      "She watch TV every evening.",
      "She watches TV every evening.",
      "She watching TV every evening.",
      "She are watch TV every evening.",
    ],
    answer: 1,
    why: {
      en: "With she, add -es to watch because the verb ends in -ch.",
      ar: "مع she بنضيف -es للفعل watch، لأنه بينتهي بـ -ch.",
    },
  },
  {
    id: "study",
    question: {
      en: "Complete the sentence: Omar ___ English every day.",
      ar: "كمّل الجملة: Omar ___ English every day.",
    },
    options: ["study", "studying", "studies", "are study"],
    answer: 2,
    why: {
      en: "With a singular subject, a consonant + y changes to -ies: study becomes studies.",
      ar: "Omar مفرد. لما الفعل ينتهي بحرف ساكن وبعده y، بنحوّل y إلى -ies: study بتصير studies.",
    },
  },
  {
    id: "have",
    question: {
      en: "Complete the sentence: My sister ___ two notebooks.",
      ar: "كمّل الجملة: My sister ___ two notebooks.",
    },
    options: ["have", "haves", "having", "has"],
    answer: 3,
    why: {
      en: "Have is irregular. With he, she or it, use has.",
      ar: "الفعل have استثناء. مع he أو she أو it بنستخدم has.",
    },
  },
  {
    id: "play",
    question: {
      en: "Choose the correct form: He ___ football on Fridays.",
      ar: "اختار الصيغة الصحيحة: He ___ football on Fridays.",
    },
    options: ["plays", "playes", "play", "are playing"],
    answer: 0,
    why: {
      en: "A vowel before y means we keep the y and add -s: play becomes plays.",
      ar: "قبل y في play حرف علة، فبنخلي y وبنضيف -s بس: plays.",
    },
  },
  {
    id: "go",
    question: {
      en: "Complete the sentence: Lina ___ to school by bus.",
      ar: "كمّل الجملة: Lina ___ to school by bus.",
    },
    options: ["go", "goes", "going", "are go"],
    answer: 1,
    why: {
      en: "With a singular subject, go takes -es: Lina goes to school.",
      ar: "Lina مفرد، والفعل go معها بصير goes.",
    },
  },
  {
    id: "plural",
    question: {
      en: "Choose the correct sentence about a plural subject.",
      ar: "اختار الجملة الصحيحة مع فاعل جمع.",
    },
    options: [
      "They works in Amman.",
      "They workes in Amman.",
      "They work in Amman.",
      "They is work in Amman.",
    ],
    answer: 2,
    why: {
      en: "With they, use the base form work. Do not add -s or -es.",
      ar: "مع they بنستخدم الفعل الأساسي work، بدون -s أو -es.",
    },
  },
];

export type PreviewAttempt = { choice: number | null; submitted: boolean; flagged: boolean };
export type PreviewState = {
  questions: PreviewQuestion[];
  attempts: PreviewAttempt[];
  current: number;
};
export type PreviewAction =
  | { type: "choose"; choice: number }
  | { type: "submit" }
  | { type: "go"; index: number }
  | { type: "flag" };

export function createPreview(random = Math.random): PreviewState {
  const pool = [...PREVIEW_QUESTIONS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const questions = pool.slice(0, 3);
  return {
    questions,
    current: 0,
    attempts: questions.map(() => ({ choice: null, submitted: false, flagged: false })),
  };
}

export function previewReducer(state: PreviewState, action: PreviewAction): PreviewState {
  if (action.type === "go") {
    return Number.isInteger(action.index) &&
      action.index >= 0 &&
      action.index < state.questions.length
      ? { ...state, current: action.index }
      : state;
  }
  const attempt = state.attempts[state.current];
  let next = attempt;
  if (action.type === "flag") next = { ...attempt, flagged: !attempt.flagged };
  if (
    action.type === "choose" &&
    !attempt.submitted &&
    Number.isInteger(action.choice) &&
    action.choice >= 0 &&
    action.choice < 4
  )
    next = { ...attempt, choice: action.choice };
  if (action.type === "submit" && attempt.choice !== null && !attempt.submitted)
    next = { ...attempt, submitted: true };
  if (next === attempt) return state;
  return {
    ...state,
    attempts: state.attempts.map((item, i) => (i === state.current ? next : item)),
  };
}

export function previewResult(state: PreviewState) {
  const answered = state.attempts.filter((a) => a.submitted).length;
  const correct = state.attempts.filter(
    (a, i) => a.submitted && a.choice === state.questions[i].answer,
  ).length;
  return {
    answered,
    correct,
    accuracy: answered ? Math.round((correct / answered) * 100) : null,
    total: state.questions.length,
  };
}
