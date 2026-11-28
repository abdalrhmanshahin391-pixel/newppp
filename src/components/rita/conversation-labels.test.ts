import { describe, expect, test } from "bun:test";
import type { RitaConversation } from "@/lib/rita-conversation";
import {
  conversationCount,
  conversationDate,
  conversationTitle,
  messageCount,
} from "./conversation-labels";

const row = (patch: Partial<RitaConversation> = {}): RitaConversation => ({
  id: "c1",
  title: "New conversation",
  title_is_custom: false,
  language_preference: "auto",
  dialect_preference: "auto",
  message_count: 0,
  last_message_at: null,
  archived_at: null,
  created_at: "2026-11-16T10:00:00Z",
  updated_at: "2026-11-16T10:00:00Z",
  ...patch,
});

describe("conversation labels", () => {
  test("the untouched default title follows the page's language", () => {
    expect(conversationTitle(row(), "ar")).toBe("محادثة جديدة");
    expect(conversationTitle(row(), "en")).toBe("New conversation");
    expect(conversationTitle(row({ title: "  " }), "ar")).toBe("محادثة جديدة");
  });

  test("a title the learner chose is kept, even if it is the default words", () => {
    expect(conversationTitle(row({ title_is_custom: true }), "ar")).toBe("New conversation");
    expect(conversationTitle(row({ title: "مرحباً ريتا، كيف حالك؟" }), "en")).toBe(
      "مرحباً ريتا، كيف حالك؟",
    );
  });

  test("Arabic counts use one, two, the plural up to ten and the singular after", () => {
    expect(messageCount(1, "ar")).toBe("رسالة وحدة");
    expect(messageCount(2, "ar")).toBe("رسالتين");
    expect(messageCount(10, "ar")).toBe("10 رسائل");
    expect(messageCount(12, "ar")).toBe("12 رسالة");
    expect(conversationCount(5, "ar")).toBe("5 محادثات");
    expect(conversationCount(11, "ar")).toBe("11 محادثة");
  });

  test("English counts", () => {
    expect(messageCount(1, "en")).toBe("1 message");
    expect(messageCount(34, "en")).toBe("34 messages");
    expect(conversationCount(1, "en")).toBe("1 conversation");
  });

  test("dates use the last message, Latin digits, and the year only for older ones", () => {
    const year = new Date().getFullYear();
    const recent = row({ last_message_at: `${year}-03-05T12:00:00Z` });
    expect(conversationDate(recent, "en")).toMatch(/^5 Mar$/);
    expect(conversationDate(recent, "ar")).toMatch(/^5 /);
    expect(conversationDate(recent, "ar")).not.toMatch(/[٠-٩]/);
    const old = row({ last_message_at: `${year - 1}-03-05T12:00:00Z` });
    expect(conversationDate(old, "en")).toContain(String(year - 1));
    expect(conversationDate(row({ created_at: "not a date" }), "en")).toBe("");
  });
});
