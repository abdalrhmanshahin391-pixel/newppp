import { onCLS, onINP, onLCP, type Metric } from "web-vitals";

let started = false;

// Web Vitals describe a document visit, including interactions after client navigation.
// Record the entry route template only; keep the observations in the local performance timeline.
export function observePageVitals(entryRoute: string) {
  if (started) return;
  started = true;
  const viewport = window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop";
  function record(metric: Metric) {
    const name = "uzyra.vitals." + metric.name;
    performance.clearMarks(name);
    performance.mark(name, {
      detail: { value: metric.value, rating: metric.rating, entryRoute, viewport },
    });
  }
  onLCP(record, { reportAllChanges: true });
  onCLS(record, { reportAllChanges: true });
  onINP(record, { reportAllChanges: true });
}
