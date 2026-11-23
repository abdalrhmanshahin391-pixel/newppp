import { BookOpen, Gamepad2, Layers, ListChecks, Mic, Repeat2, Share2 } from "lucide-react";
import type { PanelMode } from "./SignedOutPanel";

/**
 * What the sign-in panel says in front of the games and the shared decks, questions and summaries.
 * Everything a visitor can use needs an account; the pages that only describe Uzyra stay open.
 */

const GAMES: PanelMode[] = [
  {
    icon: Gamepad2,
    title: "Wordcraft",
    text: "Four new words hidden in the letters, every round.",
  },
  { icon: Layers, title: "Pairs", text: "Match your own flashcards against the clock." },
  { icon: Repeat2, title: "Repeat", text: "Uzyra says a sentence, you say it back." },
];

const SHARED: PanelMode[] = [
  {
    icon: Share2,
    title: "Shared decks",
    text: "Flashcards made by other students, ready to study.",
  },
  { icon: ListChecks, title: "Question sets", text: "Practice questions with their explanations." },
  { icon: BookOpen, title: "Summaries", text: "One-page summaries you can save as a PDF." },
];

const VOICE: PanelMode[] = [
  {
    icon: Mic,
    title: "Talk to Uzyra",
    text: "Practise out loud; she answers in a sentence or two.",
  },
  ...GAMES.slice(0, 2),
];

export const GATE = {
  wordcraft: {
    title: "Sign in to play Wordcraft",
    lead: "Your rounds, words and progress are kept in your own account. It is free to start.",
    modes: GAMES,
  },
  repeat: {
    title: "Sign in to practise with Repeat",
    lead: "Uzyra says a sentence and you say it back. Sign in to start; it is free.",
    modes: VOICE,
  },
  share: {
    title: "Sign in to open shared decks and questions",
    lead: "Study what other students made and save it into your own subjects. It is free to start.",
    modes: SHARED,
  },
  deck: {
    title: "Sign in to open this shared deck",
    lead: "Flip through the cards and save the deck into your own subjects. It is free to start.",
    modes: SHARED,
  },
  questions: {
    title: "Sign in to open this question set",
    lead: "Practise the questions with their explanations and save them. It is free to start.",
    modes: SHARED,
  },
  summary: {
    title: "Sign in to read this summary",
    lead: "Read it, save it as a PDF, and make your own from any lecture. It is free to start.",
    modes: SHARED,
  },
} as const;
