/**
 * One-off sample content so a brand-new student sees a working example in
 * every local study mode before creating anything. Runs once per browser,
 * never overwrites data the student already has, and everything it writes can
 * be deleted from the normal UI.
 */

import { topicKey, type FlashCardItem } from "@/lib/use-flashcards";
import { questionKey, type StudyQuestion } from "@/lib/use-study-questions";
import { memoryKey, type MemoryPair } from "@/lib/use-memory-pairs";
import { FLASHCARD_SUBJECTS_KEY, QUESTION_SUBJECTS_KEY } from "@/lib/use-study-subjects";

export const DEMO_FLAG = "rita_demo_seeded_v2";
export const MEMORY_SUBJECTS_KEY = "rita_memory_subjects";
const TODO_TASKS_KEY = "rita_todo_tasks";

export const SAMPLE_SUBJECT = "Sample subject — Cardiology";
export const SAMPLE_SUB_A = "Sample · Myocardial infarction";
export const SAMPLE_SUB_B = "Sample · Heart failure";

const id = (n: number) => `demo-${n}-${Math.random().toString(36).slice(2, 7)}`;

/* ------------------------------------------------------------ flashcards */

const CARDS_A: [string, string][] = [
  ["Most common cause of myocardial infarction?", "Rupture of an atherosclerotic plaque with thrombus formation."],
  ["First ECG change in a STEMI?", "Hyperacute (tall, peaked) T waves, then ST elevation."],
  ["Most specific cardiac biomarker?", "Cardiac troponin I / T."],
  ["When does troponin rise after infarction?", "Within 3–4 hours; it peaks at 24–48 h and stays raised up to 10 days."],
  ["Artery behind an inferior STEMI (II, III, aVF)?", "The right coronary artery in about 80% of people."],
  ["First drug given in suspected acute coronary syndrome?", "Aspirin 300 mg, chewed."],
];

const CARDS_B: [string, string][] = [
  ["Definition of heart failure with reduced ejection fraction?", "Symptomatic heart failure with an ejection fraction of 40% or less."],
  ["Best blood test to rule out heart failure?", "BNP / NT-proBNP — a normal value makes heart failure very unlikely."],
  ["Classic chest X-ray signs of pulmonary oedema?", "Kerley B lines, upper-lobe diversion, bat-wing opacity, pleural effusion."],
  ["Four drug classes that improve survival in HFrEF?", "ACE inhibitor/ARNI, beta blocker, MRA, SGLT2 inhibitor."],
];

function toCards(pairs: [string, string][]): FlashCardItem[] {
  return pairs.map(([front, back], i) => ({
    id: id(i),
    front,
    back,
    frontStyle: { size: "m", bold: true, align: "center" },
    backStyle: { size: "m", align: "center" },
  }));
}

/* --------------------------------------------------------------- questions */

