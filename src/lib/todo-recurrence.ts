// Tiny repeat engine. Only the *next* instance is ever created, so a daily
// task never fills the store with a year of rows.
//
// Rule strings (lower case, stored on the task):
//   daily | weekdays | weekly | monthly | yearly
//   every:3            -> every 3 days
//   days:mon,thu       -> every Monday and Thursday

import { addDays, dateOf, iso } from "./todo-store";

const WEEK = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function repeatLabel(rule?: string): string | null {
  if (!rule) return null;
  if (rule === "daily") return "Every day";
  if (rule === "weekdays") return "Every weekday";
  if (rule === "weekly") return "Every week";
  if (rule === "monthly") return "Every month";
  if (rule === "yearly") return "Every year";
  if (rule.startsWith("every:")) return `Every ${rule.slice(6)} days`;
  if (rule.startsWith("days:")) {
    const names = rule
      .slice(5)
      .split(",")
      .map((d) => d.charAt(0).toUpperCase() + d.slice(1));
    return `Every ${names.join(" & ")}`;
  }
  return null;
}

/** The day after `from` that matches the rule, or null when the rule is unknown. */
export function nextDue(fromIso: string, rule?: string): string | null {
  if (!rule) return null;
  if (rule === "daily") return addDays(fromIso, 1);
  if (rule === "weekly") return addDays(fromIso, 7);
  if (rule === "weekdays") {
    let next = addDays(fromIso, 1);
    for (let i = 0; i < 7; i++) {
      const dow = dateOf(next).getDay();
      if (dow !== 0 && dow !== 6) return next;
      next = addDays(next, 1);
    }
    return next;
  }
  if (rule === "monthly") {
    const d = dateOf(fromIso);
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    return iso(d);
  }
  if (rule === "yearly") {
    const d = dateOf(fromIso);
    d.setFullYear(d.getFullYear() + 1);
    return iso(d);
  }
  if (rule.startsWith("every:")) {
    const n = Math.max(1, Math.min(365, Number(rule.slice(6)) || 1));
    return addDays(fromIso, n);
  }
  if (rule.startsWith("days:")) {
    const wanted = new Set(rule.slice(5).split(","));
    let next = addDays(fromIso, 1);
    for (let i = 0; i < 7; i++) {
      if (wanted.has(WEEK[dateOf(next).getDay()])) return next;
      next = addDays(next, 1);
    }
    return null;
  }
  return null;
}
