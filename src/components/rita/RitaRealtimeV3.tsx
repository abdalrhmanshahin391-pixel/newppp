import { Link, useNavigate } from "@tanstack/react-router";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  Layers,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Send,
  Sparkles,
  Square,
  X,
  ArrowLeft,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isGermanItem, type LearningItem, type SaveTarget } from "@/lib/rita-learning";
import { hasRitaLanguageLearningIntent } from "@/lib/rita-learning-intent";
import { stripModelNotes } from "@/lib/rita-model-notes";
import { matchSubject, subjectOptions } from "@/lib/rita-learning-tree";
import {
  RitaReplyAccumulator,
  settleDraftReply,
  upsertDraftReply,
  wasRitaInterrupted,
} from "@/lib/rita-v3-heard";
import { orbModeFor, type RitaMood } from "@/components/rita-live/RitaStage";
import { ChatText } from "./ChatText";
import { PhraseDialog } from "./PhraseDialog";
import { stopPhraseAudio } from "@/lib/phrase-cache";
import { groupTurns, showCaption } from "./chat-text";
import { skipsFiller } from "./short-turn";
import { LearningTray } from "./LearningTray";
import { useLearningTray } from "./useLearningTray";
import { ProHeader } from "@/components/home/procreate/ProHeader";
import { VoiceOrb } from "@/components/rita-live/VoiceOrb";
import type { OrbLevels } from "@/components/rita-live/VoiceOrb";
import { useRitaLesson } from "@/components/rita-lessons/useRitaLesson";
import {
  LessonObjectivesPanel,
  LessonResourcesPanel,
  LessonResultCard,
} from "@/components/rita-lessons/LessonPanels";
import type { RitaConversationDelivery, RitaConversationSource } from "@/lib/rita-conversation";

type Persona = "kind" | "direct" | "playful" | "strict";
type LessonMode = "free_conversation" | "guided_lesson" | "pronunciation_drill";
type Message = { id: string; role: "you" | "rita"; text: string };
type ConversationWrite = {
  client_message_id: string;
  role: "user" | "assistant";
  content: string;
  generated_content: string | null;
  spoken_content: string | null;
  source: RitaConversationSource;
  delivery_status: RitaConversationDelivery;
  created_at: string;
};
type ClientHandle = {
  disconnect(): Promise<void>;
  enableMic(enabled: boolean): void;
  sendText(text: string): Promise<void>;
  sendClientMessage(msgType: string, data?: unknown): void;
  readonly connected: boolean;
};
type ExtractionResult = {
  learningItems?: LearningItem[];
  saveRequest?: "none" | SaveTarget;
  destinationName?: string;
  rememberDestination?: boolean;
};
type PendingMetric = {
  name: string;
  valueMs?: number;
  metadata: Record<string, unknown>;
};

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in before starting Rita.");
  return new Headers({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });
}

function humanError(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (error && typeof error === "object") {
    const candidate = error as { info?: unknown; detail?: unknown; message?: unknown };
    const text = String(candidate.info ?? candidate.detail ?? candidate.message ?? "").trim();
    if (text) return text;
  }
  return "Rita v3 could not start. No old voice system was used.";
}

