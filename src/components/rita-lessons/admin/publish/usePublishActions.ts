import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  adminSetCurriculumStatus,
  adminSetLessonStatus,
  type CurriculumRow,
  type LessonRow,
} from "@/lib/rita-curriculum.functions";
import type { BoardEntry } from "@/lib/rita-lesson-board";
import { errorText } from "../book/book-utils";

export type PublishEntry = BoardEntry<LessonRow, CurriculumRow>;

/**
 * Publishing from the review page. A lesson is published together with its book when the book is
 * still a draft (learners only see lessons of published books); publishing puts it at the end of
 * its level on the path by itself.
 */
export function usePublishActions(onChanged: () => Promise<void>) {
  const lessonFn = useServerFn(adminSetLessonStatus);
  const bookFn = useServerFn(adminSetCurriculumStatus);
  const navigate = useNavigate();
  /** The lesson being changed, or "all" while several are published. */
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  async function publish(entries: PublishEntry[]) {
    if (busy || !entries.length) return;
    setBusy(entries.length > 1 ? "all" : entries[0].lesson.id);
    setProgress({ done: 0, total: entries.length });
    const booksDone = new Set<string>();
    let done = 0;
    try {
      for (const entry of entries) {
        await lessonFn({ data: { lessonId: entry.lesson.id, status: "published" } });
        if (entry.book.status !== "published" && !booksDone.has(entry.book.id)) {
          await bookFn({ data: { curriculumId: entry.book.id, status: "published" } });
          booksDone.add(entry.book.id);
        }
        done += 1;
        setProgress({ done, total: entries.length });
      }
      const levels = [...new Set(entries.map((entry) => entry.level))].join(" و ");
      toast.success(
        done === 1 ? `انشر الدرس، وصار بالمسار بمستوى ${levels}` : `انشروا ${done} دروس بالمسار`,
        {
          description: booksDone.size ? "وانشر الكتاب معهم كمان." : undefined,
          action: { label: "شوف المسار", onClick: () => void navigate({ to: "/rita-lessons" }) },
        },
      );
    } catch (error) {
      toast.error(
        done ? `انشر ${done} من ${entries.length}: ${errorText(error)}` : errorText(error),
      );
    } finally {
      setBusy("");
      setProgress(null);
      await onChanged();
    }
  }

  async function setStatus(
    entry: PublishEntry,
    status: "draft" | "archived",
    done: string,
  ): Promise<boolean> {
    if (busy) return false;
    setBusy(entry.lesson.id);
    try {
      await lessonFn({ data: { lessonId: entry.lesson.id, status } });
      toast.success(done);
      return true;
    } catch (error) {
      toast.error(errorText(error));
      return false;
    } finally {
      setBusy("");
      await onChanged();
    }
  }

  return {
    busy,
    progress,
    publish,
    unpublish: (entry: PublishEntry) =>
      setStatus(entry, "draft", "رجع الدرس مسودة، وما عاد الطلاب يشوفوه"),
    archive: (entry: PublishEntry): Promise<boolean> => {
      if (
        !window.confirm(
          `حذف «${entry.lesson.title_ar || entry.lesson.title}»؟ بيختفي من القوائم ومن مسار الطلاب.`,
        )
      )
        return Promise.resolve(false);
      return setStatus(entry, "archived", "انحذف الدرس");
    },
  };
}

export type PublishActions = ReturnType<typeof usePublishActions>;
