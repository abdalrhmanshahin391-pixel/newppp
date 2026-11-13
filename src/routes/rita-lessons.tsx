import { LanguageGate } from "@/components/language/LanguageGate";
import { useActiveLanguage } from "@/lib/language-scope";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getLessonPath,
  type PathLesson,
  type ReviewSuggestion,
} from "@/lib/rita-curriculum.functions";
import { LessonPathView } from "@/components/rita-lessons/LessonPathView";
import { LessonSheet } from "@/components/rita-lessons/LessonSheet";
import type { PathItem } from "@/lib/rita-path-layout";
import { unlockSound } from "@/components/rita-study/tech-sound";
import { prefetchLesson, rememberLesson } from "@/lib/study/lesson-entry";

const UUID = /^[0-9a-f-]{36}$/i;

export const Route = createFileRoute("/rita-lessons")({
  validateSearch: (search: Record<string, unknown>): { lesson?: string } => {
    const lesson = typeof search.lesson === "string" ? search.lesson.trim() : "";
    return UUID.test(lesson) ? { lesson } : {};
  },
  head: () => ({
    meta: [{ title: "دروس يوزرا — Uzyra" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <LanguageGate>
      <RitaLessonsPage />
    </LanguageGate>
  ),
});

function RitaLessonsPage() {
  const navigate = useNavigate();
  const { lesson: openId } = Route.useSearch();
  const pushed = useRef(false);
  const { user, loading, isAdmin } = useAuth();
  const pathFn = useServerFn(getLessonPath);
  const language = useActiveLanguage();
  const [lessons, setLessons] = useState<PathLesson[] | null>(null);
  const [reviews, setReviews] = useState<ReviewSuggestion[]>([]);
  const [items, setItems] = useState<PathItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/login" });
  }, [loading, navigate, user]);

  const load = useCallback(async () => {
    try {
      const result = await pathFn({ data: { language } });
      setLessons(result.lessons);
      setReviews(result.reviews);
      setItems(result.items ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذّر تحميل الدروس.");
    }
  }, [pathFn, language]);

  useEffect(() => {
    if (!user) return;
    // Another language is another path: clear the old one while the new one loads.
    setLessons(null);
    setItems([]);
    setReviews([]);
    void load();
  }, [load, user]);

  const sheetLesson = lessons?.find((lesson) => lesson.id === openId) ?? null;

  // A study lesson's card is open: start loading the lesson now, so "start" opens it at once.
  useEffect(() => {
    if (!sheetLesson || sheetLesson.experience !== "study") return;
    rememberLesson(sheetLesson.id, { title: sheetLesson.title, titleAr: sheetLesson.title_ar });
    prefetchLesson(sheetLesson.id);
  }, [sheetLesson]);

  function start(lesson: PathLesson) {
    // The server decided the lesson's real experience: the study page only when it is ready.
    if (lesson.experience === "study") {
      // This tap is the moment Safari allows sound, so the lesson intro can play its sound. The
      // lesson starts loading now too, before its page exists, and the intro shows its title at once.
      unlockSound();
      rememberLesson(lesson.id, { title: lesson.title, titleAr: lesson.title_ar });
      prefetchLesson(lesson.id);
      void navigate({ to: "/rita-study", search: { lesson: lesson.id } });
      return;
    }
    void navigate({ to: "/rita-live", search: { lesson: lesson.id } });
  }

  // A lesson with slides or resources opens its card first; a bare lesson starts straight away.
  function open(lesson: PathLesson) {
    if (lesson.slide_count + lesson.resource_count === 0) {
      start(lesson);
      return;
    }
    pushed.current = true;
    void navigate({ to: "/rita-lessons", search: { lesson: lesson.id } });
  }

  // Back closes the card. When the card came from a shared link there is nothing to go back to.
  function close() {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else {
      void navigate({ to: "/rita-lessons", search: {}, replace: true });
    }
  }

  return (
    <>
      <LessonPathView
        lessons={lessons}
        items={items}
        reviews={reviews}
        error={error}
        isAdmin={isAdmin}
        language={language}
        onOpenLesson={open}
        onReload={load}
      />
      {sheetLesson && <LessonSheet lesson={sheetLesson} onClose={close} onStart={start} />}
    </>
  );
}
