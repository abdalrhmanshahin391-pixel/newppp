import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isGermanItem, type LearningItem, type SaveTarget } from "@/lib/rita-learning";
import {
  addItems,
  chunks,
  editItem,
  loadList,
  removeItem,
  removeItems,
  saveList,
  type ListEntry,
} from "@/lib/rita-learning-list";
import {
  matchSubject,
  subjectOptions,
  type FlashSubject,
  type SubjectOption,
} from "@/lib/rita-learning-tree";

export type DestinationPayload = {
  flashSubjects: FlashSubject[];
  germanSubjects: { id: string; name: string }[];
  germanSubtopics: { id: string; name: string; subject_id: string }[];
};
export type TrayNotice = { tone: "ok" | "error" | "info"; text: string };
export type CreateKind = "flash_subject" | "german_subject" | "german_subtopic";

const EMPTY: DestinationPayload = { flashSubjects: [], germanSubjects: [], germanSubtopics: [] };

async function headers() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in first.");
  return new Headers({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });
}

function errorText(cause: unknown) {
  return cause instanceof Error && cause.message ? cause.message : "Something went wrong.";
}

/**
 * The learner's list of words they asked about, and the steps that turn it into flashcards:
 * add (from the voice call), delete or fix a word, pick or create a subject, save.
 * Nothing is reported as saved until the server confirms it.
 */
