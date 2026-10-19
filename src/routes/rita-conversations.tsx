import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Download,
  FileJson,
  Loader2,
  MessageCircle,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { ProHeader } from "@/components/home/procreate/ProHeader";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  ritaConversationDiagnostic,
  ritaConversationFileStem,
  ritaConversationMarkdown,
  type RitaConversation,
  type RitaConversationMessage,
  type RitaConversationSession,
} from "@/lib/rita-conversation";

export const Route = createFileRoute("/rita-conversations")({
  head: () => ({
    meta: [{ title: "Rita conversations — RitaJet" }, { name: "robots", content: "noindex" }],
  }),
  component: RitaConversationsPage,
});

type Bundle = {
  conversation: RitaConversation;
  messages: RitaConversationMessage[];
  sessions: RitaConversationSession[];
};

function recentDate(value: string | null, fallback: string) {
  const date = new Date(value ?? fallback);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

async function loadBundle(conversation: RitaConversation): Promise<Bundle> {
  const pageSize = 500;
  const messages: RitaConversationMessage[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error: messagesError } = await supabase
      .from("rita_free_conversation_messages")
      .select(
        "id,client_message_id,conversation_id,session_id,role,content,generated_content,spoken_content,source,delivery_status,created_at",
      )
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (messagesError) throw messagesError;
    messages.push(...((data ?? []) as RitaConversationMessage[]));
    if ((data?.length ?? 0) < pageSize) break;
  }
  const { data: sessions, error: sessionsError } = await supabase
    .from("rita_v3_sessions")
    .select("id,status,error_code,started_at,connected_at,ended_at,model_proof")
    .eq("conversation_id", conversation.id)
    .order("started_at", { ascending: true });
  if (sessionsError) throw sessionsError;
  return {
    conversation,
    messages,
    sessions: (sessions ?? []) as RitaConversationSession[],
  };
}

