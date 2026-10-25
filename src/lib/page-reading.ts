/**
 * Reads scanned pages one at a time from the browser: each page gets a time limit and a few tries,
 * a problem that will not go away (a bad key, no credit) stops the whole run at once, and every
 * page ends with a plain result so the admin sees which pages failed and why.
 */
export type PageOutcome = { page: number; ok: boolean; reason: string; attempts: number };

export type ReadOne = (page: number) => Promise<{ ok: boolean; reason?: string }>;

/** A failure retrying cannot fix: the key, the credit, the model. */
export function isFatalReason(reason: string) {
  return /\b(401|402|403)\b|invalid_api_key|incorrect api key|insufficient_quota|billing|no openai key|does not have access|model_not_found/i.test(
    reason,
  );
}

export function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} took longer than ${Math.round(ms / 1000)}s`)),
      ms,
    );
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

export async function readPages(
  pages: number[],
  readOne: ReadOne,
  options: {
    timeoutMs: number;
    /** Extra tries after the first. */
    retries: number;
    onProgress?: (info: { page: number; index: number; total: number; attempt: number }) => void;
    shouldStop?: () => boolean;
    sleep?: (ms: number) => Promise<void>;
  },
): Promise<PageOutcome[]> {
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const outcomes: PageOutcome[] = [];
  let fatal = false;
  for (const [index, page] of pages.entries()) {
    if (fatal || options.shouldStop?.()) {
      outcomes.push({
        page,
        ok: false,
        reason: fatal
          ? "Not tried: an earlier page hit a problem retrying cannot fix."
          : "Stopped.",
        attempts: 0,
      });
      continue;
    }
    let reason = "";
    let ok = false;
    let attempts = 0;
    for (let attempt = 0; attempt <= options.retries; attempt += 1) {
      attempts += 1;
      options.onProgress?.({ page, index, total: pages.length, attempt: attempt + 1 });
      try {
        const result = await withTimeout(readOne(page), options.timeoutMs, `Page ${page}`);
        ok = result.ok;
        reason = result.ok ? "" : (result.reason ?? "The AI returned nothing for this page.");
      } catch (error) {
        ok = false;
        reason = error instanceof Error ? error.message : String(error);
      }
      if (ok) break;
      if (isFatalReason(reason)) {
        fatal = true;
        break;
      }
      if (attempt < options.retries) await sleep(1_500 * (attempt + 1));
    }
    outcomes.push({ page, ok, reason, attempts });
  }
  return outcomes;
}

/** "p3: reason | p7: reason" for the pages that failed. */
export function failureSummary(outcomes: PageOutcome[]) {
  return outcomes
    .filter((outcome) => !outcome.ok)
    .map((outcome) => `p${outcome.page}: ${outcome.reason}`)
    .join(" | ");
}

/** The pages of a window that are still unread: the window cannot be summarised until they are settled. */
export function unresolvedIn(unresolved: number[], from: number, to: number): number[] {
  return unresolved.filter((page) => page >= from && page <= to).sort((a, b) => a - b);
}
