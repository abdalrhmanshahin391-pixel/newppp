/**
 * A bounded queue for the page's diagnostic events. Events wait here and leave in batches, instead
 * of one network request per event during a conversation. When it is full the oldest event is
 * dropped and counted, so the loss is always visible and memory stays bounded.
 */

export type QueuedMetric = {
  eventId: string;
  sessionId: string;
  name: string;
  valueMs?: number;
  metadata: Record<string, unknown>;
  attempts: number;
};

export type NewMetric = Omit<QueuedMetric, "eventId" | "attempts">;

export class MetricQueue {
  private items: QueuedMetric[] = [];
  private lost = 0;

  private readonly maxSize: number;
  private readonly maxBatch: number;
  private readonly maxAttempts: number;

  constructor(maxSize = 500, maxBatch = 25, maxAttempts = 3) {
    this.maxSize = maxSize;
    this.maxBatch = maxBatch;
    this.maxAttempts = maxAttempts;
  }

  get size() {
    return this.items.length;
  }

  /** How many events were dropped since the last time the count was taken. */
  get dropped() {
    return this.lost;
  }

  takeDroppedCount() {
    const count = this.lost;
    this.lost = 0;
    return count;
  }

  /** Time for a batch to leave right away rather than wait for the timer. */
  get full() {
    return this.items.length >= this.maxBatch;
  }

  push(metric: NewMetric, eventId: string) {
    this.items.push({ ...metric, eventId, attempts: 0 });
    this.trim();
  }

  /** Up to one batch of events of the same session, oldest first, removed from the queue. */
  takeBatch(): QueuedMetric[] {
    if (this.items.length === 0) return [];
    const sessionId = this.items[0].sessionId;
    const batch: QueuedMetric[] = [];
    const rest: QueuedMetric[] = [];
    for (const item of this.items) {
      if (item.sessionId === sessionId && batch.length < this.maxBatch) batch.push(item);
      else rest.push(item);
    }
    this.items = rest;
    return batch;
  }

  /** A batch that could not be sent goes back to the front; an event that keeps failing is dropped. */
  requeue(batch: QueuedMetric[]) {
    const again = batch
      .map((item) => ({ ...item, attempts: item.attempts + 1 }))
      .filter((item) => {
        if (item.attempts < this.maxAttempts) return true;
        this.lost += 1;
        return false;
      });
    this.items = [...again, ...this.items];
    this.trim();
  }

  clear() {
    this.items = [];
  }

  private trim() {
    const extra = this.items.length - this.maxSize;
    if (extra > 0) {
      this.items.splice(0, extra);
      this.lost += extra;
    }
  }
}