async function saveFile(name: string, contents: string, type: string) {
  const file = new File([contents], name, { type });
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: name });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function RitaConversationsPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [conversations, setConversations] = useState<RitaConversation[]>([]);
  const [busy, setBusy] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Bundle | null>(null);
  const [opening, setOpening] = useState("");

  const refresh = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    setError("");
    const { data, error: queryError } = await supabase
      .from("rita_free_conversations")
      .select(
        "id,title,language_preference,dialect_preference,message_count,last_message_at,archived_at,created_at,updated_at",
      )
      .eq("user_id", user.id)
      .is("archived_at", null)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (queryError) setError(queryError.message);
    else setConversations((data ?? []) as RitaConversation[]);
    setBusy(false);
  }, [user]);

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/login" });
  }, [loading, navigate, user]);

  useEffect(() => {
    if (user) void refresh();
  }, [refresh, user]);

  const empty = useMemo(() => !busy && conversations.length === 0, [busy, conversations.length]);

  async function createConversation() {
    if (!user || creating) return;
    setCreating(true);
    setError("");
    const { data, error: insertError } = await supabase
      .from("rita_free_conversations")
      .insert({ user_id: user.id, title: "New conversation" })
      .select("id")
      .single();
    setCreating(false);
    if (insertError || !data?.id) {
      setError(insertError?.message ?? "Could not create the conversation.");
      return;
    }
    void navigate({ to: "/rita-live", search: { conversation: String(data.id) } });
  }

  async function openTranscript(conversation: RitaConversation) {
    setOpening(conversation.id);
    setError("");
    try {
      setSelected(await loadBundle(conversation));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load this conversation.");
    } finally {
      setOpening("");
    }
  }

  async function download(conversation: RitaConversation, format: "md" | "json") {
    setOpening(conversation.id);
    setError("");
    try {
      const bundle = await loadBundle(conversation);
      const stem = ritaConversationFileStem(conversation);
      if (format === "md") {
        await saveFile(
          `${stem}.md`,
          ritaConversationMarkdown(bundle.conversation, bundle.messages, bundle.sessions),
          "text/markdown;charset=utf-8",
        );
      } else {
        await saveFile(
          `${stem}.json`,
          `${JSON.stringify(
            ritaConversationDiagnostic(bundle.conversation, bundle.messages, bundle.sessions),
            null,
            2,
          )}\n`,
          "application/json;charset=utf-8",
        );
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not download this conversation.");
    } finally {
      setOpening("");
    }
  }

  async function removeConversation(conversation: RitaConversation) {
    if (!window.confirm(`Delete “${conversation.title}” and all of its saved messages?`)) return;
    const { error: deleteError } = await supabase
      .from("rita_free_conversations")
      .delete()
      .eq("id", conversation.id)
      .eq("user_id", user?.id ?? "");
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    if (selected?.conversation.id === conversation.id) setSelected(null);
    await refresh();
  }

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <main className="edith-premium min-h-screen bg-white text-[var(--pp-ink)]">
      <div className="rita-cream edith-light edith-premium">
        <ProHeader variant="solid" tone="light" />
      </div>
      <section className="mx-auto w-full max-w-5xl px-5 pb-20 pt-8 sm:px-8 sm:pt-12">
        <Link
          to="/rita"
          className="inline-flex items-center gap-2 text-[15px] font-semibold text-[var(--pp-muted)] hover:text-[var(--pp-ink)]"
        >
          <ArrowLeft size={17} /> Rita
        </Link>
        <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[13px] font-bold uppercase tracking-[0.16em] text-[var(--pp-muted)]">
              Free conversation
            </p>
            <h1 className="mt-2 text-[38px] leading-tight sm:text-[50px]">
              Your Rita conversations
            </h1>
            <p lang="ar" className="mt-2 text-[18px] font-semibold text-[var(--pp-muted)]">
              محادثاتك محفوظة وخاصة بحسابك.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void createConversation()}
            disabled={creating}
            className="rita-btn rita-btn-primary gap-2 disabled:opacity-50"
          >
            {creating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            New conversation
          </button>
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {busy ? (
          <div className="grid min-h-56 place-items-center">
            <Loader2 className="animate-spin text-[var(--pp-muted)]" />
          </div>
        ) : null}

        {empty ? (
          <div className="mt-8 rounded-2xl bg-[var(--pp-grey)] p-8 text-center sm:p-12">
            <MessageCircle className="mx-auto text-[var(--pp-muted)]" size={34} />
            <h2 className="mt-4 text-2xl">No saved conversations yet</h2>
            <p className="mt-2 text-[var(--pp-muted)]">
              Start one and every completed turn will save automatically.
            </p>
          </div>
        ) : null}

        <div className="mt-8 grid gap-4">
          {conversations.map((conversation) => (
            <article
              key={conversation.id}
              className="rounded-2xl border border-[var(--pp-line)] p-5 sm:p-6"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => void openTranscript(conversation)}
                  className="min-w-0 text-left"
                >
                  <h2 className="truncate text-xl font-semibold">{conversation.title}</h2>
                  <p className="mt-1 text-sm text-[var(--pp-muted)]">
                    {recentDate(conversation.last_message_at, conversation.created_at)} ·{" "}
                    {conversation.message_count}{" "}
                    {conversation.message_count === 1 ? "message" : "messages"}
                  </p>
                </button>
                <div className="flex flex-wrap gap-2">
                  <Link
                    to="/rita-live"
                    search={{ conversation: conversation.id }}
                    className="rita-btn rita-btn-primary"
                  >
                    Continue
                  </Link>
                  <button
                    type="button"
                    onClick={() => void download(conversation, "md")}
                    className="rita-btn rita-btn-secondary gap-2"
                  >
                    {opening === conversation.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Download size={16} />
                    )}
                    AI file
                  </button>
                  <button
                    type="button"
                    onClick={() => void download(conversation, "json")}
                    className="rita-btn rita-btn-secondary gap-2"
                    aria-label="Download diagnostic JSON"
                  >
                    <FileJson size={16} /> JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeConversation(conversation)}
                    className="rita-btn rita-btn-secondary text-red-600"
                    aria-label={`Delete ${conversation.title}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/30 p-0 sm:items-center sm:justify-center sm:p-6">
          <section className="max-h-[90vh] w-full overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-3xl sm:rounded-3xl">
            <div className="flex items-start justify-between border-b border-[var(--pp-line)] p-5 sm:p-6">
              <div className="min-w-0">
                <h2 className="truncate text-2xl font-semibold">{selected.conversation.title}</h2>
                <p className="mt-1 text-sm text-[var(--pp-muted)]">
                  {selected.messages.length} saved messages
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-full p-2 hover:bg-[var(--pp-grey)]"
              >
                <X size={20} />
              </button>
            </div>
            <div className="max-h-[65vh] space-y-4 overflow-y-auto p-5 sm:p-6">
              {selected.messages.length ? (
                selected.messages.map((message) => (
                  <div
                    key={message.client_message_id}
                    className={`max-w-[88%] rounded-2xl px-4 py-3 ${
                      message.role === "user" ? "ml-auto bg-blue-50" : "bg-[var(--pp-grey)]"
                    }`}
                  >
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--pp-muted)]">
                      {message.role === "user" ? "You" : "Rita"}
                      {message.delivery_status !== "completed"
                        ? ` · ${message.delivery_status}`
                        : ""}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-[16px] leading-7" dir="auto">
                      {message.content}
                    </p>
                  </div>
                ))
              ) : (
                <p className="py-12 text-center text-[var(--pp-muted)]">
                  This conversation has no saved messages yet.
                </p>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
