const PLAYER_SOURCE = `
class RitaPcmPlayer extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];
    this.offset = 0;
    this.phase = 0;
    this.ratio = 24000 / sampleRate;
    this.ended = false;
    this.started = false;
    this.activeSegment = null;
    this.activeSegmentSamples = 0;
    this.endedSegments = new Set();
    this.port.onmessage = (event) => {
      if (event.data.type === "chunk") {
        this.queue.push({ samples: new Int16Array(event.data.buffer), segmentIndex: event.data.segmentIndex });
        this.ended = false;
      } else if (event.data.type === "end") {
        this.ended = true;
      } else if (event.data.type === "segment_end") {
        this.endedSegments.add(event.data.segmentIndex);
        if (this.activeSegment === event.data.segmentIndex && !this.queue.some((item) => item.segmentIndex === event.data.segmentIndex)) {
          this.port.postMessage({ type: "segment_ended", segmentIndex: this.activeSegment, samples: this.activeSegmentSamples });
          this.activeSegment = null;
          this.activeSegmentSamples = 0;
        }
      } else if (event.data.type === "flush") {
        this.queue = [];
        this.offset = 0;
        this.phase = 0;
        this.ended = false;
        this.started = false;
        this.activeSegment = null;
        this.activeSegmentSamples = 0;
        this.endedSegments.clear();
      }
    };
  }
  sampleAt(relative) {
    let queueIndex = 0;
    let index = this.offset + relative;
    while (queueIndex < this.queue.length) {
      const chunk = this.queue[queueIndex].samples;
      if (index < chunk.length) return chunk[index] / 32768;
      index -= chunk.length;
      queueIndex += 1;
    }
    return null;
  }
  advance(count) {
    while (count > 0 && this.queue.length) {
      const current = this.queue[0];
      const available = current.samples.length - this.offset;
      if (count < available) {
        this.offset += count;
        this.activeSegmentSamples += count;
        return;
      }
      count -= available;
      this.activeSegmentSamples += available;
      this.queue.shift();
      this.offset = 0;
      const sameSegmentQueued = this.queue.some((item) => item.segmentIndex === current.segmentIndex);
      if (!sameSegmentQueued && this.endedSegments.has(current.segmentIndex)) {
        this.port.postMessage({ type: "segment_ended", segmentIndex: current.segmentIndex, samples: this.activeSegmentSamples });
        this.endedSegments.delete(current.segmentIndex);
        this.activeSegment = null;
        this.activeSegmentSamples = 0;
      }
    }
  }
  process(inputs, outputs) {
    const output = outputs[0][0];
    output.fill(0);
    let wrote = 0;
    while (wrote < output.length && this.queue.length) {
      const segmentIndex = this.queue[0].segmentIndex;
      if (this.activeSegment !== segmentIndex) {
        this.activeSegment = segmentIndex;
        this.activeSegmentSamples = 0;
        if (segmentIndex >= 0) this.port.postMessage({ type: "segment_started", segmentIndex });
      }
      const leftIndex = Math.floor(this.phase);
      const mix = this.phase - leftIndex;
      const left = this.sampleAt(leftIndex);
      if (left === null) break;
      const right = this.sampleAt(leftIndex + 1) ?? left;
      output[wrote++] = left * (1 - mix) + right * mix;
      this.phase += this.ratio;
      const consumed = Math.floor(this.phase);
      if (consumed) {
        this.phase -= consumed;
        this.advance(consumed);
      }
    }
    if (wrote && !this.started) {
      this.started = true;
      this.port.postMessage({ type: "started" });
    }
    if (this.ended && !this.queue.length && this.started) {
      this.started = false;
      this.ended = false;
      this.port.postMessage({ type: "drained" });
    }
    return true;
  }
}
registerProcessor("rita-pcm-player", RitaPcmPlayer);
`;

export type RitaPcmPlayerController = {
  enqueueResponse: (
    response: Response,
    signal: AbortSignal,
    segmentIndex: number,
    onProgress?: (event: { type: "first_byte" | "received" | "queued"; bytes: number }) => void,
  ) => Promise<Blob>;
  finish: () => void;
  replay: (blob: Blob) => Promise<void>;
  interrupt: () => void;
  close: () => void;
};

