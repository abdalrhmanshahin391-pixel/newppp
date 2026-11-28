import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { RitaConversation } from "@/lib/rita-conversation";
import {
  conversationCount,
  conversationDate,
  conversationTitle,
  messageCount,
} from "./conversation-labels.ts";

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
    assert.equal(conversationTitle(row(), "ar"), "محادثة جديدة");
    assert.equal(conversationTitle(row(), "en"), "New conversation");
    assert.equal(conversationTitle(row({ title: "  " }), "ar"), "محادثة جديدة");
  });

  test("a title the learner chose is kept, even if it is the default words", () => {
    assert.equal(conversationTitle(row({ title_is_custom: true }), "ar"), "New conversation");
    assert.equal(
      conversationTitle(row({ title: "مرحباً ريتا، كيف حالك؟" }), "en"),
      "مرحباً ريتا، كيف حالك؟",
    );
  });

  test("Arabic counts use one, two, the plural up to ten and the singular after", () => {
    assert.equal(messageCount(1, "ar"), "رسالة وحدة");
    assert.equal(messageCount(2, "ar"), "رسالتين");
    assert.equal(messageCount(10, "ar"), "10 رسائل");
    assert.equal(messageCount(12, "ar"), "12 رسالة");
    assert.equal(conversationCount(5, "ar"), "5 محادثات");
    assert.equal(conversationCount(11, "ar"), "11 محادثة");
  });

  test("English counts", () => {
    assert.equal(messageCount(1, "en"), "1 message");
    assert.equal(messageCount(34, "en"), "34 messages");
    assert.equal(conversationCount(1, "en"), "1 conversation");
  });

  test("dates use the last message, Latin digits, and the year only for older ones", () => {
    const year = new Date().getFullYear();
    const recent = row({ last_message_at: `${year}-03-05T12:00:00Z` });
    assert.equal(conversationDate(recent, "en"), "5 Mar");
    assert.match(conversationDate(recent, "ar"), /^5 /);
    assert.doesNotMatch(conversationDate(recent, "ar"), /[٠-٩]/);
    const old = row({ last_message_at: `${year - 1}-03-05T12:00:00Z` });
    assert.ok(conversationDate(old, "en").includes(String(year - 1)));
    assert.equal(conversationDate(row({ created_at: "not a date" }), "en"), "");
  });
});
