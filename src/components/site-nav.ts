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
          { to: "/study/todo", label: "To-do list", hint: "Study planner", icon: CheckSquare, soft: "#d2ecd4", ink: "#1d4f20" },
          { to: "/study/exams", label: "Exam schedule", hint: "Month calendar", icon: CalendarDays, soft: "#d2ecd4", ink: "#1d4f20" },
        ],
      },
      {
        label: "With AI",
        items: [
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
];
