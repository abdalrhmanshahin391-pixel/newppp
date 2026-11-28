// The words and numbers «My conversations» shows for a conversation: its name, when it was last
// used and how many messages it has, in English or in Arabic (with Latin digits, like the rest of
// the page's Arabic).
import type { RitaConversation } from "@/lib/rita-conversation";

type Ui = "en" | "ar";

/** The name a new conversation gets before the learner (or Uzyra) names it. */
export const DEFAULT_CONVERSATION_TITLE = "New conversation";

export const numberLocale = (ui: Ui) => (ui === "ar" ? "ar-u-nu-latn" : "en");

/** When it was last used (its last message, or when it was made). */
export function conversationWhen(conversation: RitaConversation) {
  return Date.parse(conversation.last_message_at ?? conversation.created_at);
}

/** Its title, with the untouched default shown in the page's language. */
export function conversationTitle(conversation: RitaConversation, ui: Ui) {
  const title = conversation.title.trim();
  if (!title || (!conversation.title_is_custom && title === DEFAULT_CONVERSATION_TITLE))
    return ui === "ar" ? "محادثة جديدة" : DEFAULT_CONVERSATION_TITLE;
  return title;
}

/** «12:29 PM» for today, «28 Nov» this year, «28 Nov 2025» before. */
export function conversationDate(conversation: RitaConversation, ui: Ui, today = false) {
  const date = new Date(conversationWhen(conversation));
  if (Number.isNaN(date.getTime())) return "";
  if (today) return new Intl.DateTimeFormat(numberLocale(ui), { timeStyle: "short" }).format(date);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  // Day before month in English too («28 Nov»).
  return new Intl.DateTimeFormat(ui === "ar" ? numberLocale(ui) : "en-GB", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(date);
}

/** Arabic counts: one and two have their own words, 3–10 take the plural, 11 and up the singular. */
function arabicCount(n: number, one: string, two: string, few: string, many: string) {
  if (n === 1) return one;
  if (n === 2) return two;
  const number = n.toLocaleString(numberLocale("ar"));
  return n >= 3 && n <= 10 ? `${number} ${few}` : `${number} ${many}`;
}

export function messageCount(n: number, ui: Ui) {
  if (ui === "ar") return arabicCount(n, "رسالة وحدة", "رسالتين", "رسائل", "رسالة");
  return `${n.toLocaleString("en")} ${n === 1 ? "message" : "messages"}`;
}

export function conversationCount(n: number, ui: Ui) {
  if (ui === "ar") return arabicCount(n, "محادثة وحدة", "محادثتين", "محادثات", "محادثة");
  return `${n.toLocaleString("en")} ${n === 1 ? "conversation" : "conversations"}`;
}
