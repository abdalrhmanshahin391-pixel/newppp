// Three guides written by hand, in the new look: they show every block type, are used by the
// tests, and become the sample PDFs the owner reviews. The wording and examples are ours.
// They are drafts: the grammar must be checked by a teacher before any guide is approved.
import { GuideContentSchema, type GuideContent } from "./guide-content.ts";

export const SAMPLE_PRESENT_SIMPLE: GuideContent = GuideContentSchema.parse({
  title: "Present simple",
  intro:
    "We use the [[present simple]] for things that are true in general, for habits and routines, and for timetables.",
  sections: [
    {
      kind: "table",
      heading: "Form",
      columns: [
        { label: "Pronouns", tone: "neutral" },
        { label: "Positive", tone: "positive" },
        { label: "Negative", tone: "negative" },
        { label: "Question", tone: "question" },
      ],
      rows: [
        ["I / you / we / they", "work", "do not (don't) work", "Do I / you / we / they work?"],
        ["he / she / it", "works", "does not (doesn't) work", "Does he / she / it work?"],
      ],
    },
    {
      kind: "usage",
      heading: "Usage",
      items: [
        { label: "Habits", example: "I {{drink}} tea every morning." },
        { label: "Facts", example: "The shop {{opens}} at nine." },
        { label: "Timetables", example: "The train {{leaves}} at 6:15." },
      ],
    },
  ],
  callout:
    "Remember: after he, she or it, the verb takes {{-s}} or {{-es}}. In questions and negatives, does takes the -s, so the verb stays plain.",
  arabic_note:
    "نستخدم المضارع البسيط للعادات والحقائق والجداول الزمنية. مع he / she / it نضيف -s أو -es للفعل.",
});

export const SAMPLE_THIRD_PERSON: GuideContent = GuideContentSchema.parse({
  title: "Third person -s and -es",
  intro:
    "With [[he, she and it]], the present simple verb changes its ending. The ending depends on the last letters of the verb.",
  sections: [
    {
      kind: "table",
      heading: "Spelling rules",
      row_headers: true,
      columns: [
        { label: "The verb ends in", tone: "neutral" },
        { label: "What you do", tone: "positive" },
        { label: "Example", tone: "question" },
      ],
      rows: [
        ["most verbs", "add {{-s}}", "//work → work{{s}}, play → play{{s}}//"],
        ["s, ss, sh, ch, x, z", "add {{-es}}", "//pass → pass{{es}}, watch → watch{{es}}//"],
        ["o", "add {{-es}}", "//go → go{{es}}, do → do{{es}}//"],
        ["consonant + y", "y → i, add {{-es}}", "//study → stud{{ies}}, try → tr{{ies}}//"],
        ["vowel + y", "add {{-s}}", "//enjoy → enjoy{{s}}, stay → stay{{s}}//"],
      ],
    },
    {
      kind: "usage",
      heading: "Watch out",
      items: [
        { label: "", example: "One verb is irregular: have → {{has}} (not haves)." },
        { label: "", example: "She {{studies}} at night and {{watches}} a film on Fridays." },
      ],
    },
  ],
  callout:
    "Quick check: if the verb ends with a hissing sound (s, sh, ch, x, z), you will almost always need {{-es}}.",
  arabic_note:
    "مع he / she / it نضيف -s لمعظم الأفعال، و-es إذا انتهى الفعل بـ s, sh, ch, x, z, o. وإذا انتهى بحرف ساكن + y نغيّر y إلى ies.",
});

export const SAMPLE_TENSES: GuideContent = GuideContentSchema.parse({
  title: "English tenses",
  intro:
    "Every tense answers two questions: [[when]] does the action happen, and [[what shape]] is it? Here is the whole system for the verb work.",
  sections: [
    {
      kind: "matrix",
      heading: "The 12 tenses",
      columns: ["Simple", "Continuous", "Perfect", "Perfect continuous"],
      rows: [
        {
          label: "Past",
          cells: ["I worked", "I was working", "I had worked", "I had been working"],
        },
        {
          label: "Present",
          cells: ["I work", "I am working", "I have worked", "I have been working"],
        },
        {
          label: "Future",
          cells: [
            "I will work",
            "I will be working",
            "I will have worked",
            "I will have been working",
          ],
        },
      ],
    },
    {
      kind: "usage",
      heading: "How to read it",
      items: [
        {
          label: "",
          example:
            "{{Simple}} names the fact. {{Continuous}} shows the action in progress (be + {{-ing}}).",
        },
        {
          label: "",
          example:
            "{{Perfect}} links two moments (have + past participle). {{Perfect continuous}} joins both ideas.",
        },
      ],
    },
  ],
  callout:
    "Start with the three simple tenses. Add -ing next, then have / had. Each step reuses the one before.",
  arabic_note:
    "كل زمن يجاوب على سؤالين: {{متى}} صار الفعل (ماضي / حاضر / مستقبل)، و{{كيف}} هو شكله (بسيط / مستمر / تام / تام مستمر).",
});

export const SAMPLE_GUIDES: { slug: string; content: GuideContent }[] = [
  { slug: "present-simple", content: SAMPLE_PRESENT_SIMPLE },
  { slug: "third-person-s-es", content: SAMPLE_THIRD_PERSON },
  { slug: "english-tenses", content: SAMPLE_TENSES },
];
