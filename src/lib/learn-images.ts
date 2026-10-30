import ritaConversationsArt from "@/assets/mono-rita-conversations.webp";
import ritaLessonsArt from "@/assets/mono-rita-lessons.webp";
import allInOneArt from "@/assets/mono-allinone.webp";
import examsArt from "@/assets/mono-exams.webp";
import flashcardsArt from "@/assets/mono-flashcards.webp";
import germanArt from "@/assets/mono-german.webp";
import lectureArt from "@/assets/mono-lecturelab.webp";
import memoryArt from "@/assets/mono-memory.webp";
import qbankArt from "@/assets/mono-qbank.webp";
import shareArt from "@/assets/mono-share.webp";
import spacesArt from "@/assets/mono-spaces.webp";
import summaryArt from "@/assets/mono-summary.webp";
import todoArt from "@/assets/mono-todo.webp";

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
