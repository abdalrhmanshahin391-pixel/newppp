import booksArt from "@/assets/home-flashcards-books.webp";
import deskArt from "@/assets/home-toolkit-desk.webp";
import libraryArt from "@/assets/home-plans-library.webp";
import notesArt from "@/assets/home-classroom-notes.webp";
import studentsArt from "@/assets/home-hero-students.webp";
import workshopArt from "@/assets/rita-live/workshop-background.webp";

/**
 * Pictures for the Uzyra home page. Every slot is a stand-in that can be swapped for a new
 * picture by changing the import here; nothing else on the page needs to change. The home page
 * shows them in black and white, so colour photos and illustrations both work.
 */
export type HomeImage = { src: string; width: number; height: number };

export const HOME_IMAGES = {
  /** Behind the first screen, right side. Wide, a person or a group learning. */
  hero: { src: studentsArt, width: 1600, height: 1067 },
  /** Banner inside the "Keep every word" window and its card. Open book, notebook. */
  words: { src: booksArt, width: 1600, height: 1202 },
  /** Banner inside the "Study your own material" window and its card. Desk, notes, tablet. */
  study: { src: deskArt, width: 1600, height: 1067 },
  /** Wide mood picture behind the voice band. A quiet room. */
  voice: { src: workshopArt, width: 1586, height: 992 },
  /** Learning together. */
  together: { src: notesArt, width: 1100, height: 733 },
  /** Closing band. */
  library: { src: libraryArt, width: 1600, height: 1479 },
} satisfies Record<string, HomeImage>;