const QUESTIONS: StudyQuestion[] = [
  {
    id: id(101),
    stem: "A 58-year-old man has 40 minutes of crushing central chest pain radiating to the left arm, with sweating and nausea. ECG shows 3 mm ST elevation in leads II, III and aVF. Which artery is most likely occluded?",
    options: [
      { letter: "A", body: "Left anterior descending artery", is_correct: false, wrong_reason: "The LAD supplies the anterior wall and septum, so occlusion gives ST elevation in V1–V4, not in the inferior leads." },
      { letter: "B", body: "Right coronary artery", is_correct: true, wrong_reason: "" },
      { letter: "C", body: "Left circumflex artery", is_correct: false, wrong_reason: "The circumflex supplies the lateral wall (I, aVL, V5–V6). It causes inferior changes only in the 15–20% of people with a left-dominant circulation, which is not the default answer." },
      { letter: "D", body: "Left main stem", is_correct: false, wrong_reason: "Left main occlusion causes widespread ST depression with aVR elevation and profound shock, not isolated inferior elevation." },
    ],
    correct_explanation:
      "Concept — In a STEMI the ECG lead group that shows ST elevation maps directly onto the wall of the heart that is losing its blood supply, and each wall has a dominant supplying artery. Leads II, III and aVF look at the inferior wall, which in roughly 80% of people is supplied by the right coronary artery (right-dominant circulation).\n\nWhy this answer is right — Inferior ST elevation (II, III, aVF) with a typical ischaemic history is the textbook picture of an acute right coronary artery occlusion. Supporting clues you would look for: ST elevation taller in III than in II, reciprocal ST depression in I and aVL, and bradycardia or heart block because the RCA usually feeds the SA and AV nodes. Right-sided leads (V4R) may show elevation if the right ventricle is involved, which matters because those patients are preload-dependent and can crash with nitrates.\n\nWhy the others are wrong — LAD occlusion gives anterior/septal elevation (V1–V4) and often a bigger drop in ejection fraction. Circumflex occlusion gives lateral changes (I, aVL, V5–V6) and is the inferior culprit only in a left-dominant heart. Left main occlusion presents with diffuse ST depression, aVR elevation and cardiogenic shock.\n\nSummary — Inferior leads (II, III, aVF) → inferior wall → right coronary artery in most patients; check for bradyarrhythmia and right ventricular involvement before giving nitrates.",
    reference_note: "Sample question — delete it any time.",
  },
  {
    id: id(102),
    stem: "Which biomarker is the most sensitive and specific for myocardial necrosis 6 hours after the onset of chest pain?",
    options: [
      { letter: "A", body: "Cardiac troponin I", is_correct: true, wrong_reason: "" },
      { letter: "B", body: "Creatine kinase MB", is_correct: false, wrong_reason: "CK-MB is useful but less specific — it is also released by skeletal muscle — and it is mainly kept for detecting re-infarction because it clears within 48–72 h." },
      { letter: "C", body: "Myoglobin", is_correct: false, wrong_reason: "Myoglobin rises earliest (1–2 h) but is released by any muscle damage, so it is far too non-specific to confirm infarction." },
      { letter: "D", body: "Lactate dehydrogenase", is_correct: false, wrong_reason: "LDH is a late, non-specific marker of general tissue breakdown and has no place in modern ACS pathways." },
    ],
    correct_explanation:
      "Concept — Necrotic myocytes leak structural proteins into the blood; the diagnostic value of each protein depends on how exclusive it is to heart muscle and how fast it appears.\n\nWhy this answer is right — Cardiac troponin I (and T) are isoforms found essentially only in cardiac myocytes. They start rising 3–4 hours after injury, so by 6 hours a high-sensitivity assay is both sensitive and specific, and the rise-and-fall pattern on serial sampling confirms an acute event.\n\nWhy the others are wrong — CK-MB overlaps with skeletal muscle and is now reserved for suspected re-infarction. Myoglobin is fast but shared by all muscle. LDH is late and non-specific.\n\nSummary — Six hours in, troponin is the test; use serial values to show the rise and fall.",
    reference_note: "Sample question — delete it any time.",
  },
  {
    id: id(103),
    stem: "A patient with an anterior STEMI is 90 minutes from a cath lab that can perform primary PCI. What is the best reperfusion strategy?",
    options: [
      { letter: "A", body: "Immediate transfer for primary PCI", is_correct: true, wrong_reason: "" },
      { letter: "B", body: "Fibrinolysis now, no transfer", is_correct: false, wrong_reason: "Fibrinolysis is the fallback when PCI cannot be delivered within about 120 minutes; here PCI is reachable in time and is more effective with fewer strokes." },
      { letter: "C", body: "Heparin and admit for an angiogram in 72 hours", is_correct: false, wrong_reason: "A delayed strategy is for stabilised NSTEMI, not for an occluded artery in an evolving STEMI where muscle is dying every minute." },
      { letter: "D", body: "Exercise stress test to confirm ischaemia", is_correct: false, wrong_reason: "Stress testing is contraindicated in an acute STEMI and would dangerously delay reperfusion." },
    ],
    correct_explanation:
      "Concept — STEMI is a totally occluded epicardial artery: the whole treatment is to open it as fast as possible, and the choice between PCI and lysis is decided by the expected delay.\n\nWhy this answer is right — Guidelines favour primary PCI whenever the first-medical-contact-to-balloon time can be kept under roughly 120 minutes. At 90 minutes the patient is inside that window, and PCI restores flow more reliably than lysis with a much lower intracranial bleed risk.\n\nWhy the others are wrong — Lysis is only preferred outside the window; a 72-hour plan abandons salvageable myocardium; stress testing is unsafe and irrelevant here.\n\nSummary — PCI within ~120 minutes wins; fibrinolysis only when it does not.",
    reference_note: "Sample question — delete it any time.",
  },
  {
    id: id(104),
    stem: "Which finding best distinguishes acute pericarditis from a STEMI on the ECG?",
    options: [
      { letter: "A", body: "Widespread concave ST elevation with PR depression", is_correct: true, wrong_reason: "" },
      { letter: "B", body: "Reciprocal ST depression in the opposite leads", is_correct: false, wrong_reason: "Reciprocal change is a hallmark of STEMI, not of pericarditis (aVR is the only exception)." },
      { letter: "C", body: "Pathological Q waves", is_correct: false, wrong_reason: "Q waves signal established transmural necrosis and do not occur in pericarditis." },
      { letter: "D", body: "New left bundle branch block", is_correct: false, wrong_reason: "New LBBB with typical pain is treated as a STEMI equivalent, not as pericarditis." },
    ],
    correct_explanation:
      "Concept — Pericardial inflammation irritates the whole epicardial surface, so its ECG changes are diffuse; a STEMI reflects one blocked artery, so its changes are territorial.\n\nWhy this answer is right — Concave (saddle-shaped) ST elevation across many unrelated territories, with PR-segment depression from atrial involvement and no reciprocal change, is the classic pericarditis pattern.\n\nWhy the others are wrong — Reciprocal depression, Q waves and new LBBB all point towards infarction.\n\nSummary — Diffuse concave elevation + PR depression = pericarditis; territorial convex elevation + reciprocal depression = STEMI.",
    reference_note: "Sample question — delete it any time.",
  },
  {
    id: id(105),
    stem: "Which drug class has been shown to reduce mortality in heart failure with reduced ejection fraction?",
    options: [
      { letter: "A", body: "Loop diuretics", is_correct: false, wrong_reason: "Loop diuretics relieve congestion and make patients feel better, but no trial has shown they extend life." },
      { letter: "B", body: "Beta blockers", is_correct: true, wrong_reason: "" },
      { letter: "C", body: "Calcium channel blockers", is_correct: false, wrong_reason: "Non-dihydropyridines are negatively inotropic and can worsen HFrEF; none improve survival." },
      { letter: "D", body: "Digoxin", is_correct: false, wrong_reason: "Digoxin reduces hospital admissions but is mortality-neutral." },
    ],
    correct_explanation:
      "Concept — Survival in HFrEF comes from blocking the chronic neurohormonal overdrive (sympathetic and renin–angiotensin–aldosterone activation) that remodels the ventricle, not from removing fluid.\n\nWhy this answer is right — Bisoprolol, carvedilol and metoprolol succinate all showed clear mortality reduction (CIBIS-II, COPERNICUS, MERIT-HF) by blunting sympathetic drive and reversing remodelling. They sit alongside ACE inhibitors/ARNI, MRAs and SGLT2 inhibitors as the four pillars of therapy.\n\nWhy the others are wrong — Diuretics treat symptoms, calcium channel blockers can harm, digoxin only cuts admissions.\n\nSummary — Symptoms: diuretics. Survival: beta blocker + ACEi/ARNI + MRA + SGLT2 inhibitor.",
    reference_note: "Sample question — delete it any time.",
  },
];

