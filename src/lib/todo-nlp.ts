// Local natural-language parsing for the quick-add box.
// No AI call, no network: instant, offline, free.
//
//   "revise anatomy tomorrow 6pm !!"     -> due tomorrow, 18:00, urgent
//   "gym every monday @health"           -> repeats Mondays, label health
//   "exam 12 Oct p1"                     -> due 12 Oct, urgent

import { addDays, dateOf, iso, today, type PriorityKey } from "./todo-store";

export type Parsed = {
  title: string;
  due?: string;
  time?: string;
  repeat?: string;
  priority?: PriorityKey;
  labels?: string[];
};

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const SHORT_DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function nextWeekday(index: number, skipToday: boolean) {
  const base = new Date();
  const cur = base.getDay();
  let delta = (index - cur + 7) % 7;
  if (delta === 0 && skipToday) delta = 7;
  return addDays(today(), delta);
}

function clean(s: string) {
  return s.replace(/\s{2,}/g, " ").trim();
}

export function parseTask(input: string): Parsed {
  let text = ` ${input} `;
  const out: Parsed = { title: input.trim() };

  const eat = (re: RegExp, keep = "") => {
    const m = text.match(re);
    if (!m) return null;
    text = text.replace(m[0], keep ? ` ${keep} ` : " ");
    return m;
  };

  // labels: @word
  const labels: string[] = [];
  let lm: RegExpMatchArray | null;
  while ((lm = text.match(/\s@([\p{L}\d_-]{1,24})\b/u))) {
    labels.push(lm[1].toLowerCase());
    text = text.replace(lm[0], " ");
  }
  if (labels.length) out.labels = [...new Set(labels)];

  // priority: !!! / !! / ! or p1..p4
  if (eat(/\s(?:!{2,3}|p1)(?=\s|$)/i)) out.priority = "urgent";
  else if (eat(/\s(?:!|p2)(?=\s|$)/i)) out.priority = "important";
  else if (eat(/\sp3(?=\s|$)/i)) out.priority = "low";
  else if (eat(/\sp4(?=\s|$)/i)) out.priority = "none";
  if (eat(/\burgent\b/i, "urgent")) out.priority = out.priority ?? "urgent";

  // repeat
  const everyN = eat(/\bevery\s+(\d{1,3})\s+days?\b/i);
  if (everyN) out.repeat = `every:${everyN[1]}`;
  if (!out.repeat && eat(/\bevery\s+(?:week)?day\b/i)) out.repeat = "daily";
  if (!out.repeat && eat(/\bdaily\b/i)) out.repeat = "daily";
  if (!out.repeat && eat(/\bevery\s+weekdays?\b/i)) out.repeat = "weekdays";
  if (!out.repeat && eat(/\b(?:every\s+week|weekly)\b/i)) out.repeat = "weekly";
  if (!out.repeat && eat(/\b(?:every\s+month|monthly)\b/i)) out.repeat = "monthly";
  if (!out.repeat && eat(/\b(?:every\s+year|yearly)\b/i)) out.repeat = "yearly";
  if (!out.repeat) {
    const dayList = text.match(
      /\bevery\s+((?:mon|tues?|wed(?:nes)?|thur?s?|fri|sat(?:ur)?|sun)(?:day)?(?:\s*(?:,|and|&)\s*(?:mon|tues?|wed(?:nes)?|thur?s?|fri|sat(?:ur)?|sun)(?:day)?)*)\b/i,
    );
    if (dayList) {
      const names = dayList[1]
        .split(/\s*(?:,|and|&)\s*/i)
        .map((n) => n.slice(0, 3).toLowerCase())
        .filter((n) => SHORT_DAYS.includes(n));
      if (names.length) {
        out.repeat = `days:${[...new Set(names)].join(",")}`;
        out.due = nextWeekday(SHORT_DAYS.indexOf(names[0]), false);
        text = text.replace(dayList[0], " ");
      }
    }
  }

  // time: 6pm / 6:30pm / 18:00 / at 7
  const t12 = eat(/\s(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (t12) {
    let h = Number(t12[1]) % 12;
    if (t12[3].toLowerCase() === "pm") h += 12;
    out.time = `${String(h).padStart(2, "0")}:${t12[2] ?? "00"}`;
  } else {
    const t24 = eat(/\s(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/);
    if (t24) out.time = `${t24[1].padStart(2, "0")}:${t24[2]}`;
  }

  // dates
  if (!out.due) {
    if (eat(/\btoday\b/i) || eat(/\btonight\b/i)) out.due = today();
    else if (eat(/\btomorrow\b/i) || eat(/\btmr?w?\b/i)) out.due = addDays(today(), 1);
    else if (eat(/\bnext\s+week\b/i)) out.due = addDays(today(), 7);
    else if (eat(/\bnext\s+month\b/i)) {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      out.due = iso(d);
    } else {
      const inDays = eat(/\bin\s+(\d{1,3})\s+(day|week|month)s?\b/i);
      if (inDays) {
        const n = Number(inDays[1]);
        if (inDays[2].toLowerCase() === "day") out.due = addDays(today(), n);
        else if (inDays[2].toLowerCase() === "week") out.due = addDays(today(), n * 7);
        else {
          const d = new Date();
          d.setMonth(d.getMonth() + n);
          out.due = iso(d);
        }
      }
    }
  }

  if (!out.due) {
    const wd = text.match(
      /\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i,
    );
    if (wd) {
      out.due = nextWeekday(DAYS.indexOf(wd[2].toLowerCase()), true);
      text = text.replace(wd[0], " ");
    }
  }

  if (!out.due) {
    // 12 Oct / Oct 12 / 12 October 2027
    const dm = text.match(
      /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:\s+(\d{4}))?\b/i,
    );
    const md = text.match(
      /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:\s+(\d{4}))?\b/i,
    );
    const numeric = text.match(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/);
    const build = (day: number, month: number, year?: number) => {
      const now = new Date();
      let y = year ?? now.getFullYear();
      if (y < 100) y += 2000;
      let d = new Date(y, month, day);
      if (!year && d < new Date(now.getFullYear(), now.getMonth(), now.getDate()))
        d = new Date(y + 1, month, day);
      return Number.isNaN(d.getTime()) ? undefined : iso(d);
    };
    if (dm) {
      out.due = build(
        Number(dm[1]),
        MONTHS.findIndex((m) => m.startsWith(dm[2].toLowerCase())),
        dm[3] ? Number(dm[3]) : undefined,
      );
      text = text.replace(dm[0], " ");
    } else if (md) {
      out.due = build(
        Number(md[2]),
        MONTHS.findIndex((m) => m.startsWith(md[1].toLowerCase())),
        md[3] ? Number(md[3]) : undefined,
      );
      text = text.replace(md[0], " ");
    } else if (numeric) {
      out.due = build(
        Number(numeric[1]),
        Number(numeric[2]) - 1,
        numeric[3] ? Number(numeric[3]) : undefined,
      );
      text = text.replace(numeric[0], " ");
    }
  }

  if (out.repeat && !out.due) out.due = today();

  const title = clean(text.replace(/\s+(on|at|by)\s*$/i, ""));
  out.title = title || input.trim();
  return out;
}

/** Human summary of what the parser found, shown as chips under the input. */
export function parsedChips(p: Parsed): string[] {
  const chips: string[] = [];
  if (p.due) chips.push(dateOf(p.due).toLocaleDateString(undefined, { day: "numeric", month: "short" }));
  if (p.time) chips.push(p.time);
  if (p.priority && p.priority !== "none") chips.push(p.priority);
  for (const l of p.labels ?? []) chips.push(`@${l}`);
  return chips;
}
