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
  messages: Pick<RitaConversationMessage, "role" | "content" | "delivery_status">[],
  maxMessages = 24,
  maxCharacters = 12_000,
): RitaHistoryMessage[] {
  const selected: RitaHistoryMessage[] = [];
  let characters = 0;
  for (let index = messages.length - 1; index >= 0 && selected.length < maxMessages; index -= 1) {
    const message = messages[index];
    const content = message.content.trim().slice(0, 4_000);
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