export async function createRitaPcmPlayer(callbacks: {
  onStarted: () => void;
  onEnded: () => void;
  onSegmentStarted?: (segmentIndex: number) => void;
  onSegmentEnded?: (segmentIndex: number, playedAudioMs: number) => void;
  onInterrupted?: (segmentIndex: number | null) => void;
}): Promise<RitaPcmPlayerController> {
  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) throw new Error("pcm_playback: Web Audio is not supported.");
  const context = new AudioContextClass({ sampleRate: 24_000 });
  const moduleUrl = URL.createObjectURL(new Blob([PLAYER_SOURCE], { type: "text/javascript" }));
  try {
    await context.audioWorklet.addModule(moduleUrl);
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
  const node = new AudioWorkletNode(context, "rita-pcm-player", {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  });
  node.connect(context.destination);
  node.port.onmessage = (event) => {
      if (event.data?.type === "started") callbacks.onStarted();
      if (event.data?.type === "drained") callbacks.onEnded();
      if (event.data?.type === "segment_started")
        callbacks.onSegmentStarted?.(Number(event.data.segmentIndex));
      if (event.data?.type === "segment_ended")
        callbacks.onSegmentEnded?.(
          Number(event.data.segmentIndex),
          Math.round((Number(event.data.samples) / 24_000) * 1000),
        );
  };

  let activeSegment: number | null = null;
  const sendBytes = (bytes: Uint8Array, segmentIndex = -1) => {
    const copy = bytes.slice();
    node.port.postMessage({ type: "chunk", buffer: copy.buffer, segmentIndex }, [copy.buffer]);
  };
  const sendBlob = async (blob: Blob) => {
    await context.resume();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    sendBytes(bytes, -1);
    node.port.postMessage({ type: "end" });
  };

  return {
    async enqueueResponse(response, signal, segmentIndex, onProgress) {
      if (!response.ok || !response.body)
        throw new Error("tts_openai: OpenAI returned no PCM audio stream.");
      const contentType = response.headers.get("Content-Type") || "";
      if (!contentType.startsWith("audio/pcm"))
        throw new Error(`tts_openai: Expected PCM audio, received ${contentType || "unknown"}.`);
      await context.resume();
      const reader = response.body.getReader();
      const stored: ArrayBuffer[] = [];
      let receivedBytes = 0;
      let sawFirstByte = false;
      let carry: number | null = null;
      try {
        while (true) {
          if (signal.aborted) throw new DOMException("Voice stopped", "AbortError");
          const { done, value } = await reader.read();
          if (done) break;
          if (!value?.byteLength) continue;
          receivedBytes += value.byteLength;
          if (!sawFirstByte) {
            sawFirstByte = true;
            onProgress?.({ type: "first_byte", bytes: receivedBytes });
          }
          const saved = new Uint8Array(value.byteLength);
          saved.set(value);
          stored.push(saved.buffer);
          let chunk = value;
          if (carry !== null) {
            const joined = new Uint8Array(value.byteLength + 1);
            joined[0] = carry;
            joined.set(value, 1);
            chunk = joined;
            carry = null;
          }
          if (chunk.byteLength % 2) {
            carry = chunk[chunk.byteLength - 1];
            chunk = chunk.slice(0, -1);
          }
          if (chunk.byteLength) {
            activeSegment = segmentIndex;
            sendBytes(chunk, segmentIndex);
            onProgress?.({ type: "queued", bytes: receivedBytes });
          }
        }
      } finally {
        reader.releaseLock();
      }
      if (signal.aborted) throw new DOMException("Voice stopped", "AbortError");
      node.port.postMessage({ type: "segment_end", segmentIndex });
      onProgress?.({ type: "received", bytes: receivedBytes });
      return new Blob(stored, { type: "audio/pcm;rate=24000" });
    },
    finish() {
      node.port.postMessage({ type: "end" });
    },
    replay: sendBlob,
    interrupt() {
      callbacks.onInterrupted?.(activeSegment);
      activeSegment = null;
      node.port.postMessage({ type: "flush" });
    },
    close() {
      node.port.onmessage = null;
      node.disconnect();
      void context.close();
    },
  };
}