/* ------------------------------------------------------------------ pairs */

const PAIRS: [string, string][] = [
  ["Troponin I", "Most specific marker of myocardial necrosis"],
  ["BNP", "Rules out heart failure when normal"],
  ["Leads II, III, aVF", "Inferior wall"],
  ["Leads V1–V4", "Anterior wall"],
  ["Aspirin", "First drug in suspected ACS"],
  ["SGLT2 inhibitor", "Survival pillar in HFrEF"],
];

/* ------------------------------------------------------------------- todo */

const isoDay = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return z.toISOString().slice(0, 10);
};

/* ------------------------------------------------------------------- seed */

function empty(key: string) {
  const raw = window.localStorage.getItem(key);
  if (!raw) return true;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length === 0 : !parsed;
  } catch {
    return true;
  }
}

function put(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export const SAMPLE_CARDS_A = toCards(CARDS_A);
export const SAMPLE_CARDS_B = toCards(CARDS_B);
export const ALL_SAMPLE_CARDS: FlashCardItem[] = [...toCards(CARDS_A), ...toCards(CARDS_B)];

/** Ensures the sample cardiology flashcards and subject exist in localStorage if the user has 0 subjects. */
export function ensureSampleFlashcards() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(FLASHCARD_SUBJECTS_KEY);
    let hasValidSubjects = false;
    if (raw) {
      const parsed = JSON.parse(raw);
      hasValidSubjects = Array.isArray(parsed) && parsed.length > 0;
    }

    if (!hasValidSubjects) {
      const board = [
        { name: SAMPLE_SUBJECT, subs: [{ name: SAMPLE_SUB_A }, { name: SAMPLE_SUB_B }] },
      ];
      put(FLASHCARD_SUBJECTS_KEY, board);
      put(topicKey(SAMPLE_SUBJECT, SAMPLE_SUB_A), toCards(CARDS_A));
      put(topicKey(SAMPLE_SUBJECT, SAMPLE_SUB_B), toCards(CARDS_B));
    }
  } catch {
    /* ignore */
  }
}

