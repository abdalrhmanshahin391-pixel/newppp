import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2, MessageCircle, Plus, X } from "lucide-react";
import { ProHeader } from "@/components/home/procreate/ProHeader";
import { useAuth } from "@/hooks/useAuth";
import { LanguageGate } from "@/components/language/LanguageGate";
import {
  dbLanguage,
  getLegacyLanguage,
  useDbLanguage,
  useLanguageResolved,
} from "@/lib/language-scope";
import { languageFilter } from "@/lib/learning-language";
import { supabase } from "@/integrations/supabase/client";
import {
  ritaConversationDiagnostic,
  ritaConversationFileStem,
  ritaConversationMarkdown,
  ritaConversationPrintHtml,
  type RitaConversation,
  type RitaConversationMessage,
  type RitaConversationSession,
} from "@/lib/rita-conversation";
import { saveFile } from "@/lib/save-file";
import { AdminBar } from "@/components/rita-quality/AdminBar";
import { ConversationMenu } from "@/components/rita/ConversationMenu";
import { reviewCounts, reviewMark } from "@/lib/rita-quality-next";
import { ritaRepairFile, ritaRepairFileName } from "@/lib/rita-issue-report";
import {
  MAX_STEPS,
  decideStep,
  progressText,
  type ReviewProgress,
  type StepAnswer,
} from "@/lib/rita-review-steps";

export const Route = createFileRoute("/rita-conversations")({
  head: () => ({
    meta: [{ title: "Rita conversations — Uzyra" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <LanguageGate>
      <RitaConversationsPage />
    </LanguageGate>
  ),
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

// The worker's turn records and the learner's reports for one conversation. The reports table
// comes with a migration; until it is applied the file is still made, without reports.
async function loadRepairData(bundle: Bundle) {
  const sessionIds = bundle.sessions.map((session) => session.id);
  const events: {
    session_id: string;
    event_name: string;
    value_ms: number | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }[] = [];
  if (sessionIds.length) {
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from("rita_v3_events")
        .select("session_id,event_name,value_ms,metadata,created_at")
        .in("session_id", sessionIds)
        .eq("event_name", "turn_ledger")
        .order("created_at", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      events.push(...((data ?? []) as unknown as typeof events));
      if ((data?.length ?? 0) < pageSize) break;
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: reports, error: reportsError } = await (supabase as any)
    .from("rita_issue_reports")
    .select("id,reply_message_id,turn_ref,category,note,build,ledger,created_at")
    .eq("conversation_id", bundle.conversation.id)
    .order("created_at", { ascending: true });
  // Only admins can read the reviews; for everybody else this is empty.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: reviews, error: reviewsError } = await (supabase as any)
    .from("rita_turn_reviews")
    .select(
      "id,reply_message_id,turn_ref,trigger,status,verdict,severity,category,cause,evidence,suggestion,model,reviewed_at,rubric_version,explanation,reference_reply,reference_why,winner,scores,facts,dialect,timing,fix",
    )
    .eq("conversation_id", bundle.conversation.id)
    .order("created_at", { ascending: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conversationReview } = await (supabase as any)
    .from("rita_conversation_reviews")
    .select("status,rubric_version,turns_reviewed,model,stats,data,reviewed_at")
    .eq("conversation_id", bundle.conversation.id)
    .maybeSingle();
  return {
    events,
    reports: reportsError ? [] : (reports ?? []),
    reviews: reviewsError ? [] : (reviews ?? []),
    conversationReview: conversationReview?.status === "done" ? conversationReview : null,
  };
}

// One step of the admin's "review now" (see /api/rita-v3/review). A step never waits more than two
// and a half minutes: a request that hangs ends with a clear message instead of a spinner forever.
async function reviewStep(conversationId: string): Promise<StepAnswer | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: "Sign in again to run the review." };
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 150_000);
  try {
    const response = await fetch("/api/rita-v3/review", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId }),
      signal: controller.signal,
    });
    const body = (await response.json().catch(() => null)) as StepAnswer | null;
    if (!response.ok && !body?.error) {
      return { ok: false, error: `The server answered ${response.status}.` };
    }
    return body;
  } catch (cause) {
    return {
      ok: false,
      error:
        cause instanceof DOMException && cause.name === "AbortError"
          ? "One step took longer than 2.5 minutes. Press Review again to carry on"
          : "The connection dropped. Press Review again to carry on",
    };
  } finally {
    window.clearTimeout(timer);
  }
}

// Printed from a bare document, so none of the app's print rules (which hide
// or recolour the page) can touch the transcript.
function printInFrame(html: string) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  frame.srcdoc = html;
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 60_000);
  };
  document.body.appendChild(frame);
}

