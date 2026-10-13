import { Link, useNavigate } from "@tanstack/react-router";
import { type CSSProperties, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  Layers,
  Loader2,
  Mic,
  Moon,
  PhoneOff,
  Send,
  Sparkles,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { learningKey, type LearningItem, type SaveTarget } from "@/lib/rita-learning";
import {
  committedRitaReply,
  settleDraftReply,
  upsertDraftReply,
  wasRitaInterrupted,
} from "@/lib/rita-v3-heard";
import { orbModeFor, type RitaMood } from "@/components/rita-live/RitaStage";
import { VoiceOrb, type OrbLevels } from "@/components/rita-live/VoiceOrb";
import { spokenTextOf } from "@/lib/rita-message";
import {
  matchesCorrection,
  shouldCheckCorrection,
  type Correction,
  type CorrectionRecord,
} from "@/lib/rita-correction";
import { lessonGoal } from "@/lib/rita-goals";
import type { LessonMessage, Phase } from "@/lib/rita-lesson-types";
import { speakSample, stopSpeaking } from "@/lib/rita-speak";
import { buildSummary, type LessonSummary } from "@/lib/rita-summary";
import { readStoredTheme, storeTheme, themeStyle, type ThemeName } from "@/lib/rita-theme";
import { LessonGoalPanel } from "@/components/rita/lesson/LessonGoalPanel";
import { LessonSummaryView } from "@/components/rita/lesson/LessonSummaryView";
import { MessageBubble } from "@/components/rita/lesson/MessageBubble";
import { VoiceStatusBar } from "@/components/rita/lesson/VoiceStatusBar";

type Persona = "kind" | "direct" | "playful" | "strict";
type LessonMode = "free_conversation" | "guided_lesson" | "pronunciation_drill";
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
type CorrectionResult = { correction?: Correction | null };
type PendingMetric = {
  name: string;
  valueMs?: number;
  metadata: Record<string, unknown>;
};

const MODEL_PROOF = "Soniox stt-rt-v5 → Groq GPT-OSS 120B → Cartesia Sonic 3.6 · Layan";

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

/** Plain words for the learner. The technical detail stays in the admin debug panel. */
function learnerMessage(kind: "connect" | "voice") {
  return kind === "connect"
    ? "Rita couldn’t connect. Check your internet connection and try again."
    : "Something went wrong with Rita’s voice. Give it a moment and try again.";
}

const WELCOME = "Hi, I’m Rita. What would you like to practise?";

export function RitaRealtimeV3() {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
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
  const modeRef = useRef<LessonMode>("free_conversation");
  const learningRef = useRef<LearningItem[]>([]);
  const correctionsRef = useRef<CorrectionRecord[]>([]);
  const pendingRetryId = useRef<string | null>(null);
  const turnsRef = useRef(0);
  const speakMsRef = useRef(0);
  const speakStartedAt = useRef(0);
  const lessonStartedAt = useRef(0);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const stickToBottom = useRef(true);
  const sheetRef = useRef<HTMLElement | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const [errorDetail, setErrorDetail] = useState("");
  const [caption, setCaption] = useState("");
  const [draft, setDraft] = useState("");
  const [phase, setPhase] = useState<Phase>("connecting");
  const [theme, setTheme] = useState<ThemeName>("dark");
  const [turnStats, setTurnStats] = useState({ turns: 0, targetTurns: 0 });
  const [corrections, setCorrections] = useState<CorrectionRecord[]>([]);
  const [savedCorrections, setSavedCorrections] = useState<ReadonlySet<string>>(new Set());
  const [summary, setSummary] = useState<LessonSummary | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [messages, setMessages] = useState<LessonMessage[]>([
    { id: "welcome", role: "rita", text: WELCOME },
  ]);
  const [personality, setPersonality] = useState<Persona>("kind");
  const [mode, setMode] = useState<LessonMode>("free_conversation");
  const [language, setLanguage] = useState("automatic");
  const [dialect, setDialect] = useState("ar-JO");
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

  useEffect(() => {
    setTheme(readStoredTheme());
    // The goal panel starts open on wide screens and closed on phones.
    setGoalOpen(window.matchMedia("(min-width: 1024px)").matches);
  }, []);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    learningRef.current = learning;
  }, [learning]);

  useEffect(() => {
    const element = chatRef.current;
    if (element && stickToBottom.current) element.scrollTop = element.scrollHeight;
  }, [messages, summary]);

  useEffect(() => {
    if (!learningOpen) return;
    sheetRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLearningOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [learningOpen]);

  const updateCorrections = useCallback(
    (change: (current: CorrectionRecord[]) => CorrectionRecord[]) => {
      const next = change(correctionsRef.current);
      correctionsRef.current = next;
      setCorrections(next);
    },
    [],
  );

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

  const runCorrection = useCallback(
    async (spoken: string, reply: string, messageId: string) => {
      if (!shouldCheckCorrection(spoken, modeRef.current) || !reply.trim()) return;
      try {
        const response = await fetch("/api/rita/correct", {
          method: "POST",
          headers: await authHeaders(),
          body: JSON.stringify({ spoken, reply, mode: modeRef.current }),
        });
        if (!response.ok) return;
        const data = (await response.json()) as CorrectionResult;
        if (!data.correction) return;
        const record: CorrectionRecord = {
          ...data.correction,
          id: crypto.randomUUID(),
          attempts: 0,
          fixed: false,
        };
        updateCorrections((current) => [...current, record]);
        pendingRetryId.current = record.id;
        setMessages((current) =>
          current.map((message) =>
            message.id === messageId ? { ...message, correctionId: record.id } : message,
          ),
        );
      } catch {
        // The correction card is a bonus; the spoken correction already happened.
      }
    },
    [updateCorrections],
  );

  /** Did the learner just repeat the phrase Rita corrected? */
  const registerRetry = useCallback(
    (spokenText: string) => {
      const pendingId = pendingRetryId.current;
      if (!pendingId || !/\p{Script=Latin}/u.test(spokenText)) return;
      const record = correctionsRef.current.find((item) => item.id === pendingId);
      if (!record) {
        pendingRetryId.current = null;
        return;
      }
      const fixed = matchesCorrection(spokenText, record.better);
      updateCorrections((current) =>
        current.map((item) =>
          item.id === pendingId
            ? { ...item, attempts: item.attempts + 1, fixed: item.fixed || fixed }
            : item,
        ),
      );
      if (fixed || record.attempts + 1 >= 3) pendingRetryId.current = null;
    },
    [updateCorrections],
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
    stopSpeaking();
    const endedAt = performance.now();
    const hadTurns = turnsRef.current > 0;
    if (hadTurns) {
      setSummary(
        buildSummary({
          startedAt: lessonStartedAt.current || endedAt,
          endedAt,
          speakMs: speakMsRef.current,
          turns: turnsRef.current,
          learning: learningRef.current,
          corrections: correctionsRef.current,
        }),
      );
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
    draftReplyId.current = null;
    setSoundBlocked(false);
    activeRef.current = false;
    mutedRef.current = false;
    setActive(false);
    setMuted(false);
    setMood("ready");
    setPhase("connecting");
    setStatus("Lesson ended");
    setCaption("");
    // The chat is session-only by design. Words stay until the summary is closed,
    // so the learner can still review and save them.
    setMessages([{ id: crypto.randomUUID(), role: "rita", text: WELCOME }]);
    if (!hadTurns) setLearning([]);
    turnsRef.current = 0;
    speakMsRef.current = 0;
    speakStartedAt.current = 0;
    lessonStartedAt.current = 0;
    pendingRetryId.current = null;
    correctionsRef.current = [];
    setCorrections([]);
    setSavedCorrections(new Set());
    setTurnStats({ turns: 0, targetTurns: 0 });
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
    setErrorDetail("");
    setSummary(null);
    setPhase("connecting");
    setStatus("Connecting…");
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
        const messageId = draftId ?? crypto.randomUUID();
        setMessages((current) =>
          settleDraftReply<LessonMessage>(
            current,
            draftId,
            reply,
            reply
              ? { id: messageId, role: "rita", text: reply, createdAt: Date.now(), interrupted }
              : null,
          ).map((message) =>
            message.id === messageId
              ? { ...message, streaming: false, interrupted: interrupted || undefined }
              : message,
          ),
        );
        if (!reply) return;
        if (!interrupted) {
          // The learning and correction helpers read clean text, never markdown.
          const plain = spokenTextOf(reply);
          void runExtraction(lastUserText.current, plain);
          void runCorrection(lastUserText.current, plain, messageId);
        }
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
            setStatus("Connected. Waiting for Rita…");
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
            if (!lessonStartedAt.current) lessonStartedAt.current = botReadyAt.current;
            setStatus("Rita is listening");
            setMood("listening");
            setPhase(mutedRef.current ? "muted" : "listening");
            if (!botReadyMetricRecorded.current) {
              botReadyMetricRecorded.current = true;
              void metric("bot_ready", botReadyAt.current - sessionStartedAt.current);
            }
          },
          onDisconnected: () => {
            activeRef.current = false;
            setActive(false);
            setMood("ready");
            setPhase("connecting");
            setStatus("Disconnected");
          },
          onError: (event) => {
            const eventData = (event?.data ?? {}) as { error?: unknown; message?: unknown };
            const detail = String(eventData.error ?? eventData.message ?? "Provider error");
            setError(learnerMessage("voice"));
            setErrorDetail(`${detail}. Rita did not switch to the old system.`);
            setStatus("Voice error");
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
            speakStartedAt.current = performance.now();
            if (!botSpeaking.current) {
              setStatus("I’m listening…");
              setMood("listening");
              setPhase(mutedRef.current ? "muted" : "listening");
            }
            void metric("speech_start");
          },
          onUserStoppedSpeaking: () => {
            speechEndedAt.current = performance.now();
            if (speakStartedAt.current) {
              speakMsRef.current += speechEndedAt.current - speakStartedAt.current;
              speakStartedAt.current = 0;
            }
            void metric("speech_end");
            if (botSpeaking.current) return;
            setStatus("Rita is thinking…");
            setMood("thinking");
            setPhase("understanding");
            scheduleFiller();
          },
          onUserTranscript: (data) => {
            // The live line shows only what is still being heard. A final transcript
            // moves into the chat, so it is never shown twice.
            setCaption(data.final ? "" : data.text);
            if (!data.final && data.text.trim() && !firstPartialRecorded.current) {
              firstPartialRecorded.current = true;
              void metric("transcript_partial");
            }
            if (!data.final || !data.text.trim()) return;
            const finalText = data.text.trim();
            lastUserText.current = finalText;
            currentTurnHasFinalTranscript.current = true;
            turnsRef.current += 1;
            const targetTurn = /\p{Script=Latin}{2,}/u.test(finalText);
            setTurnStats((current) => ({
              turns: current.turns + 1,
              targetTurns: current.targetTurns + (targetTurn ? 1 : 0),
            }));
            registerRetry(finalText);
            setMessages((current) => [
              ...current,
              { id: crypto.randomUUID(), role: "you", text: finalText, createdAt: Date.now() },
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
            if (!botSpeaking.current) setPhase("preparing");
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
                upsertDraftReply<LessonMessage>(current, {
                  id,
                  role: "rita",
                  text: draftText,
                  createdAt: Date.now(),
                  streaming: true,
                }),
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
            setPhase("speaking");
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
            setStatus(mutedRef.current ? "Microphone muted" : "Rita is listening");
            setMood(mutedRef.current ? "ready" : "listening");
            setPhase(mutedRef.current ? "muted" : "listening");
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
      setStatus("Waking Rita up. The first start can take a minute…");
      const ready = await pc.startBotAndConnect({
        endpoint: "/api/rita-v3/session/start",
        headers,
        // traceId is intentionally content-free and lets server-side diagnostics
        // be correlated with browser events before a Daily bot response exists.
        requestData: { personality, language, dialect, mode, traceId: traceId.current },
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
      setError(learnerMessage("connect"));
      setErrorDetail(
        `${humanError(cause)} Rita v3 stayed isolated; no legacy voice system was started.`,
      );
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
    setPhase(next ? "muted" : botSpeaking.current ? "speaking" : "listening");
  }

  async function sendText(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !client.current?.connected) return;
    setDraft("");
    lastUserText.current = text;
    turnsRef.current += 1;
    setTurnStats((current) => ({
      turns: current.turns + 1,
      targetTurns: current.targetTurns + (/\p{Script=Latin}{2,}/u.test(text) ? 1 : 0),
    }));
    registerRetry(text);
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "you", text, createdAt: Date.now() },
    ]);
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

  function toggleTheme() {
    const next: ThemeName = theme === "dark" ? "light" : "dark";
    setTheme(next);
    storeTheme(next);
  }

  function onChatScroll() {
    const element = chatRef.current;
    if (!element) return;
    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
    stickToBottom.current = nearBottom;
    setShowJump(!nearBottom);
  }

  function jumpToLatest() {
    const element = chatRef.current;
    if (!element) return;
    stickToBottom.current = true;
    setShowJump(false);
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollTo({ top: element.scrollHeight, behavior: calm ? "auto" : "smooth" });
  }

  function speakCorrection(record: CorrectionRecord, rate: number) {
    // The phone mic would hear the sample, so it pauses while the sample plays.
    speakSample(record.better, record.language, rate, {
      onStart: () => client.current?.enableMic(false),
      onEnd: () => {
        if (!mutedRef.current) client.current?.enableMic(true);
      },
    });
  }

  function saveCorrection(record: CorrectionRecord) {
    const item: LearningItem = {
      term: record.better,
      meaning: record.translation || record.why || record.said,
      language: record.language,
      kind: "sentence",
      article: null,
      plural: null,
    };
    setLearning((current) =>
      current.some((existing) => learningKey(existing) === learningKey(item))
        ? current
        : [...current, item],
    );
    setSavedCorrections((current) => new Set(current).add(record.id));
  }

  function clearTranscript() {
    if (!confirmClear) {
      setConfirmClear(true);
      if (clearTimer.current) clearTimeout(clearTimer.current);
      clearTimer.current = setTimeout(() => setConfirmClear(false), 4_000);
      return;
    }
    if (clearTimer.current) clearTimeout(clearTimer.current);
    setConfirmClear(false);
    setCaption("");
    setMessages([{ id: crypto.randomUUID(), role: "rita", text: WELCOME }]);
    pendingRetryId.current = null;
    correctionsRef.current = [];
    setCorrections([]);
    setSavedCorrections(new Set());
  }

  function closeSummary() {
    setSummary(null);
    setLearning([]);
    setNotice("");
    setStatus("Ready to start");
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

  const goal = lessonGoal(mode, {
    turns: turnStats.turns,
    targetTurns: turnStats.targetTurns,
    items: learning.length,
    retries: corrections.filter((item) => item.attempts > 0).length,
    fixed: corrections.filter((item) => item.fixed).length,
  });
  const correctionById = new Map(corrections.map((item) => [item.id, item]));
  const showSetup = !active && !summary;

  const privacy = (
    <details className="rl-privacy">
      <summary>How your lesson is handled</summary>
      <p>
        Your voice is processed live by speech and language services so Rita can hear you, answer
        and speak. Rita doesn’t save your chat to your account, and it is cleared when the lesson
        ends. Only phrases you choose to save are kept. Use “Clear transcript” to remove the chat
        right now.
      </p>
    </details>
  );

  return (
    <main className="rl" data-theme={theme} style={themeStyle(theme) as CSSProperties}>
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
      <div className="rl-shell">
        <section className="rl-main" aria-label="Lesson">
          <header className="rl-header">
            <Link to="/" className="rl-iconbtn" aria-label="Leave lesson">
              <X size={18} aria-hidden="true" />
            </Link>
            <h1>
              {goal.title}
              <small>Live lesson with Rita</small>
            </h1>
            <button
              type="button"
              className="rl-iconbtn"
              onClick={toggleTheme}
              aria-label={
                theme === "dark" ? "Switch to the light theme" : "Switch to the dark theme"
              }
            >
              {theme === "dark" ? (
                <Sun size={18} aria-hidden="true" />
              ) : (
                <Moon size={18} aria-hidden="true" />
              )}
            </button>
            {isAdmin && (
              <Link to="/admin/rita-voice" className="rl-adminlink">
                Voice admin
              </Link>
            )}
          </header>

          {isAdmin && (
            <details className="rl-debug">
              <summary>Debug · admin only</summary>
              <p>
                {status} · Rita Realtime v3 · {MODEL_PROOF}
              </p>
              {errorDetail && <p>Error detail: {errorDetail}</p>}
            </details>
          )}

          <details
            className="rl-goalstrip"
            open={goalOpen}
            onToggle={(event) => setGoalOpen(event.currentTarget.open)}
          >
            <summary>
              <span>Today’s goal</span>
              <span style={{ color: "var(--l-muted)", fontSize: "0.85rem" }}>
                {goal.tasks.filter((task) => task.done).length} of {goal.tasks.length} done
              </span>
            </summary>
            <LessonGoalPanel goal={goal} />
          </details>

          <div className="rl-chat" ref={chatRef} onScroll={onChatScroll}>
            {summary && !active ? (
              <LessonSummaryView
                summary={summary}
                onReview={() => void loadDestinations("flashcards")}
                onNewLesson={closeSummary}
              />
            ) : (
              <div className="rl-thread">
                <div
                  className="rl-log"
                  role="log"
                  aria-live="polite"
                  aria-relevant="additions"
                  aria-label="Conversation"
                >
                  {messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      correction={
                        message.correctionId ? correctionById.get(message.correctionId) : undefined
                      }
                      speakBusy={phase === "speaking"}
                      saved={
                        message.correctionId ? savedCorrections.has(message.correctionId) : false
                      }
                      onSpeak={speakCorrection}
                      onSave={saveCorrection}
                    />
                  ))}
                </div>
                {error && (
                  <div className="rl-error" role="alert">
                    {error}
                  </div>
                )}
                {showSetup && (
                  <section className="rl-setup" aria-labelledby="rl-setup-title">
                    <div>
                      <h2 id="rl-setup-title">{goal.title}</h2>
                      <p>{goal.goal}</p>
                    </div>
                    <div className="rl-fields">
                      <label className="rl-field">
                        Teacher style
                        <select
                          className="rl-select"
                          value={personality}
                          onChange={(event) => setPersonality(event.target.value as Persona)}
                        >
                          <option value="kind">Kind teacher</option>
                          <option value="direct">Direct teacher</option>
                          <option value="playful">Playful teacher</option>
                          <option value="strict">Strict teacher</option>
                        </select>
                      </label>
                      <label className="rl-field">
                        Language
                        <select
                          className="rl-select"
                          value={language}
                          onChange={(event) => setLanguage(event.target.value)}
                        >
                          <option value="automatic">Automatic language</option>
                          <option value="ar">Arabic</option>
                          <option value="de">German</option>
                          <option value="en">English</option>
                        </select>
                      </label>
                      <label className="rl-field">
                        Arabic dialect
                        <select
                          className="rl-select"
                          value={dialect}
                          onChange={(event) => setDialect(event.target.value)}
                        >
                          <option value="ar-JO">Jordanian Arabic</option>
                          <option value="standard">Standard Arabic</option>
                          <option value="en-GB">British English</option>
                        </select>
                      </label>
                      <label className="rl-field">
                        Lesson type
                        <select
                          className="rl-select"
                          value={mode}
                          onChange={(event) => setMode(event.target.value as LessonMode)}
                        >
                          <option value="free_conversation">Free conversation</option>
                          <option value="guided_lesson">Guided lesson</option>
                          <option value="pronunciation_drill">Pronunciation drill</option>
                        </select>
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={startLesson}
                      disabled={starting}
                      className="rl-btn rl-btn--primary"
                    >
                      {starting ? (
                        <Loader2 className="animate-spin" size={18} aria-hidden="true" />
                      ) : (
                        <Mic size={18} aria-hidden="true" />
                      )}
                      Start lesson
                    </button>
                    {starting && (
                      <p role="status" style={{ margin: 0 }}>
                        {status}
                      </p>
                    )}
                    {privacy}
                  </section>
                )}
              </div>
            )}
            {showJump && (
              <button type="button" className="rl-jump" onClick={jumpToLatest}>
                Jump to latest
              </button>
            )}
          </div>

          {active && (
            <div className="rl-dock">
              <div className="rl-dock-inner">
                {soundBlocked && (
                  <button type="button" onClick={enableSound} className="rl-btn rl-btn--primary">
                    Tap to enable sound
                  </button>
                )}
                <VoiceStatusBar
                  phase={phase}
                  connectingText={status}
                  caption={caption}
                  muted={muted}
                  onToggleMute={toggleMute}
                  levelsRef={orbLevels}
                  orbMode={orbModeFor(active, mood)}
                />
                <form onSubmit={sendText} className="rl-form">
                  <input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Or type to Rita…"
                    aria-label="Message to Rita"
                    className="rl-input"
                  />
                  <button type="submit" className="rl-iconbtn" aria-label="Send message">
                    <Send size={18} aria-hidden="true" />
                  </button>
                </form>
                <div className="rl-controls">
                  <button
                    type="button"
                    className="rl-btn"
                    onClick={() => void loadDestinations("flashcards")}
                  >
                    <Layers size={16} aria-hidden="true" /> Learning ({learning.length})
                  </button>
                  <button type="button" className="rl-btn" onClick={clearTranscript}>
                    <Trash2 size={16} aria-hidden="true" />
                    {confirmClear ? "Tap again to clear" : "Clear transcript"}
                  </button>
                  <span className="rl-spacer" />
                  <button
                    type="button"
                    className="rl-btn rl-btn--danger"
                    onClick={() => void endLesson()}
                  >
                    <PhoneOff size={16} aria-hidden="true" /> End lesson
                  </button>
                </div>
                {privacy}
              </div>
            </div>
          )}
        </section>

        <aside className="rl-side" aria-label="Lesson goal">
          <VoiceOrb
            levelsRef={orbLevels}
            mode={orbModeFor(active, mood)}
            label="Rita’s voice"
            className="rl-orb-big"
          />
          <LessonGoalPanel goal={goal} />
        </aside>
      </div>

      {learningOpen && (
        <div className="rl-overlay" onClick={() => setLearningOpen(false)}>
          <section
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rl-tray-title"
            tabIndex={-1}
            className="rl-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <p className="rl-kicker">Learning tray</p>
                <h2 id="rl-tray-title">Useful language from this lesson</h2>
              </div>
              <button
                type="button"
                className="rl-iconbtn"
                onClick={() => setLearningOpen(false)}
                aria-label="Close learning tray"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            {!learning.length ? (
              <p style={{ padding: "32px 0", textAlign: "center", color: "var(--l-muted)" }}>
                Ask for a translation, a word meaning, or a language word list. General knowledge
                will not be saved here.
              </p>
            ) : (
              <ul className="rl-list" style={{ marginTop: 16 }}>
                {learning.map((item) => (
                  <li key={`${item.language}:${item.term}`}>
                    <span dir="auto">
                      <strong>
                        <bdi dir="ltr" lang={item.language.split("-")[0]}>
                          {item.article ? `${item.article} ` : ""}
                          {item.term}
                        </bdi>
                      </strong>
                      <br />
                      <small dir="auto">{item.meaning}</small>
                    </span>
                    <small>{item.language}</small>
                  </li>
                ))}
              </ul>
            )}
            {learning.length > 0 && (
              <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
                <div className="rl-pillrow">
                  <button
                    type="button"
                    aria-pressed={target === "flashcards"}
                    onClick={() => void loadDestinations("flashcards")}
                    className="rl-btn rl-pill"
                  >
                    <Layers size={15} aria-hidden="true" /> Flashcards
                  </button>
                  <button
                    type="button"
                    aria-pressed={target === "german_lab"}
                    onClick={() => void loadDestinations("german_lab")}
                    className="rl-btn rl-pill"
                  >
                    <BookOpen size={15} aria-hidden="true" /> German Lab
                  </button>
                </div>
                <label className="rl-field" style={{ position: "relative" }}>
                  Save to
                  <select
                    value={destinationId}
                    onChange={(event) => setDestinationId(event.target.value)}
                    className="rl-select"
                  >
                    <option value="">Choose a subject…</option>
                    {options.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    aria-hidden="true"
                    size={18}
                    style={{ position: "absolute", right: 12, bottom: 13, pointerEvents: "none" }}
                  />
                </label>
                {rememberedDestination.current && (
                  <p
                    style={{
                      margin: 0,
                      color: "var(--l-accent)",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                    }}
                  >
                    Remembered for this lesson: {rememberedDestination.current.label}
                  </p>
                )}
                <button
                  type="button"
                  onClick={saveLearning}
                  disabled={!destinationId || saving}
                  className="rl-btn rl-btn--primary"
                >
                  {saving ? (
                    <Loader2 className="animate-spin" size={16} aria-hidden="true" />
                  ) : (
                    <Check size={16} aria-hidden="true" />
                  )}
                  Save selected lesson language
                </button>
                {notice && (
                  <p role="status" style={{ margin: 0, fontWeight: 600 }}>
                    {notice}
                  </p>
                )}
              </div>
            )}
            <p
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                margin: "20px 0 0",
                color: "var(--l-muted)",
                fontSize: "0.8rem",
              }}
            >
              <Sparkles size={14} aria-hidden="true" />
              The chat is cleared when the lesson ends. Items you don’t save are cleared when you
              close the lesson summary or leave this page.
            </p>
          </section>
        </div>
      )}
    </main>
  );
}