export function RitaRealtimeV3({
  lessonId,
  conversationId,
  preview,
}: { lessonId?: string; conversationId?: string; preview?: boolean } = {}) {
  const navigate = useNavigate();
  const lesson = useRitaLesson(lessonId, preview);
  const lastCheckedMessage = useRef("");
  const [resultDismissed, setResultDismissed] = useState(false);
  const { user, loading } = useAuth();
  const client = useRef<ClientHandle | null>(null);
  const activeRef = useRef(false);
  const mutedRef = useRef(false);
  const sessionId = useRef("");
  const providerSessionId = useRef("");
  const activeConversationId = useRef(conversationId ?? "");
  const pendingWrites = useRef(new Set<Promise<void>>());
  const failedWrites = useRef(new Map<string, ConversationWrite>());
  const traceId = useRef("");
  const pendingMetrics = useRef<PendingMetric[]>([]);
  const lastUserText = useRef("");
  const replyAccumulator = useRef(new RitaReplyAccumulator());
  const pendingScriptedReply = useRef("");
  const botSpeaking = useRef(false);
  const speechEndedAt = useRef(0);
  const sessionStartedAt = useRef(0);
  const transportConnectedAt = useRef(0);
  const transportMetricRecorded = useRef(false);
  const botReady = useRef(false);
  const botReadyAt = useRef(0);
  const botReadyMetricRecorded = useRef(false);
  const llmStartedAt = useRef(0);
  const firstLlmTokenRecorded = useRef(false);
  const firstPartialRecorded = useRef(false);
  const firstRemoteAudioRecorded = useRef(false);
  const interruptCandidateAt = useRef(0);
  const turnId = useRef("");
  const fillerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fillerAbort = useRef<AbortController | null>(null);
  const fillerSource = useRef<AudioBufferSourceNode | null>(null);
  const fillerAudioContext = useRef<AudioContext | null>(null);
  const fillerSequence = useRef(0);
  const currentTurnHasFinalTranscript = useRef(false);
  const turnSpoken = useRef("");
  const currentUserMessageId = useRef("");
  const currentUserMessageCreatedAt = useRef("");
  const skipExtraction = useRef(false);
  const currentReplySource = useRef<RitaConversationSource>("voice");

  const [status, setStatus] = useState("Ready to start");
  const [mood, setMood] = useState<RitaMood>("ready");
  // Live audio levels for the orb. A ref, not state: they change dozens of times per second.
  const orbLevels = useRef<OrbLevels>({ input: 0, output: 0 });
  // Rita's voice arrives as a remote WebRTC track that the page itself must play.
  const botAudio = useRef<HTMLAudioElement | null>(null);
  const botAudioPlaying = useRef(false);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [active, setActive] = useState(false);
  const [readyForSpeech, setReadyForSpeech] = useState(false);
  const [starting, setStarting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState("");
  const [caption, setCaption] = useState("");
  const [draft, setDraft] = useState("");
  const [historyLoading, setHistoryLoading] = useState(Boolean(conversationId && !lessonId));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "rita",
      text: lessonId
        ? "Hi, I’m Rita. Press start and say hello when you are ready for today’s lesson."
        : "Hi, I’m Rita. What would you like to practise?",
    },
  ]);
  // The natural defaults. The page no longer asks the learner to pick these.
  const personality: Persona = "kind";
  const mode: LessonMode = "free_conversation";
  const language: string = "automatic";
  const dialect: string = "ar-JO";
  // The "tap a word" window. While one of its clips plays, the microphone is
  // muted so the clip is not heard as the learner's own speech.
  const [phrase, setPhrase] = useState<string | null>(null);
  const phraseMuted = useRef(false);
  const openPhrase = useCallback((text: string) => setPhrase(text), []);
  const closePhrase = useCallback(() => setPhrase(null), []);
  const phrasePlaying = useCallback((playing: boolean) => {
    if (playing) {
      if (activeRef.current && !mutedRef.current && !phraseMuted.current) {
        client.current?.enableMic(false);
        phraseMuted.current = true;
      }
    } else if (phraseMuted.current) {
      phraseMuted.current = false;
      if (activeRef.current && botReady.current && !mutedRef.current)
        client.current?.enableMic(true);
    }
  }, []);
  useEffect(() => {
    if (mood === "talking") stopPhraseAudio();
  }, [mood]);
  const tray = useLearningTray(user?.id);

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/login" });
  }, [loading, navigate, user]);

  const persistConversationMessage = useCallback(
    (write: ConversationWrite) => {
      if (lessonId || !user || !activeConversationId.current) return Promise.resolve();
      setSaveState("saving");
      const task = (async () => {
        const { error: saveError } = await supabase.from("rita_free_conversation_messages").upsert(
          {
            ...write,
            conversation_id: activeConversationId.current,
            user_id: user.id,
            session_id: sessionId.current || null,
          },
          { onConflict: "client_message_id" },
        );
        if (saveError) throw saveError;
        failedWrites.current.delete(write.client_message_id);
      })().catch(() => {
        failedWrites.current.set(write.client_message_id, write);
      });
      pendingWrites.current.add(task);
      void task.finally(() => {
        pendingWrites.current.delete(task);
        if (pendingWrites.current.size) return;
        setSaveState(failedWrites.current.size ? "failed" : "saved");
      });
      return task;
    },
    [lessonId, user],
  );

  const retryFailedWrites = useCallback(async () => {
    const writes = [...failedWrites.current.values()];
    if (!writes.length) return;
    failedWrites.current.clear();
    await Promise.all(writes.map((write) => persistConversationMessage(write)));
  }, [persistConversationMessage]);

  useEffect(() => {
    activeConversationId.current = conversationId ?? "";
    if (lessonId || !conversationId || !user) {
      setHistoryLoading(false);
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    setError("");
    void Promise.all([
      supabase
        .from("rita_free_conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("user_id", user.id)
        .is("archived_at", null)
        .maybeSingle(),
      supabase
        .from("rita_free_conversation_messages")
        .select("id,client_message_id,role,content,spoken_content,delivery_status,created_at")
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }),
    ])
      .then(([conversationResult, messageResult]) => {
        if (cancelled) return;
        if (conversationResult.error || !conversationResult.data) {
          throw conversationResult.error ?? new Error("This conversation is not available.");
        }
        if (messageResult.error) throw messageResult.error;
        const savedMessages = (messageResult.data ?? []) as Array<{
          client_message_id: string;
          role: "user" | "assistant";
          content: string;
          spoken_content: string | null;
          delivery_status: RitaConversationDelivery;
        }>;
        const restored = savedMessages.map((message) => ({
          id: message.client_message_id,
          role: message.role === "user" ? ("you" as const) : ("rita" as const),
          text:
            message.role === "assistant" && message.delivery_status === "interrupted"
              ? message.spoken_content || message.content
              : message.content,
        }));
        setMessages(
          restored.length
            ? restored
            : [
                {
                  id: "welcome",
                  role: "rita",
                  text: "Hi, I’m Rita. What would you like to practise?",
                },
              ],
        );
      })
      .catch((cause) => {
        if (!cancelled)
          setError(cause instanceof Error ? cause.message : "Could not load this conversation.");
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId, lessonId, user]);

  // Curriculum lessons: after each learner turn, check the lesson objectives.
  const { enabled: lessonEnabled, checkTurns } = lesson;
  useEffect(() => {
    if (!lessonEnabled) return;
    let lastYou = -1;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === "you") {
        lastYou = index;
        break;
      }
    }
    if (lastYou < 0 || messages[lastYou].id === lastCheckedMessage.current) return;
    lastCheckedMessage.current = messages[lastYou].id;
    checkTurns(
      messages
        .slice(0, lastYou + 1)
        .filter((message) => message.id !== "welcome")
        .map((message) => ({
          role: message.role === "you" ? "user" : "assistant",
          text: message.text,
        })),
    );
  }, [checkTurns, lessonEnabled, messages]);

  const sendMetric = useCallback(async (currentSessionId: string, event: PendingMetric) => {
    try {
      await fetch("/api/rita-v3/session/metrics", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          sessionId: currentSessionId,
          name: event.name,
          valueMs: event.valueMs,
          metadata: event.metadata,
        }),
      });
    } catch {
      // Metrics never interrupt a lesson.
    }
  }, []);

  const metric = useCallback(
    async (name: string, valueMs?: number, metadata?: Record<string, unknown>) => {
      const connection = navigator as Navigator & {
        connection?: {
          effectiveType?: string;
          rtt?: number;
          downlink?: number;
          saveData?: boolean;
        };
      };
      const event: PendingMetric = {
        name,
        valueMs,
        metadata: {
          ...metadata,
          traceId: traceId.current || undefined,
          turnId: turnId.current || undefined,
          source: "browser",
          device: /ipad|iphone/i.test(navigator.userAgent)
            ? "ios"
            : /android/i.test(navigator.userAgent)
              ? "android"
              : "desktop",
          network: connection.connection?.effectiveType ?? "unknown",
          networkRttMs: connection.connection?.rtt,
          networkDownlinkMbps: connection.connection?.downlink,
          networkSaveData: connection.connection?.saveData,
          language,
          dialect,
          mode,
        },
      };
      const currentSessionId = sessionId.current;
      if (!currentSessionId) {
        // Start events happen before Pipecat returns the application session ID.
        // Queue them once, then persist them after onBotStarted supplies that ID.
        pendingMetrics.current.push(event);
        return;
      }
      await sendMetric(currentSessionId, event);
    },
    [dialect, language, mode, sendMetric],
  );

  const flushPendingMetrics = useCallback(
    (currentSessionId: string) => {
      const pending = pendingMetrics.current;
      pendingMetrics.current = [];
      void Promise.all(pending.map((event) => sendMetric(currentSessionId, event)));
    },
    [sendMetric],
  );

  // Callbacks created once read the latest tray through this ref.
  const trayRef = useRef(tray);
  trayRef.current = tray;

  /**
   * After a finished reply: if the learner asked what a word means or how to say it, note
   * exactly that word in their list. A failure is shown, never swallowed.
   */
  const runExtraction = useCallback(async (spoken: string, reply: string) => {
    if (!spoken.trim() || !reply.trim()) return;
    if (!hasRitaLanguageLearningIntent(spoken)) return;
    const current = () => trayRef.current;
    try {
      const response = await fetch("/api/rita/extract", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ spoken, reply }),
      });
      if (!response.ok) throw new Error("extract failed");
      const data = (await response.json()) as ExtractionResult;
      const items = data.learningItems ?? [];
      if (!items.length) return;

      const requestedTarget =
        data.saveRequest && data.saveRequest !== "none" ? data.saveRequest : null;
      if (!requestedTarget) {
        current().add(items, spoken);
        return;
      }

      // The learner asked to save straight into a subject.
      const payload = await current().loadDestinations();
      const options =
        requestedTarget === "flashcards"
          ? subjectOptions(payload.flashSubjects)
          : payload.germanSubtopics.map((item) => ({
              id: item.id,
              depth: 0,
              label: `${payload.germanSubjects.find((parent) => parent.id === item.subject_id)?.name ?? "German"} / ${item.name}`,
            }));
      const wanted = String(data.destinationName ?? "").trim();
      const remembered = current().remembered;
      const chosen =
        (wanted ? matchSubject(options, wanted) : null) ??
        (remembered && remembered.target === requestedTarget
          ? { id: remembered.id, label: remembered.label }
          : null);
      if (!chosen) {
        current().add(items, spoken);
        current().setTarget(requestedTarget);
        await current().openTray();
        return;
      }
      if (data.rememberDestination)
        current().setRemembered({ target: requestedTarget, id: chosen.id, label: chosen.label });
      const germanOnly = requestedTarget === "german_lab";
      const direct = germanOnly ? items.filter(isGermanItem) : items;
      const rest = germanOnly ? items.filter((item) => !isGermanItem(item)) : [];
      if (rest.length) current().add(rest, spoken);
      if (direct.length)
        await current().saveNamed(requestedTarget, chosen.id, chosen.label, direct);
      await current().openTray();
    } catch {
      trayRef.current.flash("Could not note that word. Ask again in a moment.");
    }
  }, []);

  const cancelFiller = useCallback(() => {
    if (fillerTimer.current) clearTimeout(fillerTimer.current);
    fillerTimer.current = null;
    fillerAbort.current?.abort();
    fillerAbort.current = null;
    try {
      fillerSource.current?.stop();
    } catch {
      /* Already stopped. */
    }
    fillerSource.current = null;
  }, []);

  const scheduleFiller = useCallback(() => {
    cancelFiller();
    fillerTimer.current = setTimeout(async () => {
      if (!activeRef.current || botSpeaking.current || mutedRef.current) return;
      const spoken = lastUserText.current;
      // No "mm…" after a command, a thinking sound or a one-word answer: it would sound off.
      if (skipsFiller(spoken)) return;
      const detected = /[\u0600-\u06ff]/u.test(spoken)
        ? "ar"
        : /[äöüß]|\b(?:ich|du|der|die|das|nicht|bitte|danke|guten|morgen)\b/iu.test(spoken)
          ? "de"
          : language === "de" || language === "en"
            ? language
            : dialect.startsWith("ar")
              ? "ar"
              : "en";
      const confident = currentTurnHasFinalTranscript.current && spoken.trim().length >= 3;
      const index = confident ? fillerSequence.current++ % 3 : 0;
      const controller = new AbortController();
      fillerAbort.current = controller;
      try {
        const response = await fetch(`/api/rita-v3/filler?language=${detected}&index=${index}`, {
          headers: await authHeaders(),
          signal: controller.signal,
        });
        if (!response.ok || controller.signal.aborted || botSpeaking.current) return;
        const pcm = await response.arrayBuffer();
        if (controller.signal.aborted || botSpeaking.current) return;
        const context = fillerAudioContext.current ?? new AudioContext({ sampleRate: 24_000 });
        fillerAudioContext.current = context;
        await context.resume();
        const view = new DataView(pcm);
        const buffer = context.createBuffer(1, Math.floor(view.byteLength / 2), 24_000);
        const samples = buffer.getChannelData(0);
        for (let offset = 0; offset + 1 < view.byteLength; offset += 2) {
          samples[offset / 2] = view.getInt16(offset, true) / 32_768;
        }
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        source.onended = () => {
          if (fillerSource.current === source) fillerSource.current = null;
        };
        fillerSource.current = source;
        source.start();
        void metric("backchannel", undefined, { language: detected, index });
      } catch (cause) {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) {
          // A filler is optional and never blocks the actual response.
        }
      }
    }, 675);
  }, [cancelFiller, dialect, language, metric]);

  const ensureFreeConversation = useCallback(async () => {
    if (lessonId) return "";
    if (activeConversationId.current) return activeConversationId.current;
    if (!user) throw new Error("Please sign in before starting Rita.");
    const { data, error: createError } = await supabase
      .from("rita_free_conversations")
      .insert({ user_id: user.id, title: "New conversation" })
      .select("id")
      .single();
    if (createError || !data?.id)
      throw new Error(createError?.message ?? "Could not create the conversation.");
    activeConversationId.current = String(data.id);
    return activeConversationId.current;
  }, [lessonId, user]);

  const endLesson = useCallback(async () => {
    cancelFiller();
    const unfinishedGenerated = replyAccumulator.current.generatedText.trim();
    const unfinishedSpoken = replyAccumulator.current.spokenText.trim();
    const unfinishedId = replyAccumulator.current.draftId;
    if (unfinishedId && (unfinishedGenerated || unfinishedSpoken)) {
      void persistConversationMessage({
        client_message_id: unfinishedId,
        role: "assistant",
        content: unfinishedSpoken || unfinishedGenerated,
        generated_content: unfinishedGenerated || null,
        spoken_content: unfinishedSpoken || null,
        source: currentReplySource.current,
        delivery_status: "incomplete",
        created_at: new Date().toISOString(),
      });
    }
    const current = client.current;
    client.current = null;
    if (current) await current.disconnect().catch(() => undefined);
    if (sessionId.current) {
      fetch("/api/rita-v3/session/end", {
        method: "POST",
        headers: await authHeaders().catch(
          () => new Headers({ "Content-Type": "application/json" }),
        ),
        body: JSON.stringify({
          sessionId: sessionId.current,
          providerSessionId: providerSessionId.current,
        }),
        keepalive: true,
      }).catch(() => undefined);
    }
    sessionId.current = "";
    providerSessionId.current = "";
    traceId.current = "";
    pendingMetrics.current = [];
    const audio = botAudio.current;
    if (audio) {
      audio.pause();
      audio.srcObject = null;
    }
    botAudioPlaying.current = false;
    replyAccumulator.current.clear();
    pendingScriptedReply.current = "";
    setSoundBlocked(false);
    activeRef.current = false;
    mutedRef.current = false;
    botReady.current = false;
    setActive(false);
    setReadyForSpeech(false);
    setMuted(false);
    setMood("ready");
    setStatus("Lesson ended");
    setCaption("");
    if (!activeConversationId.current) {
      setMessages([
        {
          id: crypto.randomUUID(),
          role: "rita",
          text: "Hi, I’m Rita. What would you like to practise?",
        },
      ]);
    }
    turnSpoken.current = "";
    skipExtraction.current = false;
    trayRef.current.closeTray();
    await Promise.allSettled([...pendingWrites.current]);
  }, [cancelFiller, persistConversationMessage]);

  const finishConversation = useCallback(async () => {
    await endLesson();
    if (!lessonId) void navigate({ to: "/rita-conversations" });
  }, [endLesson, lessonId, navigate]);

  useEffect(() => () => void endLesson(), [endLesson]);

  // Rita's worker answers "open the list" / "turn them into flashcards" by voice, so it
  // needs to know whether there is anything in the list.
  const wordCount = tray.entries.length;
  useEffect(() => {
    if (!active) return;
    try {
      client.current?.sendClientMessage("rita-learning-count", { count: wordCount });
    } catch {
      // The count is a convenience for the voice commands only.
    }
  }, [active, wordCount]);

  useEffect(() => {
    // The voice client bundles are large; fetch them while the page is idle so Start is not delayed.
    const preload = () => {
      void import("@pipecat-ai/client-js");
      void import("@pipecat-ai/daily-transport");
    };
    const idle = (
      window as unknown as {
        requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      }
    ).requestIdleCallback;
    const handle = idle ? idle(preload, { timeout: 3000 }) : window.setTimeout(preload, 1200);
    return () => {
      const cancel = (window as unknown as { cancelIdleCallback?: (id: number) => void })
        .cancelIdleCallback;
      if (idle && cancel) cancel(handle as number);
      else window.clearTimeout(handle as number);
    };
  }, []);

  // A silent clip: playing it inside the Start tap lets Safari play Rita's stream later.
  const SILENT_WAV =
    "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

  function unlockBotAudio() {
    const audio = botAudio.current;
    if (!audio) return;
    audio.muted = false;
    audio.volume = 1;
    void fillerAudioContext.current?.resume().catch(() => undefined);
    if (audio.srcObject) return;
    audio.src = SILENT_WAV;
    void audio
      .play()
      .then(() => {
        if (audio.srcObject) return;
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      })
      .catch(() => undefined);
  }

  function attachBotAudio(track: MediaStreamTrack) {
    const audio = botAudio.current;
    if (!audio) return;
    const existing = audio.srcObject instanceof MediaStream ? audio.srcObject : null;
    if (existing?.getAudioTracks().some((candidate) => candidate.id === track.id)) return;
    audio.removeAttribute("src");
    audio.srcObject = new MediaStream([track]);
    audio.muted = false;
    audio.volume = 1;
    const calledAt = performance.now();
    void metric("audio_element_attached");
    void metric("audio_play_called");
    audio
      .play()
      .then(() => {
        setSoundBlocked(false);
        void metric("audio_play_resolved", performance.now() - calledAt);
      })
      .catch((error: unknown) => {
        setSoundBlocked(true);
        void metric("audio_play_blocked", undefined, {
          errorName: error instanceof Error ? error.name : "unknown",
        });
      });
  }

  function enableSound() {
    const audio = botAudio.current;
    if (!audio) return;
    audio.muted = false;
    void audio
      .play()
      .then(() => {
        setSoundBlocked(false);
        void metric("audio_play_resolved", undefined, { recoveredByTap: true });
      })
      .catch(() => undefined);
  }

  async function startLesson() {
    if (starting || active) return;
    // First thing inside the tap: unlock audio and start the real click-to-ready timer.
    unlockBotAudio();
    sessionStartedAt.current = performance.now();
    traceId.current = crypto.randomUUID();
    pendingMetrics.current = [];
    botAudioPlaying.current = false;
    replyAccumulator.current.clear();
    pendingScriptedReply.current = "";
    setSoundBlocked(false);
    setStarting(true);
    setError("");
    setStatus("Connecting Rita v3…");
    try {
      const currentConversationId = await ensureFreeConversation();
      const [{ PipecatClient }, { DailyTransport }] = await Promise.all([
        import("@pipecat-ai/client-js"),
        import("@pipecat-ai/daily-transport"),
      ]);
      void metric("imports_ready", performance.now() - sessionStartedAt.current);
      replyAccumulator.current.clear();
      botSpeaking.current = false;
      sessionId.current = "";
      providerSessionId.current = "";
      transportConnectedAt.current = 0;
      transportMetricRecorded.current = false;
      botReady.current = false;
      botReadyAt.current = 0;
      botReadyMetricRecorded.current = false;
      void metric("start_clicked");
      const commitHeardReply = (interrupted = false) => {
        // Generated/TTS text is not evidence that interrupted audio was heard.
        const generated = stripModelNotes(replyAccumulator.current.generatedText).trim();
        const spoken = stripModelNotes(replyAccumulator.current.spokenText).trim();
        const settled = replyAccumulator.current.settle(interrupted);
        const reply = stripModelNotes(settled.reply).trim();
        const replyId = settled.draftId ?? crypto.randomUUID();
        setMessages((current) =>
          settleDraftReply(
            current,
            settled.draftId,
            reply,
            reply ? { id: replyId, role: "rita", text: reply } : null,
          ),
        );
        const asked = turnSpoken.current;
        turnSpoken.current = "";
        const wasCommand = skipExtraction.current;
        skipExtraction.current = false;
        if (!reply) return;
        void persistConversationMessage({
          client_message_id: replyId,
          role: "assistant",
          content: reply,
          generated_content: generated || null,
          spoken_content: spoken || reply,
          source: currentReplySource.current,
          delivery_status: interrupted ? "interrupted" : "completed",
          created_at: new Date().toISOString(),
        });
        // A word the learner asked about counts even if they cut Rita off; only a spoken
        // command to the list itself ("open the list", "turn them into flashcards") does not.
        if (!wasCommand) void runExtraction(asked || lastUserText.current, reply);
        if (interrupted) void metric("interrupted");
      };
      const beginScriptedReply = (text: string) => {
        const clean = stripModelNotes(text).trim();
        if (!clean) return;
        currentReplySource.current = "scripted";
        replyAccumulator.current.clear();
        replyAccumulator.current.beginTts();
        // Intended text is safe to show, but only botOutput is recorded as heard.
        // If playback is interrupted, settle() will keep spoken progress only.
        replyAccumulator.current.appendGenerated(clean);
        const id = crypto.randomUUID();
        replyAccumulator.current.draftId = id;
        setMessages((current) => upsertDraftReply(current, { id, role: "rita", text: clean }));
      };
      const transport = new DailyTransport({
        bufferLocalAudioUntilBotReady: true,
        inputSettings: {
          audio: {
            settings: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              channelCount: 1,
            },
          },
        },
      });
      const networkSnapshotPhases = new Set<string>();
      const snapshotNetwork = (phase: string) => {
        if (networkSnapshotPhases.has(phase)) return;
        networkSnapshotPhases.add(phase);
        void transport.dailyCallClient
          .getNetworkStats()
          .then((networkStats: unknown) => {
            const stats = networkStats as {
              networkState?: unknown;
              networkStateReasons?: unknown;
              stats?: { latest?: Record<string, unknown> };
            };
            const latest = stats.stats?.latest ?? {};
            const numberOrUndefined = (value: unknown) =>
              Number.isFinite(Number(value)) ? Number(value) : undefined;
            return metric("network_snapshot", undefined, {
              phase,
              dailyNetworkState:
                typeof stats.networkState === "string" ? stats.networkState : "unknown",
              dailyNetworkReasons: Array.isArray(stats.networkStateReasons)
                ? stats.networkStateReasons.slice(0, 4)
                : [],
              roundTripTimeMs: numberOrUndefined(latest.networkRoundTripTime),
              audioReceivePacketLoss: numberOrUndefined(latest.audioRecvPacketLoss),
              audioSendPacketLoss: numberOrUndefined(latest.audioSendPacketLoss),
              audioReceiveJitter: numberOrUndefined(latest.audioRecvJitter),
              audioSendJitter: numberOrUndefined(latest.audioSendJitter),
            });
          })
          .catch(() => void metric("network_stats_unavailable", undefined, { phase }));
      };
      const pc = new PipecatClient({
        transport,
        enableMic: true,
        enableCam: false,
        disconnectOnBotDisconnect: true,
        callbacks: {
          onConnected: () => {
            transportConnectedAt.current = performance.now();
            activeRef.current = true;
            botReady.current = false;
            setReadyForSpeech(false);
            // Safari receives microphone permission from the Start tap, then we close
            // the gate until the worker explicitly says it is ready for real speech.
            client.current?.enableMic(false);
            setActive(true);
            setStatus("Audio connected; waiting for Rita…");
            setMood("ready");
            snapshotNetwork("transport_connected");
            if (!transportMetricRecorded.current) {
              transportMetricRecorded.current = true;
              void metric(
                "transport_connected",
                transportConnectedAt.current - sessionStartedAt.current,
              );
            }
          },
          onBotStarted: (botResponse) => {
            const started = botResponse as {
              sessionId?: string;
              providerSessionId?: string | null;
            };
            sessionId.current = String(started.sessionId ?? "");
            providerSessionId.current = String(started.providerSessionId ?? "");
            if (sessionId.current) flushPendingMetrics(sessionId.current);
            if (transportConnectedAt.current && !transportMetricRecorded.current) {
              transportMetricRecorded.current = true;
              void metric(
                "transport_connected",
                transportConnectedAt.current - sessionStartedAt.current,
              );
            }
            if (botReadyAt.current && !botReadyMetricRecorded.current) {
              botReadyMetricRecorded.current = true;
              void metric("bot_ready", botReadyAt.current - sessionStartedAt.current);
            }
          },
          onBotReady: () => {
            botReady.current = true;
            botReadyAt.current = performance.now();
            setReadyForSpeech(true);
            if (!mutedRef.current && !phraseMuted.current) client.current?.enableMic(true);
            setStatus("Rita is listening");
            setMood("listening");
            if (!botReadyMetricRecorded.current) {
              botReadyMetricRecorded.current = true;
              void metric("bot_ready", botReadyAt.current - sessionStartedAt.current);
            }
          },
          onDisconnected: () => {
            activeRef.current = false;
            botReady.current = false;
            setReadyForSpeech(false);
            setActive(false);
            setMood("ready");
            setStatus("Disconnected");
          },
          onError: (event) => {
            const eventData = (event?.data ?? {}) as { error?: unknown; message?: unknown };
            const detail = String(eventData.error ?? eventData.message ?? "Provider error");
            setError(`${detail}. Rita did not switch to the old system.`);
            setStatus("Rita v3 error");
            void metric("provider_error", undefined, { provider: "transport_or_pipeline" });
            snapshotNetwork("transport_error");
          },
          onDeviceError: () => {
            setError("Microphone permission is blocked or the microphone is already in use.");
            void metric("microphone_permission_error");
          },
          onUserStartedSpeaking: () => {
            cancelFiller();
            currentTurnHasFinalTranscript.current = false;
            firstPartialRecorded.current = false;
            currentUserMessageId.current = crypto.randomUUID();
            currentUserMessageCreatedAt.current = new Date().toISOString();
            if (botSpeaking.current) interruptCandidateAt.current = performance.now();
            turnId.current = crypto.randomUUID();
            if (!botSpeaking.current) {
              setStatus("I’m listening…");
              setMood("listening");
            }
            void metric("speech_start");
          },
          onServerMessage: (data: unknown) => {
            const message = data as {
              type?: string;
              action?: string;
              target?: SaveTarget;
              hint?: string;
              text?: string;
            } | null;
            if (message?.type === "rita-spoken-text") {
              const text = String(message.text ?? "").trim();
              if (!text) return;
              if (botSpeaking.current) pendingScriptedReply.current = text;
              else beginScriptedReply(text);
              return;
            }
            if (message?.type !== "rita-ui") return;
            skipExtraction.current = true;
            if (message.action === "open_list") void trayRef.current.openTray();
            if (message.action === "convert_list")
              void trayRef.current.convertByVoice(
                message.target === "german_lab" ? "german_lab" : "flashcards",
                String(message.hint ?? ""),
              );
          },
          onUserStoppedSpeaking: () => {
            speechEndedAt.current = performance.now();
            void metric("speech_end");
            if (botSpeaking.current) return;
            setStatus("Rita is thinking…");
            setMood("thinking");
            scheduleFiller();
          },
          onUserTranscript: (data) => {
            setCaption(data.text);
            if (!data.final && data.text.trim() && !firstPartialRecorded.current) {
              firstPartialRecorded.current = true;
              void metric("transcript_partial");
            }
            if (!data.final || !data.text.trim()) return;
            lastUserText.current = data.text.trim();
            // A request can arrive in several finished pieces; keep the whole turn.
            turnSpoken.current = `${turnSpoken.current} ${data.text.trim()}`.trim().slice(-500);
            skipExtraction.current = false;
            currentTurnHasFinalTranscript.current = true;
            const message = {
              id: currentUserMessageId.current || crypto.randomUUID(),
              role: "you" as const,
              text: turnSpoken.current,
            };
            currentUserMessageId.current = message.id;
            const createdAt = currentUserMessageCreatedAt.current || new Date().toISOString();
            currentUserMessageCreatedAt.current = createdAt;
            setMessages((current) => upsertDraftReply(current, message));
            void persistConversationMessage({
              client_message_id: message.id,
              role: "user",
              content: message.text,
              generated_content: null,
              spoken_content: null,
              source: "voice",
              delivery_status: "completed",
              created_at: createdAt,
            });
            void metric("transcript_final");
          },
          onBotLlmStarted: () => {
            currentReplySource.current = "voice";
            pendingScriptedReply.current = "";
            replyAccumulator.current.beginLlm();
            llmStartedAt.current = performance.now();
            firstLlmTokenRecorded.current = false;
            firstRemoteAudioRecorded.current = false;
            interruptCandidateAt.current = 0;
            setStatus("Rita is answering…");
            void metric("llm_start");
          },
          onBotLlmText: ({ text }) => {
            if (text && !firstLlmTokenRecorded.current) {
              firstLlmTokenRecorded.current = true;
              void metric("llm_first_token", performance.now() - llmStartedAt.current);
            }
            replyAccumulator.current.appendGenerated(text);
            // Show the reply as it streams; playback accounting settles it later.
            const draftText = stripModelNotes(replyAccumulator.current.visibleText()).trim();
            if (draftText) {
              const id = replyAccumulator.current.draftId ?? crypto.randomUUID();
              replyAccumulator.current.draftId = id;
              setMessages((current) =>
                upsertDraftReply(current, { id, role: "rita", text: draftText }),
              );
            }
          },
          onBotOutput: (data) => {
            if (data.will_be_spoken === false) return;
            replyAccumulator.current.beginTts();
            if (data.spoken_status === "new") return;
            const audible = data.spoken_progress?.accumulated_text?.trim();
            if (!audible) return;
            replyAccumulator.current.reportSpoken(audible);
            // Router replies such as "تمام." use TTSSpeakFrame and emit no LLM
            // text. Spoken progress is therefore the authoritative chat source.
            const draftText = stripModelNotes(replyAccumulator.current.visibleText()).trim();
            if (!draftText) return;
            const id = replyAccumulator.current.draftId ?? crypto.randomUUID();
            replyAccumulator.current.draftId = id;
            setMessages((current) =>
              upsertDraftReply(current, { id, role: "rita", text: draftText }),
            );
          },
          onBotStartedSpeaking: () => {
            cancelFiller();
            botSpeaking.current = true;
            void metric("bot_speaking_signal");
            setStatus("Rita is speaking — say stop or tap Stop");
            setMood("talking");
          },
          onTrackStarted: (track, participant) => {
            if (track.kind !== "audio" || participant?.local) return;
            void metric("remote_track_started");
            attachBotAudio(track);
          },
          onTrackStopped: (track, participant) => {
            if (track.kind !== "audio" || participant?.local) return;
            const audio = botAudio.current;
            const current = audio?.srcObject instanceof MediaStream ? audio.srcObject : null;
            if (audio && current?.getAudioTracks().some((candidate) => candidate.id === track.id)) {
              audio.srcObject = null;
            }
            void metric("remote_track_stopped");
          },
          onLocalAudioLevel: (level) => {
            orbLevels.current.input = level;
          },
          onRemoteAudioLevel: (level, participant) => {
            if (!participant.local) orbLevels.current.output = level;
            if (
              participant.local ||
              !botSpeaking.current ||
              level < 0.02 ||
              firstRemoteAudioRecorded.current
            )
              return;
            firstRemoteAudioRecorded.current = true;
            if (speechEndedAt.current) {
              void metric("first_remote_audio_level", performance.now() - speechEndedAt.current, {
                measurement: "remote_audio_level_proxy",
                generatedCharacters: replyAccumulator.current.generatedText.length,
              });
              snapshotNetwork("first_remote_audio_level");
              speechEndedAt.current = 0;
            }
          },
          onBotStoppedSpeaking: () => {
            botSpeaking.current = false;
            const interrupted = wasRitaInterrupted(interruptCandidateAt.current, performance.now());
            commitHeardReply(interrupted);
            const scripted = pendingScriptedReply.current;
            pendingScriptedReply.current = "";
            if (scripted) beginScriptedReply(scripted);
            interruptCandidateAt.current = 0;
            void metric("playback_stop");
          },
          onBotTtsStarted: () => {
            if (!botSpeaking.current && pendingScriptedReply.current) {
              const scripted = pendingScriptedReply.current;
              pendingScriptedReply.current = "";
              beginScriptedReply(scripted);
            }
            replyAccumulator.current.beginTts();
            void metric("tts_start");
          },
          onBotTtsStopped: () => {
            const microphoneMuted = mutedRef.current || !botReady.current;
            setStatus(
              !botReady.current
                ? "Rita is getting ready…"
                : microphoneMuted
                  ? "Microphone muted"
                  : "Rita is listening",
            );
            setMood(microphoneMuted ? "ready" : "listening");
          },
          onMetrics: (data) => {
            void metric("provider_metrics", undefined, {
              payload: JSON.parse(JSON.stringify(data)),
            });
          },
        },
      });
      client.current = pc;
      const headers = await authHeaders();
      setStatus("Waking Rita's voice worker…");
      const ready = await pc.startBotAndConnect({
        endpoint: "/api/rita-v3/session/start",
        headers,
        // traceId is intentionally content-free and lets server-side diagnostics
        // be correlated with browser events before a Daily bot response exists.
        requestData: {
          personality,
          language,
          dialect,
          mode: lessonId ? "guided_lesson" : mode,
          traceId: traceId.current,
          ...(currentConversationId ? { conversationId: currentConversationId } : {}),
          ...(lessonId ? { lessonId } : {}),
          // Preview mode: the worker's brief is built fresh, and nothing is saved.
          ...(lessonId && preview ? { preview: true } : {}),
        },
        // A cold agent has taken 88s to join Daily. This prevents a false
        // failure while startup and turn latency remain separately measured.
        timeout: 125_000,
      });
      // Normally onBotStarted supplies these IDs. Retain this fallback because a
      // transport may resolve before it invokes that callback; otherwise the early
      // trace would remain queued and the run would look falsely incomplete.
      const startResult = ready as { sessionId?: unknown; providerSessionId?: unknown } | undefined;
      if (!sessionId.current && typeof startResult?.sessionId === "string") {
        sessionId.current = startResult.sessionId;
        providerSessionId.current = String(startResult.providerSessionId ?? "");
        flushPendingMetrics(sessionId.current);
      }
      void metric("start_call_returned", performance.now() - sessionStartedAt.current);
      setActive(true);
      activeRef.current = true;
      if (!botReady.current) setStatus("Connected; waiting for Rita…");
    } catch (cause) {
      const pending = client.current;
      client.current = null;
      if (pending) await pending.disconnect().catch(() => undefined);
      activeRef.current = false;
      botReady.current = false;
      setReadyForSpeech(false);
      setActive(false);
      setMood("ready");
      setStatus("Rita could not connect");
      setError(`${humanError(cause)} Rita v3 stayed isolated; no legacy voice system was started.`);
      void metric("client_connection_error", undefined, {
        errorKind: cause instanceof Error ? cause.name : "unknown",
      });
    } finally {
      setStarting(false);
    }
  }

  // A sure way to interrupt: it does not depend on the microphone or on what was heard.
  function stopRita() {
    cancelFiller();
    try {
      client.current?.sendClientMessage("rita-stop");
    } catch {
      /* the voice command still works */
    }
    void metric("stop_button");
  }

  function toggleMute() {
    if (!readyForSpeech) return;
    const next = !muted;
    client.current?.enableMic(!next);
    mutedRef.current = next;
    setMuted(next);
    if (next) cancelFiller();
    setStatus(next ? "Microphone muted" : "Rita is listening");
    setMood(next ? "ready" : "listening");
  }

  async function sendText(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !readyForSpeech || !client.current?.connected) return;
    setDraft("");
    lastUserText.current = text;
    const message = { id: crypto.randomUUID(), role: "you" as const, text };
    setMessages((current) => [...current, message]);
    void persistConversationMessage({
      client_message_id: message.id,
      role: "user",
      content: text,
      generated_content: null,
      spoken_content: null,
      source: "text",
      delivery_status: "completed",
      created_at: new Date().toISOString(),
    });
    await client.current.sendText(text);
  }

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <main
      className="edith-premium min-h-screen bg-white text-[var(--pp-ink)]"
      style={{ fontFamily: "var(--font-grotesk), 'Noto Sans Arabic', sans-serif" }}
    >
      <audio
        ref={botAudio}
        autoPlay
        playsInline
        className="hidden"
        onPlaying={() => {
          if (botAudioPlaying.current) return;
          botAudioPlaying.current = true;
          void metric("audio_playing");
        }}
        onStalled={() => void metric("audio_stalled")}
        onEnded={() => void metric("audio_ended")}
      />
      <div className="rita-cream edith-light edith-premium">
        <ProHeader variant="solid" tone="light" />
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-col px-5 sm:px-8">
        <div className="pt-6">
          <Link
            to={lessonId ? "/rita-lessons" : "/rita-conversations"}
            className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-[var(--pp-muted)] hover:text-[var(--pp-ink)]"
          >
            <ArrowLeft size={16} />
            {lessonId ? "Lessons" : "Back"}
          </Link>
        </div>

        <aside className="flex flex-col items-center pt-2 text-center">
          <VoiceOrb
            levelsRef={orbLevels}
            mode={orbModeFor(active, mood)}
            label={active ? "Rita is with you" : "Rita, your language tutor"}
            className="h-[min(70vw,360px)] w-[min(70vw,360px)]"
          />
          <h2 className="-mt-4 text-[32px] leading-[36px] text-[var(--pp-ink)]">
            {lessonId
              ? lesson.session?.lesson.title || lesson.session?.lesson.title_ar || "Lesson"
              : "Talk with Rita"}
          </h2>
          <p className="mt-2 flex items-center gap-2 text-[16px] font-medium text-[var(--pp-muted)]">
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                mood === "talking"
                  ? "animate-pulse bg-[var(--pp-accent)]"
                  : mood === "listening"
                    ? "bg-[var(--pp-accent-text)]"
                    : "bg-[var(--pp-line)]"
              }`}
            />
            {status}
          </p>
          {!lessonId && saveState !== "idle" ? (
            <p
              role="status"
              className={`mt-1 text-xs font-semibold ${saveState === "failed" ? "text-red-600" : "text-[var(--pp-muted)]"}`}
            >
              {saveState === "saving" ? "Saving conversation…" : null}
              {saveState === "saved" ? "Conversation saved" : null}
              {saveState === "failed" ? (
                <button
                  type="button"
                  className="underline"
                  onClick={() => void retryFailedWrites()}
                >
                  Not saved — retry
                </button>
              ) : null}
            </p>
          ) : null}
          {active && mood === "talking" && (
            <button
              type="button"
              onClick={stopRita}
              className="rita-btn rita-btn-secondary rita-btn-sm mt-3 gap-1.5"
            >
              <Square size={14} fill="currentColor" /> Stop
            </button>
          )}
        </aside>

        <section className="flex min-h-[calc(100vh-72px)] w-full flex-col">
          {active && soundBlocked && (
            <div className="flex justify-center pt-4">
              <button type="button" onClick={enableSound} className="rita-btn rita-btn-primary">
                Tap to enable sound
              </button>
            </div>
          )}

          <div className="flex-1 py-6">
            <div className="space-y-6">
              {lesson.session && (
                <LessonObjectivesPanel
                  session={lesson.session}
                  objectives={lesson.objectives}
                  score={lesson.score}
                  checking={lesson.checking}
                  justMet={lesson.justMet}
                />
              )}
              {lesson.session && <LessonResourcesPanel session={lesson.session} />}
              {lesson.error && (
                <div className="rounded-2xl bg-[var(--pp-accent-soft)] px-4 py-3 text-[15px] font-semibold text-[var(--pp-accent-text)]">
                  {lesson.error}{" "}
                  <Link to="/rita-lessons" className="underline">
                    العودة إلى المسار
                  </Link>
                </div>
              )}
              {groupTurns(messages).map((message) =>
                message.role === "you" ? (
                  <ChatText
                    key={message.id}
                    text={message.text}
                    className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-[var(--pp-accent-soft)] px-4 py-2 text-[17px] leading-8"
                  />
                ) : (
                  <ChatText
                    key={message.id}
                    text={message.text}
                    onPhrase={openPhrase}
                    className={
                      !active && messages.length === 1
                        ? "mx-auto text-center text-[20px] leading-8"
                        : "max-w-[94%] text-[18px] leading-9"
                    }
                  />
                ),
              )}
              {showCaption(
                caption,
                [...messages].reverse().find((m) => m.role === "you")?.text,
              ) && (
                <ChatText
                  text={caption}
                  className="ml-auto w-fit max-w-[80%] px-2 text-[15px] leading-6 text-[var(--pp-muted)]"
                />
              )}
              {error && (
                <div className="rounded-2xl bg-[var(--pp-accent-soft)] px-4 py-3 text-[15px] font-semibold text-[var(--pp-accent-text)]">
                  {error}
                </div>
              )}
            </div>
          </div>

          <div className="sticky bottom-0 bg-white pb-6 pt-3">
            {!active ? (
              <div className="flex justify-center">
                <button
                  onClick={startLesson}
                  disabled={historyLoading || starting || (Boolean(lessonId) && !lesson.session)}
                  className="rita-btn rita-btn-primary gap-2 disabled:opacity-60"
                >
                  {historyLoading || starting ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <Mic size={18} />
                  )}{" "}
                  {historyLoading
                    ? "Loading conversation…"
                    : lessonId
                      ? "ابدأ الدرس مع ريتا"
                      : "Start talking"}
                </button>
              </div>
            ) : (
              <form onSubmit={sendText} className="rounded-2xl bg-[var(--pp-grey)] p-3">
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Ask Rita anything…"
                  className="w-full border-0 bg-transparent px-3 py-3 text-[18px] text-[var(--pp-ink)] outline-none placeholder:text-[var(--pp-muted)]"
                />
                <div className="flex flex-wrap items-center gap-2 border-t border-[var(--pp-line)] pt-3">
                  <button
                    type="button"
                    onClick={toggleMute}
                    disabled={!readyForSpeech}
                    className="rita-btn rita-btn-secondary rita-btn-sm gap-1.5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {muted ? <MicOff size={16} /> : <Mic size={16} />}
                    {muted ? "Unmute" : "Mute"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void tray.openTray()}
                    className="rita-btn rita-btn-secondary rita-btn-sm gap-1.5"
                  >
                    <Layers size={16} /> My words ({tray.entries.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => void finishConversation()}
                    className="rita-btn rita-btn-secondary rita-btn-sm ml-auto gap-1.5 !text-[var(--pp-accent-text)]"
                  >
                    <PhoneOff size={16} /> End
                  </button>
                  <button
                    type="submit"
                    aria-label="Send"
                    disabled={!readyForSpeech}
                    className="rita-btn rita-btn-primary rita-btn-sm !w-10 !px-0 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send size={16} />
                  </button>
                </div>
                {tray.latest && (
                  <p role="status" className="text-xs font-semibold text-[var(--pp-muted)]">
                    {tray.latest}
                  </p>
                )}
              </form>
            )}
          </div>
        </section>
      </div>

      {phrase && (
        <PhraseDialog phrase={phrase} onClose={closePhrase} onPlayingChange={phrasePlaying} />
      )}

      {lesson.result && !resultDismissed && (
        <LessonResultCard
          score={lesson.result.score}
          stars={lesson.result.stars}
          nextLessonId={lesson.session?.nextLessonId ?? null}
          onRetry={() => {
            setResultDismissed(false);
            void lesson.restart();
          }}
          onClose={() => setResultDismissed(true)}
        />
      )}

      <LearningTray tray={tray} />
    </main>
  );
}
