export type RitaConversationRole = "user" | "assistant";
export type RitaConversationSource = "voice" | "text" | "scripted";
export type RitaConversationDelivery = "completed" | "interrupted" | "incomplete";

export type RitaConversation = {
  id: string;
  title: string;
  language_preference: string;
  dialect_preference: string;
  message_count: number;
  last_message_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RitaConversationMessage = {
  id?: number;
  client_message_id: string;
  conversation_id: string;
  session_id: string | null;
  role: RitaConversationRole;
  content: string;
  generated_content: string | null;
  spoken_content: string | null;
  source: RitaConversationSource;
  delivery_status: RitaConversationDelivery;
  created_at: string;
};

export type RitaConversationSession = {
  id: string;
  status: string;
  error_code: string | null;
  started_at: string;
  connected_at: string | null;
  ended_at: string | null;
  model_proof: unknown;
};

export type RitaHistoryMessage = { role: RitaConversationRole; content: string };

/**
 * Resume with a small verbatim tail. The complete transcript stays available
 * for export, but never grows the realtime Groq request without a bound.
 */
export function boundedRitaHistory(
  messages: Pick<
    RitaConversationMessage,
    "role" | "content" | "spoken_content" | "delivery_status"
  >[],
  maxMessages = 24,
  maxCharacters = 12_000,
): RitaHistoryMessage[] {
  const selected: RitaHistoryMessage[] = [];
  let characters = 0;
  for (let index = messages.length - 1; index >= 0 && selected.length < maxMessages; index -= 1) {
    const message = messages[index];
    // The model may have generated more than the learner heard before an interruption.
    // Resume only from shared conversational ground.
    const source =
      message.role === "assistant" && message.delivery_status === "interrupted"
        ? (message.spoken_content ?? "")
        : message.content;
    const content = source.trim().slice(0, 4_000);
    if (!content || message.delivery_status === "incomplete") continue;
    const remaining = maxCharacters - characters;
    if (remaining <= 0) break;
    const clipped =
      content.length > remaining ? content.slice(content.length - remaining) : content;
    selected.push({ role: message.role, content: clipped });
    characters += clipped.length;
  }
  return selected.reverse();
}

function displayRole(role: RitaConversationRole) {
  return role === "user" ? "User" : "Rita";
}

function localTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

export function ritaConversationMarkdown(
  conversation: RitaConversation,
  messages: RitaConversationMessage[],
  sessions: RitaConversationSession[] = [],
) {
  const lines = [
    "# Rita Free Conversation",
    "",
    `Title: ${conversation.title}`,
    `Created: ${localTimestamp(conversation.created_at)}`,
    `Language preference: ${conversation.language_preference}`,
    `Dialect preference: ${conversation.dialect_preference}`,
    `Voice sessions: ${sessions.length}`,
    "",
  ];
  let activeSession = "";
  let sessionNumber = 0;
  for (const message of messages) {
    const sessionKey = message.session_id ?? "unspecified";
    if (sessionKey !== activeSession) {
      activeSession = sessionKey;
      sessionNumber += 1;
      lines.push(`## Session ${sessionNumber}`, "");
    }
    const flags = [
      message.source !== "voice" ? message.source : "",
      message.delivery_status !== "completed" ? message.delivery_status : "",
    ].filter(Boolean);
    lines.push(
      `### ${displayRole(message.role)} — ${localTimestamp(message.created_at)}${flags.length ? ` (${flags.join(", ")})` : ""}`,
      "",
      message.content,
      "",
    );
    if (
      message.role === "assistant" &&
      message.spoken_content &&
      message.spoken_content.trim() !== message.content.trim()
    ) {
      lines.push(`Spoken to the learner: ${message.spoken_content.trim()}`, "");
    }
    if (
      message.role === "assistant" &&
      message.generated_content &&
      message.generated_content.trim() !== message.content.trim()
    ) {
      lines.push(
        `Full model output before playback/interruption: ${message.generated_content.trim()}`,
        "",
      );
    }
  }
  if (!messages.length) lines.push("_No messages were saved._", "");
  return `${lines.join("\n").trim()}\n`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function printTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    date,
  );
}

