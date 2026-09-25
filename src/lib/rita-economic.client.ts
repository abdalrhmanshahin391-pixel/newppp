export type RitaEconomicTranscript = {
  text: string;
  confidence: number;
  language: string;
  durationMs: number;
};

export type RitaEconomicCallbacks = {
  onReady: (language: string) => void;
  onVolume: (level: number) => void;
  onSpeechStart: () => void;
  onSpeechEnd?: () => void;
  onInterim: (text: string) => void;
  onFinal: (turn: RitaEconomicTranscript) => void;
  onFallback?: (turn: { audio: Blob; durationMs: number; reason: string }) => void;
  onError: (message: string) => void;
  /** Fired each time the Deepgram stream is reopened after a drop or idle pause. */
  onReconnect?: (reason: "dropped" | "idle") => void;
  /** Confirmed real speech (≥2 transcribed words or ≥400 ms of voice). Only this may interrupt Rita. */
  onBargeIn?: () => void;
  onTurnSignal?: (event: "signal_start" | "vad_start" | "speech_confirmed" | "speech_end", reason?: string) => void;
  onConnectionState?: (state: "connecting" | "listening" | "reconnecting") => void;
  onDiagnostic?: (event: "socket_open" | "first_audio_sent" | "deepgram_speech" | "deepgram_result" | "socket_close", detail?: string) => void;
};

export type RitaEconomicController = {
  stream: MediaStream;
  mute: (muted: boolean) => void;
  setOutputSpeaking: (speaking: boolean, spokenText?: string) => void;
  beginPushToTalk: () => void;
  endPushToTalk: () => void;
  stop: () => void;
};

type DeepgramResult = {
  type?: string;
  is_final?: boolean;
  speech_final?: boolean;
  start?: number;
  duration?: number;
  channel?: {
    alternatives?: Array<{
      transcript?: string;
      confidence?: number;
      languages?: string[];
    }>;
  };
};

const WORKLET_SOURCE = `
class RitaEconomicCapture extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (input && input.length) this.port.postMessage(input.slice(0));
    return true;
  }
}
registerProcessor("rita-economic-capture", RitaEconomicCapture);
`;

class Linear16Encoder {
  private carry = new Float32Array(0);
  private position = 0;

  constructor(
    private readonly sourceRate: number,
    private readonly targetRate = 16_000,
  ) {}