export function useLearningTray(userId: string | undefined) {
  const [entries, setEntries] = useState<ListEntry[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [target, setTargetState] = useState<SaveTarget>("flashcards");
  const [destinationId, setDestinationId] = useState("");
  const [germanSubjectId, setGermanSubjectId] = useState("");
  const [destinations, setDestinations] = useState<DestinationPayload>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<TrayNotice | null>(null);
  const [latest, setLatest] = useState("");
  const [suggestedName, setSuggestedName] = useState("");
  const [remembered, setRemembered] = useState<{
    target: SaveTarget;
    id: string;
    label: string;
  } | null>(null);
  const destinationsRef = useRef(EMPTY);
  const loadedDestinations = useRef(false);
  const entriesRef = useRef<ListEntry[]>([]);
  entriesRef.current = entries;

  // The list belongs to the signed-in user and survives reloads and new calls.
  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    setEntries(loadList(window.localStorage, userId));
    setLoadedFor(userId);
  }, [userId]);
  useEffect(() => {
    if (!userId || loadedFor !== userId || typeof window === "undefined") return;
    saveList(window.localStorage, userId, entries);
  }, [entries, loadedFor, userId]);
  useEffect(() => {
    if (!latest) return;
    const timer = setTimeout(() => setLatest(""), 6_000);
    return () => clearTimeout(timer);
  }, [latest]);

  const flashOptions: SubjectOption[] = useMemo(
    () => subjectOptions(destinations.flashSubjects),
    [destinations.flashSubjects],
  );
  const germanSubtopicOptions = useMemo(
    () =>
      destinations.germanSubtopics
        .filter((item) => !germanSubjectId || item.subject_id === germanSubjectId)
        .map((item) => ({ id: item.id, label: item.name })),
    [destinations.germanSubtopics, germanSubjectId],
  );

  const loadDestinations = useCallback(async (force = false) => {
    if (loadedDestinations.current && !force) return destinationsRef.current;
    const response = await fetch("/api/rita/learning", { headers: await headers() });
    if (!response.ok) throw new Error("Could not load your subjects.");
    const payload = (await response.json()) as DestinationPayload;
    destinationsRef.current = payload;
    loadedDestinations.current = true;
    setDestinations(payload);
    return payload;
  }, []);

  const add = useCallback((items: LearningItem[], source: string) => {
    if (!items.length) return;
    setEntries((current) => addItems(current, items, source));
    setLatest(`Added: ${items.map((item) => item.term).join(", ")}`);
  }, []);
  const flash = useCallback((text: string) => setLatest(text), []);
  const remove = useCallback((id: string) => setEntries((c) => removeItem(c, id)), []);
  const edit = useCallback(
    (id: string, patch: { term?: string; meaning?: string }) =>
      setEntries((current) => editItem(current, id, patch)),
    [],
  );
  const clearAll = useCallback(() => setEntries([]), []);

  const setTarget = useCallback((next: SaveTarget) => {
    setTargetState(next);
    setDestinationId("");
    setGermanSubjectId("");
    setNotice(null);
  }, []);

  const openTray = useCallback(async () => {
    setOpen(true);
    setNotice(null);
    try {
      await loadDestinations();
    } catch (cause) {
      setNotice({ tone: "error", text: errorText(cause) });
    }
  }, [loadDestinations]);
  const closeTray = useCallback(() => setOpen(false), []);

  const create = useCallback(
    async (kind: CreateKind, name: string, parentId?: string | null) => {
      const clean = name.trim();
      if (!clean) return null;
      setNotice(null);
      try {
        const body =
          kind === "flash_subject"
            ? { action: "create_flash_subject", name: clean, parentId: parentId ?? null }
            : kind === "german_subject"
              ? { action: "create_german_subject", name: clean }
              : { action: "create_german_subtopic", name: clean, subjectId: parentId };
        const response = await fetch("/api/rita/learning", {
          method: "POST",
          headers: await headers(),
          body: JSON.stringify(body),
        });
        const data = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
        if (!response.ok || !data.id) throw new Error(data.error || "Could not create it.");
        await loadDestinations(true);
        if (kind === "german_subject") {
          setGermanSubjectId(data.id);
          setDestinationId("");
        } else setDestinationId(data.id);
        setSuggestedName("");
        setNotice({ tone: "ok", text: `Created “${clean}”.` });
        return data.id;
      } catch (cause) {
        setNotice({ tone: "error", text: errorText(cause) });
        return null;
      }
    },
    [loadDestinations],
  );

  /** Saves words to one subject, in requests the server accepts, and reports exactly what happened. */
  const saveItems = useCallback(
    async (kind: SaveTarget, id: string, label: string, chosen: ListEntry[] | LearningItem[]) => {
      const eligible = kind === "german_lab" ? chosen.filter(isGermanItem) : chosen;
      const left = chosen.length - eligible.length;
      if (!eligible.length) {
        setNotice({
          tone: "error",
          text:
            kind === "german_lab"
              ? "German Lab keeps only German words. None of these are German."
              : "There is nothing to save.",
        });
        return;
      }
      setSaving(true);
      setNotice(null);
      let saved = 0;
      let skipped = 0;
      const done: string[] = [];
      try {
        for (const batch of chunks(eligible)) {
          const response = await fetch("/api/rita/learning", {
            method: "POST",
            headers: await headers(),
            body: JSON.stringify({
              action: "save",
              target: kind,
              destinationId: id,
              items: batch.map((item) => ({
                term: item.term,
                meaning: item.meaning,
                language: item.language,
                kind: item.kind,
                article: item.article,
                plural: item.plural,
              })),
            }),
          });
          const data = (await response.json().catch(() => ({}))) as {
            saved?: number;
            skipped?: number;
            error?: string;
          };
          if (!response.ok) throw new Error(data.error || "Could not save those words.");
          saved += data.saved ?? 0;
          skipped += data.skipped ?? 0;
          for (const item of batch)
            if ("id" in item && typeof item.id === "string") done.push(item.id);
        }
        setEntries((current) => removeItems(current, done));
        setRemembered({ target: kind, id, label });
        const parts = [
          `Saved ${saved} ${kind === "flashcards" ? "flashcard" : "word"}${saved === 1 ? "" : "s"} to “${label}”.`,
        ];
        if (skipped) parts.push(`${skipped} already there.`);
        if (left) parts.push(`${left} non-German stayed in your list.`);
        setNotice({ tone: "ok", text: parts.join(" ") });
      } catch (cause) {
        // Words that were saved before the failure are gone from the list; the rest stay.
        setEntries((current) => removeItems(current, done));
        setNotice({
          tone: "error",
          text: `${errorText(cause)}${saved ? ` ${saved} were saved before it stopped.` : ""}`,
        });
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const destinationLabel = useCallback(
    (kind: SaveTarget, id: string) =>
      kind === "flashcards"
        ? (subjectOptions(destinationsRef.current.flashSubjects).find((o) => o.id === id)?.label ??
          "")
        : (() => {
            const sub = destinationsRef.current.germanSubtopics.find((s) => s.id === id);
            const parent = destinationsRef.current.germanSubjects.find(
              (s) => s.id === sub?.subject_id,
            );
            return sub ? `${parent?.name ?? "German"} / ${sub.name}` : "";
          })(),
    [],
  );

  /** The Save button: every word currently in the list goes to the chosen subject. */
  const save = useCallback(async () => {
    if (!destinationId || !entriesRef.current.length) return;
    await saveItems(
      target,
      destinationId,
      destinationLabel(target, destinationId),
      entriesRef.current,
    );
  }, [destinationId, destinationLabel, saveItems, target]);

  /**
   * "Turn them into flashcards" by voice. A subject the learner named that matches exactly one
   * is used right away; otherwise the picker opens (with the spoken name ready to create).
   */
  const convertByVoice = useCallback(
    async (kind: SaveTarget, hint: string) => {
      setOpen(true);
      setTargetState(kind);
      setDestinationId("");
      setNotice(null);
      if (!entriesRef.current.length) {
        setNotice({ tone: "info", text: "Your words list is empty." });
        return;
      }
      try {
        const payload = await loadDestinations();
        const wanted = hint.trim();
        if (wanted) {
          const options =
            kind === "flashcards"
              ? subjectOptions(payload.flashSubjects)
              : payload.germanSubtopics.map((item) => ({
                  id: item.id,
                  depth: 0,
                  label: `${payload.germanSubjects.find((p) => p.id === item.subject_id)?.name ?? "German"} / ${item.name}`,
                }));
          const match = matchSubject(options, wanted);
          if (match) {
            setDestinationId(match.id);
            await saveItems(kind, match.id, match.label, entriesRef.current);
            return;
          }
          setSuggestedName(wanted);
          setNotice({
            tone: "info",
            text: `No single subject matches “${wanted}”. Choose one, or create it below.`,
          });
          return;
        }
        setNotice({
          tone: "info",
          text: `Choose where to save ${entriesRef.current.length} word${entriesRef.current.length === 1 ? "" : "s"}.`,
        });
      } catch (cause) {
        setNotice({ tone: "error", text: errorText(cause) });
      }
    },
    [loadDestinations, saveItems],
  );

  /** Used when the learner explicitly asks to save and the subject is already known. */
  const saveNamed = useCallback(
    async (kind: SaveTarget, id: string, label: string, items: LearningItem[]) => {
      setTargetState(kind);
      setDestinationId(id);
      await saveItems(kind, id, label, items);
    },
    [saveItems],
  );

  return {
    entries,
    open,
    target,
    destinationId,
    germanSubjectId,
    destinations,
    flashOptions,
    germanSubtopicOptions,
    saving,
    notice,
    latest,
    suggestedName,
    remembered,
    setOpen,
    setDestinationId,
    setGermanSubjectId,
    setNotice,
    setTarget,
    setRemembered,
    add,
    flash,
    remove,
    edit,
    clearAll,
    openTray,
    closeTray,
    loadDestinations,
    create,
    save,
    saveNamed,
    convertByVoice,
  };
}