/** Seeds the sample content once. Safe to call on every page load. */
export function seedDemoContent() {
  if (typeof window === "undefined") return;
  try {
    // Always guarantee sample flashcards if the board is empty
    ensureSampleFlashcards();

    if (window.localStorage.getItem(DEMO_FLAG)) return;
    window.localStorage.setItem(DEMO_FLAG, new Date().toISOString());

    const board = [
      { name: SAMPLE_SUBJECT, subs: [{ name: SAMPLE_SUB_A }, { name: SAMPLE_SUB_B }] },
    ];

    if (empty(QUESTION_SUBJECTS_KEY)) {
      put(QUESTION_SUBJECTS_KEY, board);
      put(questionKey(SAMPLE_SUBJECT, SAMPLE_SUB_A), QUESTIONS);
    }

    if (empty(MEMORY_SUBJECTS_KEY)) {
      put(MEMORY_SUBJECTS_KEY, board);
      const pairs: MemoryPair[] = PAIRS.map(([left, right], i) => ({
        id: id(200 + i),
        left,
        right,
        misses: 0,
      }));
      put(memoryKey(SAMPLE_SUBJECT, SAMPLE_SUB_A), pairs);
    }

    if (empty(TODO_TASKS_KEY)) {
      put(TODO_TASKS_KEY, [
        {
          id: id(301),
          title: "Sample: read the cardiology sample cards",
          due: isoDay(0),
          priority: "important",
          stage: "todo",
          order: 0,
        },
        {
          id: id(302),
          title: "Sample: run a 5-question sample round",
          due: isoDay(2),
          priority: "low",
          stage: "todo",
          order: 1,
        },
        {
          id: id(303),
          title: "Sample: set up my own subject",
          done: true,
          completedAt: new Date().toISOString(),
          priority: "none",
          stage: "done",
          order: 2,
        },
      ]);
    }
  } catch {
    /* storage blocked — nothing to seed */
  }
}
