import { ritaEndOfTurnDelay } from "@/lib/rita-turn-boundary";

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
};

export type RitaEconomicController = {
  stream: MediaStream;
  mute: (muted: boolean) => void;
  setOutputSpeaking: (speaking: boolean) => void;
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

function deepgramLanguages(accent: string, browserLocale: string) {
  const requested = accent.trim();
  if (/^ar(?:-[A-Z]{2})?$/i.test(requested)) return [requested];
  if (/^de/i.test(requested)) return ["de"];
  if (/^en-(?:US|GB|AU|IN|NZ)$/i.test(requested)) return [requested];
  if (requested.toLowerCase().includes("gulf")) return ["ar-AE"];
  if (/^ar/i.test(browserLocale)) return ["ar-JO"];
  if (/^de/i.test(browserLocale)) return ["de"];
  // Deepgram's multilingual Nova-3 endpoint currently does not include Arabic.
  // Probe Arabic and multilingual only for the first utterance, then keep the
  // better socket for the rest of the lesson.
  return ["ar-JO", "multi"];
}

type ProbeCandidate = RitaEconomicTranscript & { connection: DeepgramConnection };

type DeepgramConnection = {
  language: string;
  socket: WebSocket;
  finalParts: string[];
  intentionallyClosing: boolean;
};

function scriptRatio(text: string, pattern: RegExp) {
  const letters = Array.from(text).filter((character) => /\p{L}/u.test(character));
  if (!letters.length) return 0;
  return letters.filter((character) => pattern.test(character)).length / letters.length;
}

function candidateScore(candidate: ProbeCandidate) {
  const arabic = scriptRatio(candidate.text, /\p{Script=Arabic}/u);
  const latin = scriptRatio(candidate.text, /\p{Script=Latin}/u);
  let score = candidate.confidence;
  if (candidate.language.startsWith("ar")) score += arabic * 0.55 - latin * 0.18;
  else score += latin * 0.3 - arabic * 0.5;
  score += Math.min(0.08, candidate.text.length / 500);
  return score;
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
  url.searchParams.set("endpointing", "350");
  url.searchParams.set("utterance_end_ms", "1000");
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
  callbacks: RitaEconomicCallbacks;
}): Promise<RitaEconomicController> {
  const { callbacks } = args;
  const transcriptionMode = args.transcriptionMode ?? "deepgram";
  const languages = deepgramLanguages(args.accent, args.browserLocale);
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

  const encoder = new Linear16Encoder(context.sampleRate);
  let stopped = false;
  let muted = false;
  let outputSpeaking = false;
  let speaking = false;
  let pushToTalk = false;
  let hotFrames = 0;
  let quietMs = 0;
  let noiseFloor = 0.006;
  let turnStartedAt = 0;
  let turnAudio: Uint8Array[] = [];
  let suppressFinalUntil = 0;
  let preRoll: ArrayBuffer[] = [];
  let preRollBytes = 0;
  let selectedLanguage = languages.length === 1 ? languages[0] : "";
  let finalTimer = 0;
  let semanticTimer = 0;
  const candidates = new Map<string, ProbeCandidate>();
  const connections: DeepgramConnection[] = [];

  const sendAudio = (buffer: ArrayBuffer) => {
    for (const connection of connections) {
      if (connection.socket.readyState === WebSocket.OPEN) connection.socket.send(buffer.slice(0));
    }
  };

  const rememberPreRoll = (buffer: ArrayBuffer) => {
    preRoll.push(buffer);
    preRollBytes += buffer.byteLength;
    // 200 ms of 16 kHz mono linear16. It protects the first syllable without
    // paying Deepgram for the rest of the lesson's silence.
    while (preRollBytes > 6_400 && preRoll.length > 1) {
      preRollBytes -= preRoll[0].byteLength;
      preRoll.shift();
    }
  };

  const flushPreRoll = () => {
    for (const buffer of preRoll) {
      sendAudio(buffer);
      turnAudio.push(new Uint8Array(buffer.slice(0)));
    }
    preRoll = [];
    preRollBytes = 0;
  };

  const recoverTurn = (reason: string) => {
    if (!speaking || !turnAudio.length) return;
    const audio = pcm16Wav(turnAudio);
    const durationMs = Math.round(
      (turnAudio.reduce((sum, part) => sum + part.byteLength, 0) / 32_000) * 1000,
    );
    speaking = false;
    pushToTalk = false;
    hotFrames = 0;
    quietMs = 0;
    turnAudio = [];
    suppressFinalUntil = performance.now() + 1_000;
    callbacks.onInterim("");
    callbacks.onSpeechEnd?.();
    callbacks.onFallback?.({ audio, durationMs, reason });
  };

  const closeUnselected = (winner: DeepgramConnection) => {
    for (const connection of connections) {
      if (connection === winner) continue;
      connection.intentionallyClosing = true;
      try {
        if (connection.socket.readyState === WebSocket.OPEN)
          connection.socket.send(JSON.stringify({ type: "CloseStream" }));
        connection.socket.close(1000, "language selected");
      } catch {
        // The losing probe may have already closed after producing its result.
      }
    }
  };

  const emitCandidate = (candidate: ProbeCandidate) => {
    selectedLanguage = candidate.connection.language;
    candidates.clear();
    if (finalTimer) window.clearTimeout(finalTimer);
    finalTimer = 0;
    closeUnselected(candidate.connection);
    speaking = false;
    quietMs = 0;
    hotFrames = 0;
    turnAudio = [];
    callbacks.onInterim("");
    callbacks.onSpeechEnd?.();
    callbacks.onFinal(candidate);
  };

  const scheduleCandidate = (candidate: ProbeCandidate) => {
    if (semanticTimer) window.clearTimeout(semanticTimer);
    const extraDelay = Math.max(0, ritaEndOfTurnDelay(candidate.text) - 350);
    semanticTimer = window.setTimeout(() => {
      semanticTimer = 0;
      emitCandidate(candidate);
    }, extraDelay);
  };

  const selectProbe = () => {
    if (selectedLanguage || !candidates.size) return;
    const winner = [...candidates.values()].sort(
      (left, right) => candidateScore(right) - candidateScore(left),
    )[0];
    if (winner) emitCandidate(winner);
  };

  const keepAlive = window.setInterval(() => {
    for (const connection of connections) {
      if (connection.socket.readyState === WebSocket.OPEN)
        connection.socket.send(JSON.stringify({ type: "KeepAlive" }));
    }
  }, 8_000);

  if (transcriptionMode === "openai") callbacks.onReady("OpenAI transcription");
  for (const language of transcriptionMode === "deepgram" ? languages : []) {
    const socket = new WebSocket(listenUrl(language, args.keyterms ?? ["RitaJet"]), [
      "bearer",
      args.token,
    ]);
    socket.binaryType = "arraybuffer";
    const connection: DeepgramConnection = {
      language,
      socket,
      finalParts: [],
      intentionallyClosing: false,
    };
    connections.push(connection);
    socket.onopen = () => {
      const ready = connections.filter((item) => item.socket.readyState === WebSocket.OPEN).length;
      if (ready === languages.length)
        callbacks.onReady(languages.length > 1 ? "auto: ar-JO + multilingual probe" : language);
    };
    socket.onerror = () => {
      if (!stopped && !connection.intentionallyClosing)
        callbacks.onError(`deepgram_stream: ${language} connection failed.`);
    };
    socket.onclose = (event) => {
      if (!stopped && !connection.intentionallyClosing && event.code !== 1000) {
        callbacks.onError(`deepgram_stream: ${language} connection closed (${event.code}).`);
        window.setTimeout(() => {
          const usable = connections.some(
            (item) => !item.intentionallyClosing && item.socket.readyState === WebSocket.OPEN,
          );
          if (!usable) recoverTurn("Deepgram connection ended before the transcript was final.");
        }, 120);
      }
    };
    socket.onmessage = (event) => {
      if (typeof event.data !== "string") return;
      if (selectedLanguage && selectedLanguage !== language) return;
      let message: DeepgramResult;
      try {
        message = JSON.parse(event.data) as DeepgramResult;
      } catch {
        return;
      }
      if (message.type === "SpeechStarted") {
        if (!speaking) {
          speaking = true;
          turnStartedAt = performance.now();
          callbacks.onSpeechStart();
        }
        return;
      }
      if (message.type !== "Results") return;
      if (semanticTimer) {
        window.clearTimeout(semanticTimer);
        semanticTimer = 0;
      }
      const alternative = message.channel?.alternatives?.[0];
      const text = String(alternative?.transcript ?? "").trim();
      if (!text) return;
      if (message.is_final) connection.finalParts.push(text);
      else if (selectedLanguage || !candidates.size)
        callbacks.onInterim([...connection.finalParts, text].join(" ").trim());
      if (!message.speech_final) return;
      const complete = connection.finalParts.join(" ").replace(/\s+/g, " ").trim();
      connection.finalParts = [];
      if (!complete) return;
      const candidate: ProbeCandidate = {
        text: complete,
        confidence: Number(alternative?.confidence ?? 0),
        language: alternative?.languages?.[0] || language,
        durationMs: turnStartedAt ? Math.round(performance.now() - turnStartedAt) : 0,
        connection,
      };
      if (performance.now() < suppressFinalUntil) return;
      if (selectedLanguage) {
        scheduleCandidate(candidate);
        return;
      }
      candidates.set(language, candidate);
      if (candidates.size === languages.length) selectProbe();
      else if (!finalTimer) finalTimer = window.setTimeout(selectProbe, 350);
    };
  }

  capture.port.onmessage = (event: MessageEvent<Float32Array>) => {
    if (stopped) return;
    const frame = event.data;
    let power = 0;
    for (let index = 0; index < frame.length; index += 1) power += frame[index] * frame[index];
    const rms = Math.sqrt(power / Math.max(1, frame.length));
    const normalized = Math.min(1, Math.max(0, (rms - noiseFloor) * 18));
    callbacks.onVolume(normalized);
    let startedThisFrame = false;
    const frameMs = (frame.length / context.sampleRate) * 1000;
    if (!speaking) {
      noiseFloor = Math.min(0.018, noiseFloor * 0.98 + rms * 0.02);
      const threshold = Math.max(0.01, noiseFloor * (outputSpeaking ? 3.2 : 1.9));
      hotFrames = rms > threshold || pushToTalk ? hotFrames + 1 : 0;
      if (hotFrames >= (pushToTalk ? 1 : outputSpeaking ? 10 : 5)) {
        speaking = true;
        startedThisFrame = true;
        turnStartedAt = performance.now();
        turnAudio = [];
        quietMs = 0;
        suppressFinalUntil = 0;
        callbacks.onSpeechStart();
      }
    } else if (!pushToTalk) {
      const threshold = Math.max(0.008, noiseFloor * (outputSpeaking ? 3 : 1.55));
      quietMs = rms < threshold ? quietMs + frameMs : 0;
    }
    const pcm = encoder.encode(frame);
    if (!pcm.byteLength) return;
    const buffer = pcm.buffer.slice(0) as ArrayBuffer;
    if (muted) {
      preRoll = [];
      preRollBytes = 0;
      return;
    }
    if (!speaking) {
      rememberPreRoll(buffer);
      return;
    }
    if (startedThisFrame) flushPreRoll();
    turnAudio.push(new Uint8Array(buffer.slice(0)));
    sendAudio(buffer);
    if (!pushToTalk && quietMs >= (transcriptionMode === "openai" ? 450 : 1_500) && !semanticTimer)
      recoverTurn(
        transcriptionMode === "openai"
          ? "Legacy transcription turn completed."
          : "Deepgram did not finalize the turn in time.",
      );
  };

  return {
    stream,
    mute(value) {
      muted = value;
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !value;
      });
    },
    setOutputSpeaking(value) {
      outputSpeaking = value;
    },
    beginPushToTalk() {
      if (stopped || muted) return;
      pushToTalk = true;
      hotFrames = 1;
    },
    endPushToTalk() {
      pushToTalk = false;
      if (!speaking) return;
      callbacks.onSpeechEnd?.();
      for (const connection of connections) {
        if (connection.socket.readyState === WebSocket.OPEN)
          connection.socket.send(JSON.stringify({ type: "Finalize" }));
      }
      window.setTimeout(
        () => {
          if (speaking) recoverTurn("Push-to-talk ended before Deepgram finalized the turn.");
        },
        transcriptionMode === "openai" ? 50 : 1_200,
      );
    },
    stop() {
      if (stopped) return;
      stopped = true;
      window.clearInterval(keepAlive);
      if (finalTimer) window.clearTimeout(finalTimer);
      if (semanticTimer) window.clearTimeout(semanticTimer);
      capture.port.onmessage = null;
      for (const connection of connections) {
        try {
          connection.intentionallyClosing = true;
          if (connection.socket.readyState === WebSocket.OPEN) {
            connection.socket.send(JSON.stringify({ type: "CloseStream" }));
            connection.socket.close(1000, "lesson ended");
          } else connection.socket.close();
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
