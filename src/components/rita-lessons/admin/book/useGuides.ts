import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  adminGuideUrl,
  adminListGuides,
  adminRenderGuide,
  adminWriteGuide,
  type GuideListItem,
} from "@/lib/guides/guides.functions";
import { describeGuideError, isBusy } from "@/lib/guides/guide-record";
import { errorDetail } from "./book-utils";

export type GuideJob = { key: string; title: string; from: number; to: number };

export type GuideProgress = {
  stage: "writing" | "rendering" | "done" | "failed";
  message?: string;
  detail?: string;
};

/**
 * The admin's PDF guides for one book: the list (refreshed while one is being made), making guides
 * one after the other with progress per guide, retrying a failed one, and opening or downloading a file.
 * Each guide is two requests (write, then render) so neither runs long; either can be repeated alone.
 */
export function useGuides(curriculumId: string) {
  const listFn = useServerFn(adminListGuides);
  const writeFn = useServerFn(adminWriteGuide);
  const renderFn = useServerFn(adminRenderGuide);
  const urlFn = useServerFn(adminGuideUrl);

  const [loaded, setLoaded] = useState(false);
  const [ready, setReady] = useState(true);
  const [guides, setGuides] = useState<GuideListItem[]>([]);
  const [listError, setListError] = useState("");
  const [progress, setProgress] = useState<Record<string, GuideProgress>>({});
  const [running, setRunning] = useState(false);
  const cancel = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const result = await listFn({ data: { curriculumId } });
      setReady(result.ready);
      setGuides(result.guides);
      setListError("");
    } catch (error) {
      setListError(error instanceof Error ? error.message : "ما قدرت أحمّل الأدلة.");
    } finally {
      setLoaded(true);
    }
  }, [curriculumId, listFn]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // A guide started in another tab (or lost to a closed tab) is picked up while it is busy.
  const anyBusy = guides.some((guide) => isBusy(guide.status));
  useEffect(() => {
    if (!anyBusy || running) return;
    const timer = window.setInterval(() => void refresh(), 6_000);
    return () => window.clearInterval(timer);
  }, [anyBusy, running, refresh]);

  const set = (key: string, value: GuideProgress) =>
    setProgress((current) => ({ ...current, [key]: value }));

  /** Write then draw one guide. `guideId` skips the writing when the content is already saved. */
  async function makeOne(job: GuideJob, guideId?: string): Promise<boolean> {
    let id = guideId;
    try {
      if (!id) {
        set(job.key, { stage: "writing" });
        const written = await writeFn({
          data: { curriculumId, title: job.title, fromPage: job.from, toPage: job.to },
        });
        if (!written.ok) {
          set(job.key, {
            stage: "failed",
            message:
              written.code === "already_running"
                ? "هالدليل قيد الصنع هلأ. استنى لحد ما يخلص."
                : describeGuideError(written.code),
            detail: written.message,
          });
          return false;
        }
        id = written.guideId;
      }
      set(job.key, { stage: "rendering" });
      const rendered = await renderFn({ data: { guideId: id } });
      if (!rendered.ok) {
        set(job.key, {
          stage: "failed",
          message: describeGuideError(rendered.code),
          detail: rendered.message,
        });
        return false;
      }
      set(job.key, { stage: "done" });
      return true;
    } catch (error) {
      set(job.key, {
        stage: "failed",
        message: error instanceof Error ? error.message.slice(0, 160) : "صار خطأ",
        detail: errorDetail(error),
      });
      return false;
    }
  }

  async function make(jobs: GuideJob[]): Promise<number> {
    cancel.current = false;
    setRunning(true);
    let made = 0;
    try {
      for (const job of jobs) {
        if (cancel.current) break;
        if (await makeOne(job)) made += 1;
        await refresh();
      }
    } finally {
      setRunning(false);
      await refresh();
    }
    return made;
  }

  /** Try again: draw the saved content when there is some, otherwise write it again. */
  async function retry(guide: GuideListItem) {
    setRunning(true);
    try {
      const job = { key: guide.id, title: guide.title, from: guide.from_page, to: guide.to_page };
      await makeOne(job, guide.has_content && guide.status === "failed" ? guide.id : undefined);
    } finally {
      setRunning(false);
      await refresh();
    }
  }

  /** A new version: the pages are read again and the guide is rewritten. The old file stays. */
  async function remake(guide: GuideListItem) {
    setRunning(true);
    try {
      await makeOne({
        key: guide.id,
        title: guide.title,
        from: guide.from_page,
        to: guide.to_page,
      });
    } finally {
      setRunning(false);
      await refresh();
    }
  }

  /** Opens in a new tab (a blank tab is opened first so the iPad does not block it) or downloads. */
  async function openFile(guide: GuideListItem, download: boolean) {
    const tab = download ? null : window.open("about:blank", "_blank");
    try {
      const { url } = await urlFn({ data: { guideId: guide.id, download } });
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch (error) {
      tab?.close();
      throw error;
    }
  }

  return {
    loaded,
    ready,
    guides,
    listError,
    progress,
    running,
    refresh,
    make,
    retry,
    remake,
    openFile,
    cancel: () => {
      cancel.current = true;
    },
  };
}
