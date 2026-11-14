// The reader's layout helpers, shared with the screen shown while a book opens (BookOpening).
import { useEffect, useState } from "react";

export const SPLIT_KEY = "uzyra-book-split";

/** The reader's saved split between Uzyra and the book (percentages), if any. */
export function readSplit(): { rita: number; book: number } | undefined {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SPLIT_KEY) ?? "null") as unknown;
    if (!raw || typeof raw !== "object") return undefined;
    const { rita, book } = raw as Record<string, unknown>;
    if (typeof rita !== "number" || typeof book !== "number") return undefined;
    if (!(rita > 10 && book > 10 && Math.abs(rita + book - 100) < 1)) return undefined;
    return { rita, book };
  } catch {
    return undefined;
  }
}

export function useWide(min: number): boolean {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${min}px)`);
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [min]);
  return wide;
}
