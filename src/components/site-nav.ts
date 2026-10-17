import {
  Sparkles,
  Users,
  Layers,
  FileText,
  ListChecks,
  CalendarDays,
  Languages,
  Brain,
  CheckSquare,
  BookOpen,
  Wand2,
  Share2,
} from "lucide-react";

export type NavItem = {
  to: string;
  params?: Record<string, string>;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ size?: number }>;
  soft: string;
  ink: string;
};

export type NavGroup = {
  id: string;
  label: string;
  columns: { label: string; items: NavItem[] }[];
};

/** Every study tool, grouped the way the three rooms are grouped. */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "space",
    label: "My Study Space",
    columns: [
      {
        label: "Without AI",
        items: [
          { to: "/study", label: "Flashcards", hint: "Active recall", icon: Layers, soft: "#f4f4f8", ink: "#1d5fd0" },
          { to: "/study/match", label: "Memory Lab", hint: "Matching games", icon: Brain, soft: "#fbd9e0", ink: "#961a34" },
          { to: "/study/pdf", label: "PDF summaries", hint: "One-page sheets", icon: FileText, soft: "#ffe6a3", ink: "#8a5200" },
          { to: "/study/todo", label: "To-do list", hint: "Study planner", icon: CheckSquare, soft: "#d2ecd4", ink: "#1d4f20" },
          { to: "/study/exams", label: "Exam schedule", hint: "Month calendar", icon: CalendarDays, soft: "#d2ecd4", ink: "#1d4f20" },
        ],
      },
      {
        label: "With AI",
        items: [
          { to: "/study/all-in-one", label: "All in one", hint: "One upload · everything", icon: Wand2, soft: "#f4f4f8", ink: "#1d5fd0" },
          { to: "/courses/$courseId", params: { courseId: "question-bank" }, label: "Question bank", hint: "Study · exam", icon: ListChecks, soft: "#f4f4f8", ink: "#1a4ba8" },
          { to: "/study/lectures", label: "Lecture Lab", hint: "Lecture → quiz", icon: BookOpen, soft: "#d2ecd4", ink: "#1d4f20" },
        ],
      },
    ],
  },
  {
    id: "room",
    label: "Study Room",
    columns: [
      {
        label: "Study together",
        items: [
          { to: "/share", label: "Shared flashcards", hint: "Community decks", icon: Share2, soft: "#f4f4f8", ink: "#1d4f20" },
          { to: "/spaces", label: "Classrooms & groups", hint: "Your spaces", icon: Users, soft: "#f4f4f8", ink: "#1d5fd0" },
        ],
      },
    ],
  },
  {
    id: "german",
    label: "German",
    columns: [
      {
        label: "German study tools",
        items: [
          { to: "/german", label: "German Lab", hint: "der · die · das", icon: Languages, soft: "#f4f4f8", ink: "#1a4ba8" },
        ],
      },
    ],
  },
];