const PRINT_CSS = `
@page { size: A4; margin: 16mm 14mm; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #fff; color: #111; }
body { font: 15px/1.7 system-ui, "Segoe UI", Tahoma, "Noto Sans Arabic", "DejaVu Sans", sans-serif; padding: 24px; max-width: 760px; margin: 0 auto; }
h1 { font-size: 24px; line-height: 1.25; margin: 0 0 6px; }
.meta { color: #555; font-size: 13px; margin: 0 0 20px; }
h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .08em; color: #555; margin: 28px 0 10px; border-bottom: 1px solid #ccc; padding-bottom: 4px; break-after: avoid; }
.m { margin: 0 0 12px; padding: 6px 0 6px 14px; border-left: 4px solid #111; break-inside: avoid; }
.m.user { border-left-color: #1d4ed8; }
.who { margin: 0; font-size: 12px; font-weight: 700; color: #444; }
.m.user .who { color: #1d4ed8; }
.who span { font-weight: 400; color: #666; }
.text { margin: 2px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.note { margin: 4px 0 0; font-size: 13px; color: #555; white-space: pre-wrap; overflow-wrap: anywhere; }
.empty { color: #555; font-style: italic; }
.bar { position: sticky; top: 0; display: flex; justify-content: flex-end; padding: 8px 0 16px; background: #fff; }
.bar button { font: inherit; font-weight: 600; padding: 8px 16px; border-radius: 8px; border: 1px solid #111; background: #111; color: #fff; cursor: pointer; }
@media print { .bar { display: none; } body { padding: 0; max-width: none; } }
`;

/**
 * A self-contained, light, print-first document of the same transcript the
 * markdown export holds. Role is carried by a label and a border (browsers drop
 * backgrounds when printing), and every message sets dir="auto" so Arabic and
 * German lines each run the right way. All text is escaped.
 */
export function ritaConversationPrintHtml(
  conversation: RitaConversation,
  messages: RitaConversationMessage[],
  sessions: RitaConversationSession[] = [],
) {
  const parts: string[] = [];
  let activeSession = "";
  let sessionNumber = 0;
  for (const message of messages) {
    const sessionKey = message.session_id ?? "unspecified";
    if (sessionKey !== activeSession) {
      activeSession = sessionKey;
      sessionNumber += 1;
      parts.push(`<h2>Session ${sessionNumber}</h2>`);
    }
    const flags = [
      message.source !== "voice" ? message.source : "",
      message.delivery_status !== "completed" ? message.delivery_status : "",
    ].filter(Boolean);
    const who = message.role === "user" ? "You" : "Rita";
    const spoken =
      message.role === "assistant" &&
      message.spoken_content &&
      message.spoken_content.trim() !== message.content.trim()
        ? `<p class="note" dir="auto">Heard by the learner: ${escapeHtml(message.spoken_content.trim())}</p>`
        : "";
    parts.push(
      `<article class="m ${message.role === "user" ? "user" : "rita"}">` +
        `<p class="who">${who} <span>${escapeHtml(printTimestamp(message.created_at))}${
          flags.length ? ` · ${escapeHtml(flags.join(", "))}` : ""
        }</span></p>` +
        `<p class="text" dir="auto">${escapeHtml(message.content)}</p>${spoken}</article>`,
    );
  }
  if (!messages.length) parts.push(`<p class="empty">No messages were saved.</p>`);
  const title = escapeHtml(conversation.title);
  return (
    `<!doctype html><html><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${escapeHtml(ritaConversationFileStem(conversation))}</title>` +
    `<style>${PRINT_CSS}</style></head><body>` +
    `<div class="bar"><button type="button" onclick="window.print()">Print / Save as PDF</button></div>` +
    `<h1 dir="auto">${title}</h1>` +
    `<p class="meta">${escapeHtml(printTimestamp(conversation.created_at))} · ${messages.length} messages · ${sessions.length} voice sessions</p>` +
    `${parts.join("")}</body></html>`
  );
}

export function ritaConversationDiagnostic(
  conversation: RitaConversation,
  messages: RitaConversationMessage[],
  sessions: RitaConversationSession[] = [],
) {
  return {
    schemaVersion: 1,
    purpose: "Rita free-conversation quality review",
    privacy: {
      rawAudioIncluded: false,
      credentialsIncluded: false,
      chainOfThoughtIncluded: false,
    },
    conversation: {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
      languagePreference: conversation.language_preference,
      dialectPreference: conversation.dialect_preference,
    },
    sessions: sessions.map((session) => ({
      id: session.id,
      status: session.status,
      errorCode: session.error_code,
      startedAt: session.started_at,
      connectedAt: session.connected_at,
      endedAt: session.ended_at,
      models: session.model_proof,
    })),
    messages: messages.map((message) => ({
      id: message.client_message_id,
      sessionId: message.session_id,
      role: message.role,
      text: message.content,
      generatedText: message.generated_content,
      spokenText: message.spoken_content,
      source: message.source,
      deliveryStatus: message.delivery_status,
      createdAt: message.created_at,
    })),
  };
}

export function ritaConversationFileStem(conversation: Pick<RitaConversation, "title" | "id">) {
  const title = conversation.title
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `rita-${title || "conversation"}-${conversation.id.slice(0, 8)}`;
}
