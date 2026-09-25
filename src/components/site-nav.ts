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
          { to: "/study", label: "Flashcards", hint: "Active recall", icon: Layers, soft: "#e4dcf3", ink: "#4a3877" },
          { to: "/study/match", label: "Memory Lab", hint: "Matching games", icon: Brain, soft: "#f6ddd5", ink: "#7d3421" },
          { to: "/study/pdf", label: "PDF summaries", hint: "One-page sheets", icon: FileText, soft: "#fbe3c8", ink: "#7a4b16" },
          { to: "/study/todo", label: "To-do list", hint: "Study planner", icon: CheckSquare, soft: "#d8ecdd", ink: "#215237" },
          { to: "/study/exams", label: "Exam schedule", hint: "Month calendar", icon: CalendarDays, soft: "#e6f0d8", ink: "#2f6318" },
        ],
      },
      {
        label: "With AI",
        items: [
          { to: "/study/all-in-one", label: "All in one", hint: "One upload · everything", icon: Wand2, soft: "#e7dcf7", ink: "#3f2c73" },
          { to: "/tutorial", label: "Tutorial", hint: "How every tool works", icon: Sparkles, soft: "#dcf1e4", ink: "#20613f" },
          { to: "/courses/$courseId", params: { courseId: "question-bank" }, label: "Question bank", hint: "Study · exam", icon: ListChecks, soft: "#d9ecf7", ink: "#1d4d6b" },
          { to: "/study/lectures", label: "Lecture Lab", hint: "Lecture → quiz", icon: BookOpen, soft: "#e6f0d8", ink: "#2f6318" },
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
          { to: "/share", label: "Shared flashcards", hint: "Community decks", icon: Share2, soft: "#e6f4d8", ink: "#3d5c14" },
          { to: "/spaces", label: "Classrooms & groups", hint: "Your spaces", icon: Users, soft: "#f3e8ff", ink: "#4a3877" },
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
          { to: "/german", label: "German Lab", hint: "der · die · das", icon: Languages, soft: "#dceafb", ink: "#12315e" },
        ],
      },
    ],
  },
];
