export type RitaVadCallbacks = {
  onSpeechStart: () => void;
  onSpeechEnd: (audio: Blob, durationMs: number) => void;
  onVolume: (level: number) => void;
  onError?: (error: Error) => void;
};

export type RitaVadController = {
  stream: MediaStream;
  setOutputSpeaking: (speaking: boolean) => void;
  stop: () => void;
};

function joinFrames(frames: Float32Array[]) {
  const length = frames.reduce((total, frame) => total + frame.length, 0);
  const joined = new Float32Array(length);
  let offset = 0;
  for (const frame of frames) {
    joined.set(frame, offset);
    offset += frame.length;
  }
  return joined;
}

function resample(input: Float32Array, sourceRate: number, targetRate = 16_000) {
  if (sourceRate === targetRate) return input;
  const ratio = sourceRate / targetRate;
  const length = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const position = i * ratio;
    const left = Math.floor(position);
    const right = Math.min(input.length - 1, left + 1);
    const mix = position - left;
    output[i] = input[left] * (1 - mix) + input[right] * mix;
  }
  return output;
}

function wavBlob(samples: Float32Array, sampleRate = 16_000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
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
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export async function startRitaVad(callbacks: RitaVadCallbacks): Promise<RitaVadController> {
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
    throw new Error("This browser does not support continuous voice lessons.");
  }
  const context = new AudioContextClass();
  await context.resume();
  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(2048, 1, 1);
  const silentGain = context.createGain();
  silentGain.gain.value = 0;
  source.connect(processor);
  processor.connect(silentGain);
  silentGain.connect(context.destination);

  const preRoll: Float32Array[] = [];
  let utterance: Float32Array[] = [];
  let speaking = false;
  let outputSpeaking = false;
  let hotFrames = 0;
  let silenceMs = 0;
  let speechMs = 0;
  let noiseFloor = 0.006;
  let stopped = false;

  const finish = () => {
    if (!speaking) return;
    const captured = joinFrames(utterance);
    const sourceDuration = (captured.length / context.sampleRate) * 1000;
    speaking = false;
    utterance = [];
    speechMs = 0;
    silenceMs = 0;
    hotFrames = 0;
    if (sourceDuration < 320) return;
    const mono16k = resample(captured, context.sampleRate);
    callbacks.onSpeechEnd(wavBlob(mono16k), Math.round(sourceDuration));
  };

  processor.onaudioprocess = (event) => {
    if (stopped) return;
    const input = event.inputBuffer.getChannelData(0);
    const frame = new Float32Array(input);
    let power = 0;
    for (let i = 0; i < frame.length; i += 1) power += frame[i] * frame[i];
    const rms = Math.sqrt(power / frame.length);
    const normalized = Math.min(1, Math.max(0, (rms - noiseFloor) * 18));
    callbacks.onVolume(normalized);
    const frameMs = (frame.length / context.sampleRate) * 1000;

    if (!speaking) {
      noiseFloor = Math.min(0.035, noiseFloor * 0.96 + rms * 0.04);
      preRoll.push(frame);
      while (preRoll.length > 7) preRoll.shift();
      const startThreshold = Math.max(0.017, noiseFloor * (outputSpeaking ? 4.8 : 3.1));
      hotFrames = rms > startThreshold ? hotFrames + 1 : 0;
      if (hotFrames >= 2) {
        speaking = true;
        utterance = [...preRoll];
        preRoll.length = 0;
        speechMs = utterance.reduce(
          (sum, item) => sum + (item.length / context.sampleRate) * 1000,
          0,
        );
        callbacks.onSpeechStart();
      }
      return;
    }

    utterance.push(frame);
    speechMs += frameMs;
    const endThreshold = Math.max(0.012, noiseFloor * 2.1);
    silenceMs = rms < endThreshold ? silenceMs + frameMs : 0;
    if ((silenceMs >= 620 && speechMs >= 500) || speechMs >= 35_000) finish();
  };

  return {
    stream,
    setOutputSpeaking(value) {
      outputSpeaking = value;
    },
    stop() {
      if (stopped) return;
      stopped = true;
      processor.onaudioprocess = null;
      try {
        processor.disconnect();
        source.disconnect();
        silentGain.disconnect();
      } catch {
        // Audio nodes may already be disconnected by the browser.
      }
      stream.getTracks().forEach((track) => track.stop());
      void context.close();
      callbacks.onVolume(0);
    },
  };
}
