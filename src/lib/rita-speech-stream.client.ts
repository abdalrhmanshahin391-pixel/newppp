export function canStreamRitaSpeech() {
  return (
    typeof MediaSource !== "undefined" &&
    typeof MediaSource.isTypeSupported === "function" &&
    MediaSource.isTypeSupported("audio/mpeg")
  );
}

export async function playRitaSpeechResponse(args: {
  response: Response;
  element: HTMLAudioElement;
  signal: AbortSignal;
  stream: boolean;
  setSource: (url: string) => void;
  onPlaybackBlocked: (error: unknown) => void;
}) {
  const { response, element, signal, setSource, onPlaybackBlocked } = args;
  const contentType = response.headers.get("Content-Type")?.split(";")[0]?.trim() || "";
  if (!contentType.startsWith("audio/"))
    throw new Error("Rita’s voice service returned an invalid audio file.");

  // Consume the response body exactly once. Safari may throw "Body is disturbed
  // or locked" from Body.blob() even though a readable stream is available.
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Rita’s voice service returned no audio stream.");
  if (!args.stream) {
    const chunks: ArrayBuffer[] = [];
    try {
      while (true) {
        if (signal.aborted) throw new DOMException("Voice stopped", "AbortError");
        const { done, value } = await reader.read();
        if (done) break;
        if (value?.byteLength) chunks.push(Uint8Array.from(value).buffer as ArrayBuffer);
      }
    } finally {
      reader.releaseLock();
    }
    const blob = new Blob(chunks, { type: contentType });
    if (!blob.size) throw new Error("Rita’s voice service returned an empty audio file.");
    if (signal.aborted) throw new DOMException("Voice stopped", "AbortError");
    setSource(URL.createObjectURL(blob));
    void element.play().catch(onPlaybackBlocked);
    return blob;
  }

  const mediaSource = new MediaSource();
  const pending: Uint8Array[] = [];
  const buffers: ArrayBuffer[] = [];
  let sourceBuffer: SourceBuffer | null = null;
  let streamUsable = true;
  let finished = false;
  let playRequested = false;

  const appendNext = () => {
    if (!streamUsable || !sourceBuffer || sourceBuffer.updating) return;
    const chunk = pending.shift();
    if (chunk) {
      try {
        sourceBuffer.appendBuffer(chunk.buffer as ArrayBuffer);
      } catch {
        streamUsable = false;
      }
    } else if (finished && mediaSource.readyState === "open") {
      try {
        mediaSource.endOfStream();
      } catch {
        streamUsable = false;
      }
    }
  };

  mediaSource.addEventListener("sourceopen", () => {
    if (!streamUsable || signal.aborted) return;
    try {
      sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
      sourceBuffer.mode = "sequence";
      sourceBuffer.addEventListener("updateend", () => {
        if (!playRequested && sourceBuffer?.buffered.length) {
          playRequested = true;
          void element.play().catch(onPlaybackBlocked);
        }
        appendNext();
      });
      sourceBuffer.addEventListener("error", () => {
        streamUsable = false;
      });
      appendNext();
    } catch {
      streamUsable = false;
    }
  });
  mediaSource.addEventListener("sourceended", () => {
    if (!finished) streamUsable = false;
  });
  setSource(URL.createObjectURL(mediaSource));

  try {
    while (true) {
      if (signal.aborted) throw new DOMException("Voice stopped", "AbortError");
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      const copy = Uint8Array.from(value);
      buffers.push(copy.buffer as ArrayBuffer);
      if (streamUsable) {
        pending.push(copy);
        appendNext();
      }
    }
  } finally {
    reader.releaseLock();
  }
  if (signal.aborted) throw new DOMException("Voice stopped", "AbortError");
  finished = true;
  appendNext();
  const blob = new Blob(buffers, { type: contentType });
  if (!blob.size) throw new Error("Rita’s voice service returned an empty audio file.");

  // Some browsers advertise MSE/MP3 but never open a source for an audio element.
  // Give it a brief chance to begin, then play the same bytes as a normal file.
  if (streamUsable && !playRequested)
    await new Promise<void>((resolve) => setTimeout(resolve, 750));
  if (streamUsable && !playRequested) streamUsable = false;

  // If MSE fails, reuse the already paid-for bytes instead of generating audio again.
  if (!streamUsable) {
    setSource(URL.createObjectURL(blob));
    void element.play().catch(onPlaybackBlocked);
  }
  return blob;
}
