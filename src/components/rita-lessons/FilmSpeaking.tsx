import { useEffect, useRef, useState } from "react";

import { Mic, Square } from "lucide-react";

type Copy = (en: string, ar: string) => string;

export function FilmSpeaking({
  t,
  onDone,
  stopVideo,
}: {
  t: Copy;
  onDone: () => void;
  stopVideo: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "asking" | "recording" | "finishing">("idle");
  const [failed, setFailed] = useState(false);
  const [audio, setAudio] = useState("");
  const mounted = useRef(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const url = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
      const current = recorder.current;
      if (current?.state === "recording") current.stop();
      current?.stream.getTracks().forEach((track) => track.stop());
      URL.revokeObjectURL(url.current);
    };
  }, []);
  async function record() {
    stopVideo();
    setFailed(false);
    setStatus("asking");
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const current = new MediaRecorder(stream);
      recorder.current = current;
      const chunks: Blob[] = [];
      current.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      current.onstop = () => {
        clearTimeout(timer.current);
        current.stream.getTracks().forEach((track) => track.stop());
        if (!mounted.current) return;
        if (chunks.length) {
          URL.revokeObjectURL(url.current);
          url.current = URL.createObjectURL(new Blob(chunks, { type: current.mimeType }));
          setAudio(url.current);
        } else setFailed(true);
        setStatus("idle");
      };
      current.start();
      setAudio("");
      setStatus("recording");
      timer.current = setTimeout(() => {
        if (current.state === "recording") current.stop();
      }, 15000);
    } catch {
      stream?.getTracks().forEach((track) => track.stop());
      if (mounted.current) {
        setFailed(true);
        setStatus("idle");
      }
    }
  }
  const supported = typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
  return (
    <div className="fs-speaking">
      {supported && (
        <button
          className="fs-mic"
          aria-pressed={status === "recording"}
          disabled={status === "asking" || status === "finishing"}
          onClick={() => {
            if (status === "recording") {
              if (recorder.current?.state === "recording") recorder.current.stop();
              setStatus("finishing");
            } else void record();
          }}
        >
          {status === "recording" ? <Square size={30} /> : <Mic size={40} />}
          <span className="sr-only">
            {status === "recording"
              ? t("Stop recording", "أوقف التسجيل")
              : status === "asking"
                ? t("Waiting for microphone…", "بانتظار إذن الميكروفون…")
                : t("Record your pronunciation", "سجّل نطقك")}
          </span>
        </button>
      )}
      {(!supported || failed) && (
        <p role="status">
          {t(
            "Microphone unavailable. You can still listen and repeat.",
            "الميكروفون غير متاح. بتقدر تسمع الجملة وتردّدها.",
          )}
        </p>
      )}
      {audio && (
        <audio aria-label={t("Your recording", "تسجيلك")} src={audio} controls onPlay={stopVideo} />
      )}
      <button className="fs-skip" onClick={onDone}>
        {audio ? t("Continue", "متابعة") : t("Skip speaking", "لا أستطيع الكلام الآن")}
      </button>
    </div>
  );
}
