/** Shared successful data; a cold caller's timeout must never become cached data. */
export function createStartupCache<T>(
  load: () => Promise<T>,
  fallback: T,
  ttlMs: number,
  timeoutMs: number,
) {
  let cached: { at: number; data: T } | null = null;
  let inFlight: Promise<T> | null = null;
  let generation = 0;

  function refresh() {
    if (inFlight) return inFlight;
    const version = generation;
    const request = Promise.resolve()
      .then(load)
      .then((data) => {
        if (version === generation) cached = { at: Date.now(), data };
        return data;
      })
      .catch(() => cached?.data ?? fallback)
      .finally(() => {
        if (inFlight === request) inFlight = null;
      });
    inFlight = request;
    return request;
  }

  return {
    invalidate() {
      generation++;
      cached = null;
      inFlight = null;
    },
    async get(): Promise<T> {
      if (cached && Date.now() - cached.at < ttlMs) return cached.data;
      const request = refresh();
      // Warm workers serve their last successful settings without blocking navigation.
      if (cached) return cached.data;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          request,
          new Promise<T>((resolve) => {
            timer = setTimeout(() => resolve(fallback), timeoutMs);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
