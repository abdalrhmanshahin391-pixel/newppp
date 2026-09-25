import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { CSSProperties } from "react";

export type CardStyle = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  size?: "s" | "m" | "l" | "xl";
  color?: string;
  highlight?: string;
  align?: "left" | "center" | "right";
};

export type FlashCardItem = {
  id: string;
  front: string;
  back: string;
  frontImage?: string;
  backImage?: string;
  frontStyle?: CardStyle;
  backStyle?: CardStyle;
};

/** Palette offered in the rich creator. */
export const TEXT_COLORS = [
  { key: "ink", value: "#23201d" },
  { key: "apricot", value: "#c9762a" },
  { key: "sky", value: "#2f79b5" },
  { key: "lilac", value: "#7d5cb8" },
  { key: "mint", value: "#2f8a63" },
  { key: "rose", value: "#c0504c" },
] as const;

export const HIGHLIGHT_COLORS = [
  { key: "none", value: "" },
  { key: "apricot", value: "#fdeed6" },
  { key: "sky", value: "#e2eff9" },
  { key: "lilac", value: "#eee8f8" },
  { key: "mint", value: "#e0f2ea" },
  { key: "rose", value: "#fbe4e4" },
] as const;

const SIZE_PX: Record<NonNullable<CardStyle["size"]>, number> = {
  s: 16,
  m: 22,
  l: 30,
  xl: 40,
};

/** Turns a saved style block into inline CSS for both creator and player. */
export function styleToCss(style?: CardStyle): CSSProperties {
  if (!style) return {};
  return {
    fontWeight: style.bold ? 900 : undefined,
    fontStyle: style.italic ? "italic" : undefined,
    textDecoration: style.underline ? "underline" : undefined,
    fontSize: style.size ? `${SIZE_PX[style.size]}px` : undefined,
    lineHeight: style.size ? 1.3 : undefined,
    color: style.color || undefined,
    background: style.highlight || undefined,
    textAlign: style.align ?? undefined,
    borderRadius: style.highlight ? 12 : undefined,
  };
}

const MODE_KEY = "rita_fc_creator_mode";
export type CreatorMode = "simple" | "rich";

/** Remembers whether the student prefers the simple or rich creator. */
export function useCreatorMode(): [CreatorMode, (m: CreatorMode) => void] {
  const [mode, setMode] = useState<CreatorMode>("simple");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(MODE_KEY);
      if (saved === "rich" || saved === "simple") setMode(saved);
    } catch {
      /* ignore */
    }
  }, []);
  const update = useCallback((m: CreatorMode) => {
    setMode(m);
    try {
      window.localStorage.setItem(MODE_KEY, m);
    } catch {
      /* ignore */
    }
  }, []);
  return [mode, update];
}

export function topicKey(subject: string, subtopic: string) {
  const slug = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "-");
  return `rita_fc_${slug(subject)}_${slug(subtopic)}`;
}

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ------------------------------------------------------------------ *
 * Tiny store so card counts anywhere on the page stay in sync.
 * ------------------------------------------------------------------ */
let version = 0;
const listeners = new Set<() => void>();

function emitCardsChanged() {
  version += 1;
  listeners.forEach((l) => l());
}

function subscribeCards(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useCardsVersion() {
  return useSyncExternalStore(
    subscribeCards,
    () => version,
    () => 0,
  );
}

export function readCards(subject: string, subtopic: string): FlashCardItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(topicKey(subject, subtopic));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FlashCardItem[]) : [];
  } catch {
    return [];
  }
}

export function countCards(subject: string, subtopic: string) {
  return readCards(subject, subtopic).length;
}

/** Every card under one subject, in sub-topic order. */
export function collectCards(subject: string, subtopics: string[]): FlashCardItem[] {
  return subtopics.flatMap((s) => readCards(subject, s));
}

/** Replaces the saved cards of one topic (used when copying a shared deck in). */
export function writeCards(subject: string, subtopic: string, cards: FlashCardItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(topicKey(subject, subtopic), JSON.stringify(cards));
    emitCardsChanged();
  } catch {
    /* ignore */
  }
}

/** Flashcards for one sub-subject topic, persisted in the browser. */

export function useFlashcards(subject: string, subtopic: string) {
  const key = topicKey(subject, subtopic);
  const [cards, setCards] = useState<FlashCardItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(false);
    setCards(readCards(subject, subtopic));
    setHydrated(true);
  }, [subject, subtopic]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(cards));
      emitCardsChanged();
    } catch {
      /* ignore */
    }
  }, [cards, hydrated, key]);

  const addCard = useCallback(
    (
      front: string,
      back: string,
      frontImage?: string,
      backImage?: string,
      frontStyle?: CardStyle,
      backStyle?: CardStyle,
    ) => {
      setCards((c) => [
        ...c,
        { id: newId(), front, back, frontImage, backImage, frontStyle, backStyle },
      ]);
    },
    [],
  );

  const updateCard = useCallback((id: string, patch: Partial<Omit<FlashCardItem, "id">>) => {
    setCards((c) => c.map((card) => (card.id === id ? { ...card, ...patch } : card)));
  }, []);

  const deleteCard = useCallback((id: string) => {
    setCards((c) => c.filter((card) => card.id !== id));
  }, []);

  const reorderCards = useCallback((from: number, to: number) => {
    setCards((c) => {
      if (to < 0 || to >= c.length || from === to) return c;
      const next = [...c];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }, []);

  return { cards, addCard, updateCard, deleteCard, reorderCards };
}

/** Font styling that grows for short answers and shrinks for long ones. */
export function scaleText(text: string) {
  const n = text.trim().length;
  if (n <= 30) return "text-[26px] leading-tight font-black";
  if (n <= 90) return "text-[20px] leading-snug font-extrabold";
  return "text-[15px] leading-relaxed font-semibold";
}

export const CARD_LIMIT = 250;