function RitaConversationsPage() {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const [conversations, setConversations] = useState<RitaConversation[]>([]);
  const [busy, setBusy] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  // The admin's AI review per conversation in this visit (it runs in steps, see reviewStep).
  const [reviews, setReviews] = useState<Record<string, ReviewProgress>>({});
  const stopReview = useRef(new Set<string>());
  const [busyFormat, setBusyFormat] = useState("");
  const [selected, setSelected] = useState<Bundle | null>(null);
  const [opening, setOpening] = useState("");

  // Each language has its own conversations; wait until the learner's language is known.
  const language = useDbLanguage();
  const resolved = useLanguageResolved();

  const refresh = useCallback(async () => {
    if (!user || !resolved) return;
    setBusy(true);
    setError("");
    let query = supabase
      .from("rita_free_conversations")
      .select(
        "id,title,language_preference,dialect_preference,message_count,last_message_at,archived_at,created_at,updated_at",
      )
      .eq("user_id", user.id)
      .is("archived_at", null)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (language) {
      query = query.or(languageFilter(language, getLegacyLanguage(), "learning_language"));
    }
    const { data, error: queryError } = await query;
    if (queryError) setError(queryError.message);
    else setConversations((data ?? []) as RitaConversation[]);
    setBusy(false);
  }, [user, resolved, language]);

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/login" });
  }, [loading, navigate, user]);

  useEffect(() => {
    if (user) void refresh();
  }, [refresh, user]);

  // The admin sees, on each card, how many replies were reviewed and how many had a problem.
  const [marks, setMarks] = useState(
    () => new Map<string, { reviewed: number; problems: number }>(),
  );
  const [marksEpoch, setMarksEpoch] = useState(0);
  const refreshMarks = () => setMarksEpoch((value) => value + 1);
  useEffect(() => {
    if (!isAdmin || !conversations.length) return;
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (supabase as any)
      .from("rita_turn_reviews")
      .select("conversation_id,verdict")
      .eq("status", "done")
      .in(
        "conversation_id",
        conversations.map((conversation) => conversation.id),
      )
      .then(
        ({
          data,
          error: markError,
        }: {
          data: { conversation_id: string; verdict: string | null }[] | null;
          error: unknown;
        }) => {
          if (!cancelled && !markError) setMarks(reviewCounts(data ?? []));
        },
      );
    return () => {
      cancelled = true;
    };
  }, [conversations, isAdmin, marksEpoch]);

  const empty = useMemo(() => !busy && conversations.length === 0, [busy, conversations.length]);

  async function createConversation() {
    if (!user || creating) return;
    setCreating(true);
    setError("");
    const { data, error: insertError } = await supabase
      .from("rita_free_conversations")
      .insert({
        user_id: user.id,
        title: "New conversation",
        ...(dbLanguage() ? { learning_language: dbLanguage() } : {}),
      })
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

  async function download(
    conversation: RitaConversation,
    format: "md" | "json" | "pdf" | "repair",
  ) {
    // The print tab must open inside the tap, before the messages are fetched,
    // or mobile browsers block it as a pop-up.
    const printTab = format === "pdf" ? window.open("", "_blank") : null;
    setOpening(conversation.id);
    setBusyFormat(format);
    setError("");
    try {
      const bundle = await loadBundle(conversation);
      const stem = ritaConversationFileStem(conversation);
      if (format === "pdf") {
        const html = ritaConversationPrintHtml(
          bundle.conversation,
          bundle.messages,
          bundle.sessions,
        );
        if (printTab) {
          printTab.document.open();
          printTab.document.write(html);
          printTab.document.close();
          printTab.focus();
          window.setTimeout(() => printTab.print(), 400);
        } else {
          printInFrame(html);
        }
      } else if (format === "md") {
        await saveFile(
          `${stem}.md`,
          ritaConversationMarkdown(bundle.conversation, bundle.messages, bundle.sessions),
          "text/markdown;charset=utf-8",
        );
      } else if (format === "repair") {
        // The file is made at once from what is saved; the AI review runs on its own afterwards.
        const {
          events,
          reports,
          reviews: saved,
          conversationReview,
        } = await loadRepairData(bundle);
        await saveFile(
          ritaRepairFileName(conversation.title, conversation.id),
          `${JSON.stringify(
            ritaRepairFile({
              conversation,
              messages: bundle.messages,
              sessions: bundle.sessions,
              events,
              reports,
              reviews: saved,
              conversationReview,
            }),
            null,
            2,
          )}\n`,
          "application/json;charset=utf-8",
        );
        // The review starts once per visit (again after it stopped); "done" keeps the updated file
        // button from starting another round.
        const review = reviews[conversation.id];
        if (isAdmin && (!review || review.state === "stopped")) void runReview(conversation.id);
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
      printTab?.close();
      setError(cause instanceof Error ? cause.message : "Could not download this conversation.");
    } finally {
      setOpening("");
      setBusyFormat("");
    }
  }

  /** Reviews the conversation's replies a step at a time, with progress on its card. */
  async function runReview(conversationId: string) {
    stopReview.current.delete(conversationId);
    const set = (value: ReviewProgress) =>
      setReviews((current) => ({ ...current, [conversationId]: value }));
    let progress: ReviewProgress = { state: "running", turns: 0, finished: 0 };
    set(progress);
    for (let step = 0; step < MAX_STEPS; step += 1) {
      if (stopReview.current.has(conversationId)) {
        set({ ...progress, state: "stopped", message: "stopped by you" });
        return;
      }
      const answer = await reviewStep(conversationId);
      progress = {
        ...progress,
        turns: answer?.turns ?? progress.turns,
        finished: answer?.finished ?? progress.finished,
      };
      const decision = decideStep(answer);
      if (decision.next === "again") {
        set(progress);
        continue;
      }
      set(
        decision.next === "stopped"
          ? { ...progress, state: "stopped", message: decision.reason }
          : { ...progress, state: decision.next },
      );
      if (decision.next === "done") refreshMarks();
      return;
    }
    set({ ...progress, state: "stopped", message: "too many steps; press Review again" });
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

        <AdminBar />

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
                  {isAdmin ? (
                    <p className="mt-1 text-[14px] text-[var(--pp-muted)]">
                      {reviewMark(marks.get(conversation.id))}
                    </p>
                  ) : null}
                </button>
                <div className="flex items-center gap-2">
                  <Link
                    to="/rita-live"
                    search={{ conversation: conversation.id }}
                    className="rita-btn rita-btn-primary"
                  >
                    Continue
                  </Link>
                  <ConversationMenu
                    title={conversation.title}
                    isAdmin={isAdmin}
                    busy={opening === conversation.id}
                    onAction={(action) =>
                      action === "delete"
                        ? void removeConversation(conversation)
                        : void download(conversation, action === "md" ? "md" : action)
                    }
                  />
                </div>
              </div>
              {opening === conversation.id && busyFormat === "repair" ? (
                <p role="status" className="mt-3 text-[14px] text-[var(--pp-muted)]">
                  Making the repair file…
                </p>
              ) : null}
              {isAdmin && reviews[conversation.id] ? (
                <ReviewLine
                  progress={reviews[conversation.id]}
                  onStop={() => stopReview.current.add(conversation.id)}
                  onAgain={() => void runReview(conversation.id)}
                  onDownload={() => void download(conversation, "repair")}
                />
              ) : null}
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

/** Under a conversation card: how far the AI review got, with stop, again and the updated file. */
function ReviewLine({
  progress,
  onStop,
  onAgain,
  onDownload,
}: {
  progress: ReviewProgress;
  onStop: () => void;
  onAgain: () => void;
  onDownload: () => void;
}) {
  const share = progress.turns > 0 ? Math.round((progress.finished / progress.turns) * 100) : 0;
  return (
    <div role="status" aria-live="polite" className="mt-4 space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px]">
        {progress.state === "running" && (
          <Loader2
            size={15}
            className="animate-spin text-[var(--pp-accent-text)]"
            aria-hidden="true"
          />
        )}
        <span
          className={progress.state === "stopped" ? "text-[#a3471a]" : "text-[var(--pp-muted)]"}
        >
          {progressText(progress)}
        </span>
        <span className="ms-auto flex gap-2">
          {progress.state === "running" ? (
            <button
              type="button"
              onClick={onStop}
              className="rita-btn rita-btn-secondary rita-btn-sm"
            >
              Stop
            </button>
          ) : progress.state === "stopped" ? (
            <button
              type="button"
              onClick={onAgain}
              className="rita-btn rita-btn-secondary rita-btn-sm"
            >
              Review again
            </button>
          ) : progress.state === "done" ? (
            <button
              type="button"
              onClick={onDownload}
              className="rita-btn rita-btn-primary rita-btn-sm"
            >
              Download the updated repair file
            </button>
          ) : null}
        </span>
      </div>
      {progress.turns > 0 && progress.state !== "off" && (
        <div className="h-1 overflow-hidden rounded-full bg-[var(--pp-grey)]" aria-hidden="true">
          <div
            className="h-full rounded-full bg-[var(--pp-accent)] transition-[width] duration-500"
            style={{ width: `${share}%` }}
          />
        </div>
      )}
    </div>
  );
}
