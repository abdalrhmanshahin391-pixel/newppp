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
import { RitaStage, type RitaMood } from "@/components/rita-live/RitaStage";

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

const MODEL_PROOF =
  "Soniox stt-rt-v5 → Groq GPT-OSS 120B → Gemini 3.8 Flash-Lite TTS · Achernar";

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in before starting Rita.");
  return new Headers({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });
}

function humanError(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Rita v3 could not start. No old voice system was used.";
}

export function RitaRealtimeV3() {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const client = useRef<ClientHandle | null>(null);
  const activeRef = useRef(false);
  const mutedRef = useRef(false);
  const sessionId = useRef("");
  const providerSessionId = useRef("");
  const lastUserText = useRef("");
  const generatedBuffer = useRef("");
  const heardBuffer = useRef("");
  const botSpeaking = useRef(false);
  const speechEndedAt = useRef(0);
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
  const rememberedDestination = useRef<{ target: SaveTarget; id: string; label: string } | null>(null);

  const [status, setStatus] = useState("Ready to start");
  const [mood, setMood] = useState<RitaMood>("ready");
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState("");
  const [caption, setCaption] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "rita", text: "Hi, I’m Rita. What would you like to practise?" },
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

  const metric = useCallback(async (
    name: string,
    valueMs?: number,
    metadata?: Record<string, unknown>,
  ) => {
    if (!sessionId.current) return;
    try {
      await fetch("/api/rita-v3/session/metrics", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ sessionId: sessionId.current, name, valueMs, metadata }),
      });
    } catch {
      // Metrics never interrupt a lesson.
    }
  }, []);

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

  const runExtraction = useCallback(async (spoken: string, reply: string) => {
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
        const byKey = new Map(current.map((item) => [`${item.language}:${item.term.toLowerCase()}`, item]));
        for (const item of data.learningItems ?? [])
          byKey.set(`${item.language}:${item.term.toLowerCase()}`, item);
        return [...byKey.values()];
      });
      const requestedTarget = data.saveRequest && data.saveRequest !== "none" ? data.saveRequest : null;
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
        const wanted = String(data.destinationName ?? "").trim().toLocaleLowerCase();
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
            : saved.error ?? "The language items were collected but could not be saved.",
        );
      }
      setLearningOpen(true);
    } catch {
      // Learning extraction is intentionally outside the voice critical path.
    }
  }, [fetchDestinations]);

  const cancelFiller = useCallback(() => {
    if (fillerTimer.current) clearTimeout(fillerTimer.current);
    fillerTimer.current = null;
    fillerAbort.current?.abort();
    fillerAbort.current = null;
    try { fillerSource.current?.stop(); } catch { /* Already stopped. */ }
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
          : language === "de" || language === "en" ? language : dialect.startsWith("ar") ? "ar" : "en";
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
        source.onended = () => { if (fillerSource.current === source) fillerSource.current = null; };
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
        headers: await authHeaders().catch(() => new Headers({ "Content-Type": "application/json" })),
        body: JSON.stringify({
          sessionId: sessionId.current,
          providerSessionId: providerSessionId.current,
        }),
        keepalive: true,
      }).catch(() => undefined);
    }
    sessionId.current = "";
    providerSessionId.current = "";
    activeRef.current = false;
    mutedRef.current = false;
    setActive(false);
    setMuted(false);
    setMood("ready");
    setStatus("Lesson ended");
    setCaption("");
    // Chat and unsaved vocabulary are session-only by design.
    setMessages([{ id: crypto.randomUUID(), role: "rita", text: "Hi, I’m Rita. What would you like to practise?" }]);
    setLearning([]);
    rememberedDestination.current = null;
    destinationsRef.current = { flashSubjects: [], germanSubjects: [], germanSubtopics: [] };
    setDestinations(destinationsRef.current);
    setDestinationId("");
  }, [cancelFiller]);

  useEffect(() => () => void endLesson(), [endLesson]);

  async function startLesson() {
    if (starting || active) return;
    setStarting(true);
    setError("");
    setStatus("Connecting Rita v3…");
    try {
      const [{ PipecatClient }, { DailyTransport }] = await Promise.all([
        import("@pipecat-ai/client-js"),
        import("@pipecat-ai/daily-transport"),
      ]);
      generatedBuffer.current = "";
      heardBuffer.current = "";
      botSpeaking.current = false;
      const commitHeardReply = (interrupted = false) => {
        const reply = heardBuffer.current.trim();
        heardBuffer.current = "";
        if (!reply) return;
        setMessages((current) => [
          ...current,
          { id: crypto.randomUUID(), role: "rita", text: reply },
        ]);
        void runExtraction(lastUserText.current, reply);
        if (interrupted) void metric("interrupted");
      };
      const pc = new PipecatClient({
        transport: new DailyTransport({
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
        }),
        enableMic: true,
        enableCam: false,
        disconnectOnBotDisconnect: true,
        callbacks: {
          onConnected: () => {
            activeRef.current = true;
            setActive(true);
            setStatus("Rita is listening");
            setMood("listening");
            void metric("session_connected");
          },
          onBotStarted: (botResponse) => {
            const started = botResponse as {
              sessionId?: string;
              providerSessionId?: string | null;
            };
            sessionId.current = String(started.sessionId ?? "");
            providerSessionId.current = String(started.providerSessionId ?? "");
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
            void metric("provider_error");
          },
          onDeviceError: () => {
            setError("Microphone permission is blocked or the microphone is already in use.");
          },
          onUserStartedSpeaking: () => {
            cancelFiller();
            currentTurnHasFinalTranscript.current = false;
            if (botSpeaking.current) commitHeardReply(true);
            setStatus("I’m listening…");
            setMood("listening");
            void metric("speech_start");
          },
          onUserStoppedSpeaking: () => {
            speechEndedAt.current = performance.now();
            setStatus("Rita is thinking…");
            setMood("thinking");
            void metric("speech_end");
            scheduleFiller();
          },
          onUserTranscript: (data) => {
            setCaption(data.text);
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
            setStatus("Rita is answering…");
            void metric("llm_start");
          },
          onBotLlmText: ({ text }) => {
            generatedBuffer.current += text;
          },
          onBotOutput: (data) => {
            if (data.will_be_spoken === false) return;
            const audible = data.spoken_progress?.accumulated_text?.trim();
            if (audible) heardBuffer.current = audible;
            else if (data.spoken_status === "completed" && data.text.trim()) {
              heardBuffer.current = `${heardBuffer.current} ${data.text}`.trim();
            }
          },
          onBotTtsText: ({ text }) => {
            if (!heardBuffer.current && text.trim()) heardBuffer.current = text.trim();
          },
          onBotStartedSpeaking: () => {
            cancelFiller();
            botSpeaking.current = true;
            setStatus("Rita is speaking — interrupt whenever you want");
            setMood("talking");
            if (speechEndedAt.current) {
              void metric("first_audio", performance.now() - speechEndedAt.current, {
                generatedCharacters: generatedBuffer.current.length,
              });
              speechEndedAt.current = 0;
            }
          },
          onBotStoppedSpeaking: () => {
            botSpeaking.current = false;
            commitHeardReply(false);
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
      const ready = await pc.startBotAndConnect({
        endpoint: "/api/rita-v3/session/start",
        headers,
        requestData: { personality, language, dialect, mode },
        timeout: 20_000,
      });
      // startBotAndConnect returns bot-ready protocol data; session identifiers are
      // returned by the start endpoint and retained inside the transport. Fetch a
      // lightweight start response is not repeated, so the server also reconciles
      // orphaned sessions by timeout.
      void ready;
      setActive(true);
      activeRef.current = true;
      setStatus("Rita is listening");
    } catch (cause) {
      client.current = null;
      activeRef.current = false;
      setActive(false);
      setMood("ready");
      setStatus("Could not start Rita v3");
      setError(`${humanError(cause)} No legacy fallback was started.`);
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
    return <div className="grid min-h-screen place-items-center"><Loader2 className="animate-spin" /></div>;
  }

  const options =
    target === "flashcards"
      ? destinations.flashSubjects.map((item) => ({ id: item.id, label: item.name }))
      : destinations.germanSubtopics.map((item) => ({
          id: item.id,
          label: `${destinations.germanSubjects.find((parent) => parent.id === item.subject_id)?.name ?? "German"} / ${item.name}`,
        }));

  return (
    <main className="min-h-screen bg-[#faf9f6] text-[#211f24]">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,.95fr)]">
        <section className="flex min-h-screen flex-col border-r border-[#e6e1e8] bg-white">
          <header className="border-b border-[#ece7ee] px-5 py-5 sm:px-10">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Link to="/" className="text-2xl text-[#716c73]" aria-label="Leave Rita">×</Link>
                <h1 className="text-xl font-extrabold tracking-tight">RitaJet <span className="font-medium text-[#7c777f]">| Live lesson</span></h1>
              </div>
              {isAdmin && <Link to="/admin/rita-voice" className="rounded-full border border-[#ded7e4] px-4 py-2 text-sm font-bold">Voice admin</Link>}
            </div>
            <div className="mt-5 h-1 w-40 rounded-full bg-[#814be8]" />
            <p className="mt-3 text-xs font-bold text-[#5b4181]">Rita Realtime v3 · {MODEL_PROOF}</p>
            <p className="mt-2 text-sm font-semibold text-[#6d6671]">{status}</p>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-7 sm:px-10">
            <div className="mx-auto max-w-3xl space-y-7">
              {messages.map((message) => (
                <div key={message.id} className={message.role === "you" ? "ml-auto max-w-[80%] text-right text-[#377ad9]" : "max-w-[82%] text-lg leading-8"}>
                  {message.text}
                </div>
              ))}
              {caption && <p className="text-sm text-[#8a858d]">Live transcript: {caption}</p>}
              {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
            </div>
          </div>

          <div className="border-t border-[#ece7ee] p-4 sm:p-7">
            {!active ? (
              <div className="mx-auto max-w-3xl space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <select value={personality} onChange={(event) => setPersonality(event.target.value as Persona)} className="rounded-xl border border-[#ddd6e2] bg-white px-3 py-3 text-sm font-semibold">
                    <option value="kind">Kind teacher</option><option value="direct">Direct teacher</option><option value="playful">Playful teacher</option><option value="strict">Strict teacher</option>
                  </select>
                  <select value={language} onChange={(event) => setLanguage(event.target.value)} className="rounded-xl border border-[#ddd6e2] bg-white px-3 py-3 text-sm font-semibold">
                    <option value="automatic">Automatic language</option><option value="ar">Arabic</option><option value="de">German</option><option value="en">English</option>
                  </select>
                  <select value={dialect} onChange={(event) => setDialect(event.target.value)} className="rounded-xl border border-[#ddd6e2] bg-white px-3 py-3 text-sm font-semibold">
                    <option value="ar-JO">Jordanian Arabic</option><option value="standard">Standard Arabic</option><option value="en-GB">British English</option>
                  </select>
                  <select value={mode} onChange={(event) => setMode(event.target.value as LessonMode)} className="rounded-xl border border-[#ddd6e2] bg-white px-3 py-3 text-sm font-semibold">
                    <option value="free_conversation">Free conversation</option><option value="guided_lesson">Guided lesson</option><option value="pronunciation_drill">Pronunciation drill</option>
                  </select>
                </div>
                <button onClick={startLesson} disabled={starting} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#7b46df] px-5 py-4 font-extrabold text-white shadow-lg shadow-purple-200 disabled:opacity-60">
                  {starting ? <Loader2 className="animate-spin" size={18} /> : <Mic size={18} />} Start Rita Realtime v3
                </button>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl">
                <form onSubmit={sendText} className="rounded-3xl border border-[#ddd7e1] bg-white p-3 shadow-sm">
                  <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask Rita anything…" className="w-full border-0 bg-transparent px-3 py-3 outline-none" />
                  <div className="flex flex-wrap items-center gap-2 border-t border-[#eee9f0] pt-3">
                    <button type="button" onClick={toggleMute} className="flex items-center gap-1 rounded-full border border-[#ddd7e1] px-3 py-2 text-sm font-bold">{muted ? <MicOff size={15} /> : <Mic size={15} />}{muted ? "Unmute" : "Mute"}</button>
                    <button type="button" onClick={() => void loadDestinations("flashcards")} className="flex items-center gap-1 rounded-full border border-[#ddd7e1] px-3 py-2 text-sm font-bold"><Layers size={15} /> Learning ({learning.length})</button>
                    <button type="button" onClick={() => void endLesson()} className="ml-auto flex items-center gap-1 rounded-full px-3 py-2 text-sm font-bold text-red-700"><PhoneOff size={15} /> End lesson</button>
                    <button type="submit" className="grid h-10 w-10 place-items-center rounded-full bg-[#c8adff] text-white"><Send size={17} /></button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </section>

        <aside className="relative hidden min-h-screen overflow-hidden bg-[radial-gradient(circle_at_50%_45%,#59327f_0,#26163b_47%,#160d25_100%)] text-white lg:block">
          <div className="absolute left-8 top-7 font-bold">Rita</div>
          <div className="absolute right-8 top-7 flex items-center gap-2 text-sm"><span className="h-2 w-2 rounded-full bg-[#bd86ff]" />{active ? "Live" : "Ready"}</div>
          <div className="h-full"><RitaStage mood={mood} active={active} inputLevel={mood === "listening" ? 0.38 : 0} outputLevel={mood === "talking" ? 0.58 : 0} /></div>
        </aside>
      </div>

      {learningOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/30 sm:items-center sm:justify-center" onClick={() => setLearningOpen(false)}>
          <section className="max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-2xl sm:rounded-3xl sm:p-7" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between"><div><p className="text-sm font-bold text-[#7b46df]">Learning Tray</p><h2 className="text-2xl font-extrabold">Useful language from this lesson</h2></div><button onClick={() => setLearningOpen(false)}><X /></button></div>
            {!learning.length ? <p className="py-10 text-center text-[#77717a]">Ask for a translation, a word meaning, or a language word list. General knowledge will not be saved here.</p> : <div className="mt-6 divide-y divide-[#eee9f0]">{learning.map((item) => <div key={`${item.language}:${item.term}`} className="grid gap-1 py-4 sm:grid-cols-[1fr_1fr_auto]"><strong>{item.article ? `${item.article} ` : ""}{item.term}</strong><span className="text-[#67616a]">{item.meaning}</span><span className="text-xs font-bold uppercase text-[#8a60cf]">{item.language}</span></div>)}</div>}
            {learning.length > 0 && <div className="mt-6 rounded-2xl bg-[#f6f1ff] p-4"><div className="flex flex-wrap gap-2"><button onClick={() => void loadDestinations("flashcards")} className={`rounded-full px-4 py-2 text-sm font-bold ${target === "flashcards" ? "bg-[#7b46df] text-white" : "bg-white"}`}><Layers className="mr-1 inline" size={15} />Flashcards</button><button onClick={() => void loadDestinations("german_lab")} className={`rounded-full px-4 py-2 text-sm font-bold ${target === "german_lab" ? "bg-[#7b46df] text-white" : "bg-white"}`}><BookOpen className="mr-1 inline" size={15} />German Lab</button></div><div className="relative mt-3"><select value={destinationId} onChange={(event) => setDestinationId(event.target.value)} className="w-full appearance-none rounded-xl border border-[#ddd6e2] bg-white px-4 py-3 pr-10"><option value="">Choose a subject…</option>{options.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3.5" size={18} /></div>{rememberedDestination.current && <p className="mt-2 text-xs font-bold text-[#6f4bad]">Remembered for this lesson: {rememberedDestination.current.label}</p>}<button onClick={saveLearning} disabled={!destinationId || saving} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#21172c] px-4 py-3 font-bold text-white disabled:opacity-40">{saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}Save selected lesson language</button>{notice && <p className="mt-3 text-sm font-semibold">{notice}</p>}</div>}
            <p className="mt-5 flex items-center gap-2 text-xs text-[#77717a]"><Sparkles size={14} />Unsaved items and this chat are deleted when the lesson ends.</p>
          </section>
        </div>
      )}
    </main>
  );
}