  encode(frame: Float32Array) {
    const joined = new Float32Array(this.carry.length + frame.length);
    joined.set(this.carry);
    joined.set(frame, this.carry.length);
    const ratio = this.sourceRate / this.targetRate;
    const values: number[] = [];
    let cursor = this.position;
    while (cursor + 1 < joined.length) {
      const left = Math.floor(cursor);
      const mix = cursor - left;
      const sample = joined[left] * (1 - mix) + joined[left + 1] * mix;
      values.push(Math.max(-1, Math.min(1, sample)));
      cursor += ratio;
    }
    const consumed = Math.floor(cursor);
    this.position = cursor - consumed;
    this.carry = joined.slice(Math.min(consumed, joined.length));
    const pcm = new Int16Array(values.length);
    for (let index = 0; index < values.length; index += 1) {
      const sample = values[index];
      pcm[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    return pcm;
  }
}

export function selectRitaDeepgramLanguage(accent: string, browserLocale: string) {
  const requested = accent.trim();
  if (/^ar(?:-[A-Z]{2})?$/i.test(requested)) return requested;
  if (/^de/i.test(requested)) return "de";
  if (/^en-(?:US|GB|AU|IN|NZ)$/i.test(requested)) return requested;
  if (/^en/i.test(requested)) return "en-US";
  if (requested.toLowerCase().includes("gulf")) return "ar-AE";
  if (/^ar/i.test(browserLocale)) return "ar-JO";
  if (/^de/i.test(browserLocale)) return "de";
  // Rita's automatic voice lessons default to conversational Arabic. The
  // saved lesson preference is passed as `accent`; browser English alone must
  // not force an Arabic learner onto an English-only recognizer.
  return "ar-JO";
}

type DeepgramConnection = {
  language: string;
  socket: WebSocket;
  finalParts: string[];
  intentionallyClosing: boolean;
  generation: number;
  /** Audio captured while the socket is still connecting (reconnect / idle reopen). */
  pending: ArrayBuffer[];
};

export const RITA_RECONNECT_DELAYS_MS = [250, 750, 1_500] as const;
export const RITA_OUTPUT_ECHO_GUARD_MS = 320;

function normalizedWords(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function isLikelyRitaEcho(transcript: string, spokenText: string) {
  const heard = normalizedWords(transcript);
  const output = normalizedWords(spokenText);
  if (heard.length < 2 || output.length < 2) return false;
  const outputSet = new Set(output);
  const overlap = heard.filter((word) => outputSet.has(word)).length / heard.length;
  return overlap >= 0.75;
}

export function isRitaStopCommand(transcript: string) {
  return /^(?:لا|وقف|توقف|اسكتي|بس|stop|pause|stopp)$/iu.test(transcript.trim());
}

function listenUrl(language: string, keyterms: string[]) {
  const url = new URL("wss://api.deepgram.com/v1/listen");
  url.searchParams.set("model", "nova-3");
  url.searchParams.set("language", language);
  url.searchParams.set("encoding", "linear16");
  url.searchParams.set("sample_rate", "16000");
  url.searchParams.set("channels", "1");
  url.searchParams.set("interim_results", "true");
  url.searchParams.set("punctuate", "true");
  url.searchParams.set("smart_format", "true");
  url.searchParams.set("vad_events", "true");
  url.searchParams.set("endpointing", language.startsWith("ar") ? "350" : "300");
  url.searchParams.set("utterance_end_ms", "800");
  for (const term of keyterms.slice(0, 25)) {
    const clean = term.trim().slice(0, 80);
    if (clean) url.searchParams.append("keyterm", clean);
  }
  return url.toString();
}

function pcm16Wav(parts: Uint8Array[], sampleRate = 16_000) {
  const byteLength = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const buffer = new ArrayBuffer(44 + byteLength);
  const view = new DataView(buffer);
  const write = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1)
      view.setUint8(offset + index, value.charCodeAt(index));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + byteLength, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, byteLength, true);
  const output = new Uint8Array(buffer, 44);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export async function startRitaEconomicListening(args: {
  token: string;
  transcriptionMode?: "deepgram" | "openai";
  accent: string;
  browserLocale: string;
  keyterms?: string[];
  /** Mints a fresh short-lived Deepgram token for reconnects. */
  refreshToken?: () => Promise<string>;
  callbacks: RitaEconomicCallbacks;
}): Promise<RitaEconomicController> {
  const { callbacks } = args;
  const transcriptionMode = args.transcriptionMode ?? "deepgram";
  const language = selectRitaDeepgramLanguage(args.accent, args.browserLocale);
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
  });
  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) {
    stream.getTracks().forEach((track) => track.stop());
    throw new Error("audio_capture: This browser does not support Rita Economic v2.");
  }
  const context = new AudioContextClass();
  await context.resume();
  const workletUrl = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: "text/javascript" }));
  try {
    await context.audioWorklet.addModule(workletUrl);
  } finally {
    URL.revokeObjectURL(workletUrl);
  }
  const source = context.createMediaStreamSource(stream);
  const capture = new AudioWorkletNode(context, "rita-economic-capture", {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  });
  const silent = context.createGain();
  silent.gain.value = 0;
  source.connect(capture);
  capture.connect(silent);
  silent.connect(context.destination);

  type ListeningState = "connecting" | "listening" | "speaking" | "finalizing" | "reconnecting" | "stopped";
  const encoder = new Linear16Encoder(context.sampleRate);
  let state: ListeningState = transcriptionMode === "deepgram" ? "connecting" : "listening";
  let stopped = false;
  let muted = false;
  let outputSpeaking = false;
  let pushToTalk = false;
  let hotFrames = 0;
  let onsetMs = 0;
  let quietMs = 0;
  let noiseFloor = 0.006;
  let smoothedRms = 0;
  let turnStartedAt = 0;
  let turnAudio: Uint8Array[] = [];
  let finalParts: string[] = [];
  let suppressFinalUntil = 0;
  let preRoll: ArrayBuffer[] = [];
  let preRollBytes = 0;
  let connection: DeepgramConnection | null = null;
  let connectionGeneration = 0;
  let reconnectAttempt = 0;
  let reconnectTimer = 0;
  let currentToken = args.token;
  let pendingAudio: ArrayBuffer[] = [];
  let fallbackStarted = false;
  let bargedIn = false;
  let voicedMs = 0;
  let heardWords = false;
  let outputText = "";
  let outputGuardUntil = 0;
  let receivedResultOnConnection = false;

  const setConnectionState = (next: "connecting" | "listening" | "reconnecting") => {
    if (state !== "speaking" && state !== "finalizing" && state !== "stopped") state = next;
    callbacks.onConnectionState?.(next);
  };

  const confirmBargeIn = () => {
    if (bargedIn || stopped) return;
    bargedIn = true;
    callbacks.onTurnSignal?.("speech_confirmed");
    callbacks.onBargeIn?.();
  };

  const resetTurn = () => {
    state = connection?.socket.readyState === WebSocket.OPEN || transcriptionMode === "openai"
      ? "listening"
      : "reconnecting";
    pushToTalk = false;
    hotFrames = 0;
    onsetMs = 0;
    quietMs = 0;
    turnAudio = [];
    finalParts = [];
    bargedIn = false;
    voicedMs = 0;
    heardWords = false;
    turnStartedAt = 0;
    callbacks.onInterim("");
  };

  const emitFinal = (text: string, confidence: number, resultLanguage = language, reason = "deepgram_final") => {
    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean || stopped || fallbackStarted || performance.now() < suppressFinalUntil) return;
    state = "finalizing";
    callbacks.onInterim("");
    callbacks.onSpeechEnd?.();
    callbacks.onTurnSignal?.("speech_end", reason);
    const durationMs = turnStartedAt ? Math.round(performance.now() - turnStartedAt) : 0;
    resetTurn();
    callbacks.onFinal({ text: clean, confidence, language: resultLanguage, durationMs });
  };

  const recoverTurn = (reason: string) => {
    if ((state !== "speaking" && state !== "finalizing") || !turnAudio.length || fallbackStarted) return;
    const complete = finalParts.join(" ").replace(/\s+/g, " ").trim();
    if (complete) {
      emitFinal(complete, 0.8, language, "utterance_end");
      return;
    }
    if (!heardWords && voicedMs < 600) {
      resetTurn();
      callbacks.onTurnSignal?.("speech_end", "silent_reconnect");
      return;
    }
    fallbackStarted = true;
    state = "finalizing";
    const audio = pcm16Wav(turnAudio);
    const durationMs = Math.round(
      (turnAudio.reduce((sum, part) => sum + part.byteLength, 0) / 32_000) * 1000,
    );
    suppressFinalUntil = performance.now() + 1_000;
    callbacks.onInterim("");
    callbacks.onSpeechEnd?.();
    callbacks.onTurnSignal?.("speech_end", "fallback_stt");
    callbacks.onFallback?.({ audio, durationMs, reason });
    state = connection?.socket.readyState === WebSocket.OPEN ? "listening" : "reconnecting";
    pushToTalk = false;
    hotFrames = 0;
    quietMs = 0;
    turnAudio = [];
    finalParts = [];
  };

  const rememberPreRoll = (buffer: ArrayBuffer) => {
    preRoll.push(buffer);
    preRollBytes += buffer.byteLength;
    while (preRollBytes > 16_000 && preRoll.length > 1) {
      preRollBytes -= preRoll[0].byteLength;
      preRoll.shift();
    }
  };

  const queuePending = (buffer: ArrayBuffer) => {
    pendingAudio.push(buffer.slice(0));
    if (pendingAudio.length > 150) pendingAudio.shift();
  };

  const sendAudio = (buffer: ArrayBuffer) => {
    const live = connection;
    if (live && !live.intentionallyClosing && live.socket.readyState === WebSocket.OPEN) {
      live.socket.send(buffer.slice(0));
      return;
    }
    queuePending(buffer);
  };

  const appendPreRollToTurn = () => {
    for (const buffer of preRoll) {
      turnAudio.push(new Uint8Array(buffer.slice(0)));
    }
    preRoll = [];
    preRollBytes = 0;
  };

  const startTurn = (source: "local_vad" | "deepgram") => {
    if (state === "speaking" || state === "finalizing" || state === "stopped") return false;
    state = "speaking";
    turnStartedAt = performance.now();
    turnAudio = [];
    finalParts = [];
    quietMs = 0;
    onsetMs = 0;
    suppressFinalUntil = 0;
    fallbackStarted = false;
    bargedIn = false;
    voicedMs = 0;
    heardWords = false;
    appendPreRollToTurn();
    callbacks.onSpeechStart();
    callbacks.onTurnSignal?.("vad_start", source);
    callbacks.onDiagnostic?.("first_audio_sent", "continuous_stream");
    return true;
  };

  const scheduleReconnect = () => {
    if (stopped || reconnectTimer) return;
    const delay = RITA_RECONNECT_DELAYS_MS[reconnectAttempt];
    if (delay === undefined) {
      if (state === "speaking" || state === "finalizing") recoverTurn("Deepgram connection was lost.");
      else setConnectionState("reconnecting");
      return;
    }
    reconnectAttempt += 1;
    setConnectionState("reconnecting");
    const expectedGeneration = connectionGeneration;
    reconnectTimer = window.setTimeout(async () => {
      reconnectTimer = 0;
      if (stopped || expectedGeneration !== connectionGeneration) return;
      try {
        if (args.refreshToken) currentToken = await args.refreshToken();
      } catch {
        scheduleReconnect();
        return;
      }
      if (!stopped && expectedGeneration === connectionGeneration) openConnection(true);
    }, delay);
  };

  const openConnection = (reopening = false) => {
    if (stopped || transcriptionMode !== "deepgram") return;
    const generation = ++connectionGeneration;
    if (reopening) callbacks.onReconnect?.("dropped");
    else setConnectionState("connecting");
    const socket = new WebSocket(listenUrl(language, args.keyterms ?? ["RitaJet"]), [
      "bearer",
      currentToken,
    ]);
    socket.binaryType = "arraybuffer";
    const next: DeepgramConnection = {
      language,
      socket,
      finalParts: [],
      intentionallyClosing: false,
      generation,
      pending: [],
    };
    connection = next;
    socket.onopen = () => {
      if (stopped || connection?.generation !== generation) {
        socket.close(1000, "stale connection");
        return;
      }
      reconnectAttempt = 0;
      receivedResultOnConnection = false;
      const buffered = pendingAudio;
      pendingAudio = [];
      for (const buffer of buffered) socket.send(buffer);
      setConnectionState("listening");
      callbacks.onDiagnostic?.("socket_open", language);
      if (!reopening) callbacks.onReady(language);
    };
    socket.onerror = () => undefined;
    socket.onclose = (event) => {
      if (stopped || next.intentionallyClosing || connection?.generation !== generation) return;
      console.warn("Rita Deepgram socket closed", { code: event.code, reason: event.reason || "none", language });
      callbacks.onDiagnostic?.("socket_close", `${event.code}:${event.reason || "none"}`);
      scheduleReconnect();
    };
    socket.onmessage = (event) => {
      if (stopped || connection?.generation !== generation || typeof event.data !== "string") return;
      let message: DeepgramResult;
      try {
        message = JSON.parse(event.data) as DeepgramResult;
      } catch {
        return;
      }
      if (message.type === "SpeechStarted") {
        startTurn("deepgram");
        callbacks.onDiagnostic?.("deepgram_speech");
        return;
      }
      if (message.type === "UtteranceEnd") {
        const complete = finalParts.join(" ").replace(/\s+/g, " ").trim();
        finalParts = [];
        if (complete) emitFinal(complete, 0.8, language, "utterance_end");
        return;
      }
      if (message.type !== "Results") return;
      if (!receivedResultOnConnection) {
        receivedResultOnConnection = true;
        callbacks.onDiagnostic?.("deepgram_result");
      }
      const alternative = message.channel?.alternatives?.[0];
      const text = String(alternative?.transcript ?? "").trim();
      if (!text) return;
      heardWords = true;
      const combined = [...finalParts, text].join(" ").replace(/\s+/g, " ").trim();
      if (outputSpeaking) {
        const canInterrupt = performance.now() >= outputGuardUntil;
        if (
          isRitaStopCommand(combined) ||
          (canInterrupt && normalizedWords(combined).length >= 2 && !isLikelyRitaEcho(combined, outputText))
        ) confirmBargeIn();
      } else if (normalizedWords(combined).length >= 2) confirmBargeIn();
      if (message.is_final) finalParts.push(text);
      else callbacks.onInterim(combined);
      if (message.speech_final) {
        const complete = finalParts.join(" ").replace(/\s+/g, " ").trim();
        finalParts = [];
        emitFinal(
          complete,
          Number(alternative?.confidence ?? 0),
          alternative?.languages?.[0] || language,
          "deepgram_final",
        );
      }
    };
  };

  callbacks.onConnectionState?.(transcriptionMode === "deepgram" ? "connecting" : "listening");
  if (transcriptionMode === "deepgram") openConnection();
  else callbacks.onReady("OpenAI transcription");

  const keepAlive = window.setInterval(() => {
    const live = connection;
    if (live?.socket.readyState === WebSocket.OPEN)
      live.socket.send(JSON.stringify({ type: "KeepAlive" }));
  }, 4_500);

  capture.port.onmessage = (event: MessageEvent<Float32Array>) => {
    if (stopped) return;
    const frame = event.data;
    let power = 0;
    for (let index = 0; index < frame.length; index += 1) power += frame[index] * frame[index];
    const rms = Math.sqrt(power / Math.max(1, frame.length));
    smoothedRms = smoothedRms ? smoothedRms * 0.82 + rms * 0.18 : rms;
    const normalized = Math.min(1, Math.max(0, (smoothedRms - noiseFloor) * 22));
    callbacks.onVolume(normalized);
    const activeTurn = state === "speaking" || state === "finalizing";
    let startedThisFrame = false;
    const frameMs = (frame.length / context.sampleRate) * 1000;
    if (!activeTurn) {
      const threshold = Math.max(outputSpeaking ? 0.009 : 0.0065, noiseFloor * (outputSpeaking ? 2.1 : 1.55));
      const aboveThreshold = smoothedRms > threshold || pushToTalk;
      if (!aboveThreshold && smoothedRms < noiseFloor * 1.25) {
        noiseFloor = Math.min(0.014, noiseFloor * 0.995 + smoothedRms * 0.005);
      }
      if (aboveThreshold) {
        if (!onsetMs) callbacks.onTurnSignal?.("signal_start", "local_vad");
        onsetMs += frameMs;
        hotFrames += 1;
      } else {
        onsetMs = Math.max(0, onsetMs - frameMs * 1.5);
        hotFrames = 0;
      }
      const confirmationMs = pushToTalk ? 0 : outputSpeaking ? 90 : 45;
      if (onsetMs >= confirmationMs) {
        startedThisFrame = true;
        startTurn("local_vad");
      }
    } else if (!pushToTalk) {
      const threshold = Math.max(outputSpeaking ? 0.008 : 0.006, noiseFloor * (outputSpeaking ? 1.9 : 1.35));
      if (smoothedRms < threshold) quietMs += frameMs;
      else quietMs = Math.max(0, quietMs - frameMs * 2);
      if (smoothedRms >= threshold) voicedMs += frameMs;
      if (!outputSpeaking && voicedMs >= 220) confirmBargeIn();
    }
    const pcm = encoder.encode(frame);
    if (!pcm.byteLength) return;
    const buffer = pcm.buffer.slice(0) as ArrayBuffer;
    if (muted) {
      preRoll = [];
      preRollBytes = 0;
      return;
    }
    if (transcriptionMode === "deepgram") {
      sendAudio(buffer);
    }
    if (state !== "speaking" && state !== "finalizing") {
      rememberPreRoll(buffer);
      return;
    }
    if (startedThisFrame && !turnAudio.length) appendPreRollToTurn();
    turnAudio.push(new Uint8Array(buffer.slice(0)));
    const fallbackSilenceMs = transcriptionMode === "openai" ? 450 : 1_150;
    if (!pushToTalk && quietMs >= fallbackSilenceMs) {
      state = "finalizing";
      recoverTurn(
        transcriptionMode === "openai"
          ? "Legacy transcription turn completed."
          : "Deepgram did not finalize the turn in time.",
      );
    }
  };

  return {
    stream,
    mute(value) {
      muted = value;
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !value;
      });
    },
    setOutputSpeaking(value, spokenText) {
      outputSpeaking = value;
      if (typeof spokenText === "string" && spokenText.trim())
        outputText = `${outputText} ${spokenText}`.trim();
      outputGuardUntil = performance.now() + RITA_OUTPUT_ECHO_GUARD_MS;
      if (!value) outputText = "";
    },
    beginPushToTalk() {
      if (stopped || muted) return;
      pushToTalk = true;
      hotFrames = 1;
    },
    endPushToTalk() {
      pushToTalk = false;
      if (state !== "speaking") return;
      state = "finalizing";
      callbacks.onSpeechEnd?.();
      const live = connection;
      if (live?.socket.readyState === WebSocket.OPEN)
        live.socket.send(JSON.stringify({ type: "Finalize" }));
      window.setTimeout(() => {
        if (!stopped && state === "finalizing") recoverTurn("Push-to-talk ended before transcription finalized.");
      }, transcriptionMode === "openai" ? 50 : 1_200);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      state = "stopped";
      window.clearInterval(keepAlive);
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      capture.port.onmessage = null;
      const live = connection;
      if (live) {
        live.intentionallyClosing = true;
        try {
          if (live.socket.readyState === WebSocket.OPEN)
            live.socket.send(JSON.stringify({ type: "CloseStream" }));
          live.socket.close(1000, "lesson ended");
        } catch {
          // The browser may already have torn down the socket.
        }
      }
      try {
        capture.disconnect();
        source.disconnect();
        silent.disconnect();
      } catch {
        // Audio nodes may already be disconnected.
      }
      stream.getTracks().forEach((track) => track.stop());
      void context.close();
      callbacks.onVolume(0);
    },
  };
}
