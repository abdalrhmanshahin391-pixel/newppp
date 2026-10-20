import ritaConversationsArt from "@/assets/learn-rita-conversations.jpg";
import ritaLessonsArt from "@/assets/learn-rita-lessons.jpg";
import allInOneArt from "@/assets/mode-allinone.jpg";
import examsArt from "@/assets/mode-exams.jpg";
import flashcardsArt from "@/assets/mode-flashcards.jpg";
import germanArt from "@/assets/mode-german.jpg";
import lectureArt from "@/assets/mode-lecturelab.jpg";
import memoryArt from "@/assets/mode-memory.jpg";
import qbankArt from "@/assets/mode-qbank.jpg";
import shareArt from "@/assets/mode-share.jpg";
import spacesArt from "@/assets/mode-spaces.jpg";
import summaryArt from "@/assets/mode-summary.jpg";
import todoArt from "@/assets/mode-todo.jpg";

/**
 * Visual identity for every card on the learning home.  Keeping the catalogue
 * here makes the page complete while leaving lesson-specific student content
 * and admin-managed images independent.
 */
export const LEARN_IMAGES: Record<string, string> = {
  "rita-conversations": ritaConversationsArt,
  "rita-lessons": ritaLessonsArt,
  flashcards: flashcardsArt,
  "memory-lab": memoryArt,
  "pdf-summary": summaryArt,
  "all-in-one": allInOneArt,
  "question-bank": qbankArt,
  "lecture-lab": lectureArt,
  todo: todoArt,
  exams: examsArt,
  "shared-decks": shareArt,
  spaces: spacesArt,
  "german-lab": germanArt,
};
