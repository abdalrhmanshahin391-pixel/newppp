import { Link, useNavigate } from "@tanstack/react-router";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  Layers,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { LearningItem, SaveTarget } from "@/lib/rita-learning";
import {
  committedRitaReply,
  settleDraftReply,
  upsertDraftReply,
  wasRitaInterrupted,
} from "@/lib/rita-v3-heard";
import { orbModeFor, type RitaMood } from "@/components/rita-live/RitaStage";
import { ChatText } from "./ChatText";
import { showCaption } from "./chat-text";
import { ProHeader } from "@/components/home/procreate/ProHeader";
import { VoiceOrb } from "@/components/rita-live/VoiceOrb";
import type { OrbLevels } from "@/components/rita-live/VoiceOrb";
import { useRitaLesson } from "@/components/rita-lessons/useRitaLesson";
import { LessonObjectivesPanel, LessonResultCard } from "@/components/rita-lessons/LessonPanels";

type Persona = "kind" | "direct" | "playful" | "strict";
type LessonMode = "free_conversation" | "guided_lesson" | "pronunciation_drill";
type Message = { id: string; role: "you" | "rita"; text: string };
type DestinationPayload = {
  flashSubjects: { id: string; name: string; parent_id: string | null }[];
  germanSubjects: { id: string; name: string }[];
  germanSubtopics: { id: string; name: string; subject_id: string }[];
};
type ClientHandle = {
  disconnect(): Promise<void>;
  enableMic(enabled: boolean): void;
  sendText(text: string): Promise<void>;
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
  preview,
}: { lessonId?: string; preview?: boolean } = {}) {
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
  const traceId = useRef("");
  const pendingMetrics = useRef<PendingMetric[]>([]);
  const lastUserText = useRef("");
  const generatedBuffer = useRef("");
  const heardBuffer = useRef("");
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
  const destinationsRef = useRef<DestinationPayload>({
    flashSubjects: [],
    germanSubjects: [],
    germanSubtopics: [],
  });
  const rememberedDestination = useRef<{ target: SaveTarget; id: string; label: string } | null>(
    null,
  );

  const [status, setStatus] = useState("Ready to start");
  const [mood, setMood] = useState<RitaMood>("ready");
  // Live audio levels for the orb. A ref, not state: they change dozens of times per second.
  const orbLevels = useRef<OrbLevels>({ input: 0, output: 0 });
  // Rita's voice arrives as a remote WebRTC track that the page itself must play.
  const botAudio = useRef<HTMLAudioElement | null>(null);
  const botAudioPlaying = useRef(false);
  const draftReplyId = useRef<string | null>(null);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState("");
  const [caption, setCaption] = useState("");
  const [draft, setDraft] = useState("");
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
  const [learningOpen, setLearningOpen] = useState(false);
  const [learning, setLearning] = useState<LearningItem[]>([]);
  const [target, setTarget] = useState<SaveTarget>("flashcards");
  const [destinationId, setDestinationId] = useState("");
  const [destinations, setDestinations] = useState<DestinationPayload>({
    flashSubjects: [],
    germanSubjects: [],
    germanSubtopics: [],
  });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/login" });
  }, [loading, navigate, user]);

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

  const fetchDestinations = useCallback(async () => {
    if (
      destinationsRef.current.flashSubjects.length ||
      destinationsRef.current.germanSubtopics.length
    ) {
      return destinationsRef.current;
    }
    const response = await fetch("/api/rita/learning", { headers: await authHeaders() });
    if (!response.ok) throw new Error("Could not load your learning subjects.");
    const payload = (await response.json()) as DestinationPayload;
    destinationsRef.current = payload;
    setDestinations(payload);
    return payload;
  }, []);

  const runExtraction = useCallback(
    async (spoken: string, reply: string) => {
      if (!spoken.trim() || !reply.trim()) return;
      try {
        const response = await fetch("/api/rita/extract", {
          method: "POST",
          headers: await authHeaders(),
          body: JSON.stringify({ spoken, reply }),
        });
        if (!response.ok) return;
        const data = (await response.json()) as ExtractionResult;
        if (!data.learningItems?.length) return;
        setLearning((current) => {
          const byKey = new Map(
            current.map((item) => [`${item.language}:${item.term.toLowerCase()}`, item]),
          );
          for (const item of data.learningItems ?? [])
            byKey.set(`${item.language}:${item.term.toLowerCase()}`, item);
          return [...byKey.values()];
        });
        const requestedTarget =
          data.saveRequest && data.saveRequest !== "none" ? data.saveRequest : null;
        if (requestedTarget) setTarget(requestedTarget);

        let selected = rememberedDestination.current;
        if (data.destinationName || requestedTarget) {
          const payload = await fetchDestinations();
          const optionsFor = (nextTarget: SaveTarget) =>
            nextTarget === "flashcards"
              ? payload.flashSubjects.map((item) => ({ id: item.id, label: item.name }))
              : payload.germanSubtopics.map((item) => ({
                  id: item.id,
                  label: `${payload.germanSubjects.find((parent) => parent.id === item.subject_id)?.name ?? "German"} / ${item.name}`,
                }));
          const nextTarget = requestedTarget ?? selected?.target ?? "flashcards";
          const wanted = String(data.destinationName ?? "")
            .trim()
            .toLocaleLowerCase();
          const match = wanted
            ? optionsFor(nextTarget).find((item) => item.label.toLocaleLowerCase().includes(wanted))
            : undefined;
          if (match) {
            selected = { target: nextTarget, id: match.id, label: match.label };
            setTarget(nextTarget);
            setDestinationId(match.id);
            if (data.rememberDestination) rememberedDestination.current = selected;
          } else if (selected && (!requestedTarget || selected.target === requestedTarget)) {
            setTarget(selected.target);
            setDestinationId(selected.id);
          }
        }

        if (requestedTarget && selected?.id && selected.target === requestedTarget) {
          const saveResponse = await fetch("/api/rita/learning", {
            method: "POST",
            headers: await authHeaders(),
            body: JSON.stringify({
              action: "save",
              target: selected.target,
              destinationId: selected.id,
              items: data.learningItems,
            }),
          });
          const saved = (await saveResponse.json().catch(() => ({}))) as {
            saved?: number;
            error?: string;
          };
          setNotice(
            saveResponse.ok
              ? `${saved.saved ?? 0} item(s) saved to ${selected.label}.`
              : (saved.error ?? "The language items were collected but could not be saved."),
          );
        }
        setLearningOpen(true);
      } catch {
        // Learning extraction is intentionally outside the voice critical path.
      }
    },
    [fetchDestinations],
  );

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

  const endLesson = useCallback(async () => {
    cancelFiller();
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
    draftReplyId.current = null;
    setSoundBlocked(false);
    activeRef.current = false;
    mutedRef.current = false;
    setActive(false);
    setMuted(false);
    setMood("ready");
    setStatus("Lesson ended");
    setCaption("");
    // Chat and unsaved vocabulary are session-only by design.
    setMessages([
      {
        id: crypto.randomUUID(),
        role: "rita",
        text: "Hi, I’m Rita. What would you like to practise?",
      },
    ]);
    setLearning([]);
    rememberedDestination.current = null;
    destinationsRef.current = { flashSubjects: [], germanSubjects: [], germanSubtopics: [] };
    setDestinations(destinationsRef.current);
    setDestinationId("");
  }, [cancelFiller]);

  useEffect(() => () => void endLesson(), [endLesson]);

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
    draftReplyId.current = null;
    setSoundBlocked(false);
    setStarting(true);
    setError("");
    setStatus("Connecting Rita v3…");
    try {
      const [{ PipecatClient }, { DailyTransport }] = await Promise.all([
        import("@pipecat-ai/client-js"),
        import("@pipecat-ai/daily-transport"),
      ]);
      void metric("imports_ready", performance.now() - sessionStartedAt.current);
      generatedBuffer.current = "";
      heardBuffer.current = "";
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
        const reply = committedRitaReply({
          reportedSpokenText: heardBuffer.current,
          generatedText: generatedBuffer.current,
          interrupted,
        });
        heardBuffer.current = "";
        const draftId = draftReplyId.current;
        draftReplyId.current = null;
        setMessages((current) =>
          settleDraftReply(
            current,
            draftId,
            reply,
            reply ? { id: crypto.randomUUID(), role: "rita", text: reply } : null,
          ),
        );
        if (!reply) return;
        if (!interrupted) void runExtraction(lastUserText.current, reply);
        if (interrupted) void metric("interrupted");
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
            setStatus("Rita is listening");
            setMood("listening");
            if (!botReadyMetricRecorded.current) {
              botReadyMetricRecorded.current = true;
              void metric("bot_ready", botReadyAt.current - sessionStartedAt.current);
            }
          },
          onDisconnected: () => {
            activeRef.current = false;
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
            if (botSpeaking.current) interruptCandidateAt.current = performance.now();
            turnId.current = crypto.randomUUID();
            if (!botSpeaking.current) {
              setStatus("I’m listening…");
              setMood("listening");
            }
            void metric("speech_start");
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
            currentTurnHasFinalTranscript.current = true;
            setMessages((current) => [
              ...current,
              { id: crypto.randomUUID(), role: "you", text: data.text.trim() },
            ]);
            void metric("transcript_final");
          },
          onBotLlmStarted: () => {
            generatedBuffer.current = "";
            heardBuffer.current = "";
            draftReplyId.current = null;
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
            generatedBuffer.current += text;
            // Show the reply as it streams; playback accounting settles it later.
            const draftText = generatedBuffer.current.trim();
            if (draftText) {
              const id = draftReplyId.current ?? crypto.randomUUID();
              draftReplyId.current = id;
              setMessages((current) =>
                upsertDraftReply(current, { id, role: "rita", text: draftText }),
              );
            }
          },
          onBotOutput: (data) => {
            if (data.will_be_spoken === false || data.spoken_status === "new") return;
            const audible = data.spoken_progress?.accumulated_text?.trim();
            if (audible) heardBuffer.current = audible;
          },
          onBotStartedSpeaking: () => {
            cancelFiller();
            botSpeaking.current = true;
            void metric("bot_speaking_signal");
            setStatus("Rita is speaking — interrupt whenever you want");
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
                generatedCharacters: generatedBuffer.current.length,
              });
              snapshotNetwork("first_remote_audio_level");
              speechEndedAt.current = 0;
            }
          },
          onBotStoppedSpeaking: () => {
            botSpeaking.current = false;
            const interrupted = wasRitaInterrupted(interruptCandidateAt.current, performance.now());
            commitHeardReply(interrupted);
            interruptCandidateAt.current = 0;
            void metric("playback_stop");
          },
          onBotTtsStarted: () => {
            void metric("tts_start");
          },
          onBotTtsStopped: () => {
            setStatus(muted ? "Microphone muted" : "Rita is listening");
            setMood(muted ? "ready" : "listening");
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

  function toggleMute() {
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
    if (!text || !client.current?.connected) return;
    setDraft("");
    lastUserText.current = text;
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "you", text }]);
    await client.current.sendText(text);
  }

  async function loadDestinations(nextTarget: SaveTarget) {
    setTarget(nextTarget);
    setLearningOpen(true);
    setNotice("");
    const remembered = rememberedDestination.current;
    if (remembered?.target === nextTarget) setDestinationId(remembered.id);
    await fetchDestinations().catch((cause) => setNotice(humanError(cause)));
  }

  async function saveLearning() {
    if (!destinationId || !learning.length) return;
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/rita/learning", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ action: "save", target, destinationId, items: learning }),
      });
      const data = (await response.json().catch(() => ({}))) as { saved?: number; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save the learning items.");
      setNotice(`${data.saved ?? 0} item(s) saved.`);
    } catch (cause) {
      setNotice(humanError(cause));
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  const options =
    target === "flashcards"
      ? destinations.flashSubjects.map((item) => ({ id: item.id, label: item.name }))
      : destinations.germanSubtopics.map((item) => ({
          id: item.id,
          label: `${destinations.germanSubjects.find((parent) => parent.id === item.subject_id)?.name ?? "German"} / ${item.name}`,
        }));

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
            to={lessonId ? "/rita-lessons" : "/rita"}
            aria-label="Back"
            className="grid h-11 w-11 place-items-center rounded-full bg-[#fdecec] text-[#d92d20] transition-colors hover:bg-[#fbd5d5]"
          >
            <X size={22} strokeWidth={2.5} />
          </Link>
        </div>

        <aside className="flex flex-col items-center pt-2 text-center">
          <VoiceOrb
            levelsRef={orbLevels}
            mode={orbModeFor(active, mood)}
            label={active ? "Rita is with you" : "Rita, your language tutor"}
            className="h-[min(70vw,360px)] w-[min(70vw,360px)]"
          />
          {lessonId && (
            <h2 className="-mt-4 text-[32px] leading-[36px] text-[var(--pp-ink)]">
              {lesson.session?.lesson.title_ar || "Lesson"}
            </h2>
          )}
          {(active || starting) && (
            <p className="mt-2 flex items-center gap-2 text-[16px] font-medium text-[var(--pp-muted)]">
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                  mood === "talking"
                    ? "animate-pulse bg-[var(--pp-pink)]"
                    : mood === "listening"
                      ? "bg-[var(--pp-pink-text)]"
                      : "bg-[var(--pp-line)]"
                }`}
              />
              {status}
            </p>
          )}
        </aside>

        <section
          className={`flex min-h-[calc(100vh-200px)] w-full flex-col ${
            !active && !lessonId ? "justify-center" : ""
          }`}
        >
          {active && soundBlocked && (
            <div className="flex justify-center pt-4">
              <button type="button" onClick={enableSound} className="rita-btn rita-btn-primary">
                Tap to enable sound
              </button>
            </div>
          )}

          <div className={!active && !lessonId ? "py-2" : "flex-1 py-6"}>
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
              {lesson.error && (
                <div className="rounded-2xl bg-[var(--pp-pink-soft)] px-4 py-3 text-[15px] font-semibold text-[var(--pp-pink-text)]">
                  {lesson.error}{" "}
                  <Link to="/rita-lessons" className="underline">
                    العودة إلى المسار
                  </Link>
                </div>
              )}
              {(!active && messages.length === 1 ? [] : messages).map((message) => (
                <ChatText
                  key={message.id}
                  text={message.text}
                  className={
                    message.role === "you"
                      ? "ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-[var(--pp-pink-soft)] px-4 py-2.5 text-[18px] leading-7"
                      : "mr-auto w-fit max-w-[92%] rounded-2xl rounded-bl-md bg-[var(--pp-grey)] px-5 py-3.5 text-[19px] leading-8"
                  }
                />
              ))}
              {showCaption(
                caption,
                [...messages].reverse().find((m) => m.role === "you")?.text,
              ) && (
                <ChatText
                  text={caption}
                  className="ml-auto w-fit max-w-[85%] px-2 text-[15px] leading-6 text-[var(--pp-muted)]"
                />
              )}
              {error && (
                <div className="rounded-2xl bg-[var(--pp-pink-soft)] px-4 py-3 text-[15px] font-semibold text-[var(--pp-pink-text)]">
                  {error}
                </div>
              )}
            </div>
          </div>

          <div className={!active && !lessonId ? "py-3" : "sticky bottom-0 bg-white pb-6 pt-3"}>
            {!active ? (
              <div className="flex justify-center">
                <button
                  onClick={startLesson}
                  disabled={starting || (Boolean(lessonId) && !lesson.session)}
                  className="rita-btn rita-btn-primary gap-2 disabled:opacity-60"
                >
                  {starting ? <Loader2 className="animate-spin" size={18} /> : <Mic size={18} />}{" "}
                  {lessonId ? "ابدأ الدرس مع ريتا" : "Start talking"}
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
                    className="rita-btn rita-btn-secondary rita-btn-sm gap-1.5"
                  >
                    {muted ? <MicOff size={16} /> : <Mic size={16} />}
                    {muted ? "Unmute" : "Mute"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadDestinations("flashcards")}
                    className="rita-btn rita-btn-secondary rita-btn-sm gap-1.5"
                  >
                    <Layers size={16} /> Learning ({learning.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => void endLesson()}
                    className="rita-btn rita-btn-secondary rita-btn-sm ml-auto gap-1.5 !text-[var(--pp-pink-text)]"
                  >
                    <PhoneOff size={16} /> End
                  </button>
                  <button
                    type="submit"
                    aria-label="Send"
                    className="rita-btn rita-btn-primary rita-btn-sm !w-10 !px-0"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      </div>

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

      {learningOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-[#121117]/40 sm:items-center sm:justify-center"
          onClick={() => setLearningOpen(false)}
        >
          <section
            className="max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-2xl sm:rounded-2xl sm:p-7 text-[var(--pp-ink)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[var(--pp-pink-text)]">Learning Tray</p>
                <h2 className="text-2xl font-extrabold">Useful language from this lesson</h2>
              </div>
              <button onClick={() => setLearningOpen(false)}>
                <X />
              </button>
            </div>
            {!learning.length ? (
              <p className="py-10 text-center text-[var(--pp-muted)]">
                Ask for a translation, a word meaning, or a language word list. General knowledge
                will not be saved here.
              </p>
            ) : (
              <div className="mt-6 divide-y divide-[var(--pp-line)]">
                {learning.map((item) => (
                  <div
                    key={`${item.language}:${item.term}`}
                    className="grid gap-1 py-4 sm:grid-cols-[1fr_1fr_auto]"
                  >
                    <strong>
                      {item.article ? `${item.article} ` : ""}
                      {item.term}
                    </strong>
                    <span className="text-[var(--pp-muted)]">{item.meaning}</span>
                    <span className="text-xs font-bold uppercase text-[var(--pp-pink-text)]">
                      {item.language}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {learning.length > 0 && (
              <div className="mt-6 rounded-2xl bg-[var(--pp-grey)] p-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => void loadDestinations("flashcards")}
                    className={`rounded-lg px-4 py-2 text-sm font-bold ${target === "flashcards" ? "border-2 border-[var(--pp-ink)] bg-[var(--pp-pink)]" : "border-2 border-transparent bg-white"}`}
                  >
                    <Layers className="mr-1 inline" size={15} />
                    Flashcards
                  </button>
                  <button
                    onClick={() => void loadDestinations("german_lab")}
                    className={`rounded-lg px-4 py-2 text-sm font-bold ${target === "german_lab" ? "border-2 border-[var(--pp-ink)] bg-[var(--pp-pink)]" : "border-2 border-transparent bg-white"}`}
                  >
                    <BookOpen className="mr-1 inline" size={15} />
                    German Lab
                  </button>
                </div>
                <div className="relative mt-3">
                  <select
                    value={destinationId}
                    onChange={(event) => setDestinationId(event.target.value)}
                    className="w-full appearance-none rita-select !pr-10 w-full appearance-none"
                  >
                    <option value="">Choose a subject…</option>
                    {options.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-3.5" size={18} />
                </div>
                {rememberedDestination.current && (
                  <p className="mt-2 text-xs font-bold text-[var(--pp-pink-text)]">
                    Remembered for this lesson: {rememberedDestination.current.label}
                  </p>
                )}
                <button
                  onClick={saveLearning}
                  disabled={!destinationId || saving}
                  className="rita-btn rita-btn-primary mt-3 !w-full !self-stretch gap-2 disabled:opacity-40"
                >
                  {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                  Save selected lesson language
                </button>
                {notice && <p className="mt-3 text-sm font-semibold">{notice}</p>}
              </div>
            )}
            <p className="mt-5 flex items-center gap-2 text-xs text-[var(--pp-muted)]">
              <Sparkles size={14} />
              Unsaved items and this chat are deleted when the lesson ends.
            </p>
          </section>
        </div>
      )}
    </main>
  );
}
