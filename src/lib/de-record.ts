/**
 * Tiny microphone recorder used by the German speaking lab.
 * Starts capture immediately and resolves a single audio blob on stop.
 */
export type Recorder = {
  stop: () => Promise<Blob>;
  cancel: () => void;
};

function pickMimeType(): string | undefined {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  const MR: any = typeof window !== "undefined" ? (window as any).MediaRecorder : undefined;
  if (!MR?.isTypeSupported) return undefined;
  return candidates.find((t) => MR.isTypeSupported(t));
}

export async function startRecording(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  recorder.start();

  const release = () => stream.getTracks().forEach((t) => t.stop());

  return {
    stop: () =>
      new Promise<Blob>((resolve, reject) => {
        recorder.onerror = (e) => {
          release();
          reject(e);
        };
        recorder.onstop = () => {
          release();
          resolve(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
        };
        try {
          recorder.stop();
        } catch (err) {
          release();
          reject(err);
        }
      }),
    cancel: () => {
      try {
        recorder.stop();
      } catch {
        /* already stopped */
      }
      release();
    },
  };
}
