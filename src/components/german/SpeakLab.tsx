import { useEffect, useRef, useState } from "react";
import { Flag, Loader2, Mic, Square, Turtle, Volume2, X } from "lucide-react";
import { prefetchGerman, speakGerman, type DeItem, type SpeakResult, fullGerman } from "@/lib/de-lab";
import { startRecording, type Recorder } from "@/lib/de-record";
import { band, scoreSpeech } from "@/lib/de-score";
import { useDeFlag, useDeRecord } from "@/lib/use-de-lab";
import { DeResults, type ResultRow } from "@/components/german/DeResults";
import { supabase } from "@/integrations/supabase/legacy-client";

const ACCENT = "#e0774f";

async function transcribe(blob: Blob): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in again.");
  const form = new FormData();
  form.append("audio", blob, "recording.wav");
  const res = await fetch("/api/german/score", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error((await res.text().catch(() => "")) || "Could not hear that clearly.");
  const json = (await res.json()) as { text?: string };
  return String(json.text ?? "");
}

export function SpeakLab({ items, onClose }: { items: DeItem[]; onClose: () => void }) {
  const [list, setList] = useState<DeItem[]>(items);
  const [index, setIndex] = useState(0);
  const [rows, setRows] = useState<Record<string, ResultRow>>({});
  const [result, setResult] = useState<SpeakResult | null>(null);
  const [state, setState] = useState<"idle" | "recording" | "scoring">("idle");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const rec = useRef<Recorder | null>(null);
  const flag = useDeFlag();
  const record = useDeRecord();
  const saved = useRef(false);

  const current = list[index];

  useEffect(() => {
    prefetchGerman(list.slice(0, 12).map((i) => fullGerman(i)));
  }, [list]);

  useEffect(() => {
    if (current) void speakGerman(fullGerman(current));
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!done || saved.current) return;
    saved.current = true;
    const finished = Object.values(rows);
    if (finished.length)
      void record.mutateAsync({
        mode: "speak",
        rows: finished.map((r) => ({ itemId: r.item.id, correct: r.correct, score: r.score })),
      });
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  const begin = async () => {
    setError(null);
    setResult(null);
    try {
      rec.current = await startRecording();
      setState("recording");
    } catch {
      setError("Microphone access is needed to record.");
    }
  };

  const finish = async () => {
    if (!rec.current || !current) return;
    setState("scoring");
    try {
      const blob = await rec.current.stop();
      rec.current = null;
      if (blob.size < 2048) throw new Error("That recording was empty — try again.");
      const text = await transcribe(blob);
      const scored = scoreSpeech(fullGerman(current), text);
      setResult(scored);
      setRows((r) => ({
        ...r,
        [current.id]: { item: current, correct: scored.score >= 65, score: scored.score },
      }));
    } catch (e: any) {
      setError(e?.message ?? "Could not score that recording.");
    } finally {
      setState("idle");
    }
  };

  const next = () => {
    setResult(null);
    setError(null);
    if (index + 1 >= list.length) setDone(true);
    else setIndex((i) => i + 1);
  };

  if (done || !current) {
    return (
      <DeResults
        rows={Object.values(rows)}
        accent={ACCENT}
        showScores
        onClose={onClose}
        onRetryMissed={() => {
          const missed = Object.values(rows).filter((r) => !r.correct).map((r) => r.item);
          if (!missed.length) return onClose();
          saved.current = false;
          setRows({});
          setIndex(0);
          setList(missed);
          setDone(false);
        }}
      />
    );
  }

  const b = result ? band(result.score) : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#fbf5e9] p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
        <button onClick={() => setDone(true)} className="rounded-full bg-white p-2.5 text-[#6b645b] shadow-sm">
          <X size={18} />
        </button>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${((index + (result ? 1 : 0)) / list.length) * 100}%`, background: ACCENT }}
          />
        </div>
        <span className="rounded-full bg-white px-3 py-1.5 text-[13px] font-black text-[#23201d] shadow-sm">
          {index + 1}/{list.length}
        </span>
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center">
        <div className="w-full rounded-[32px] bg-white px-6 py-10 text-center shadow-[0_24px_60px_-30px_rgba(0,0,0,0.28)]">
          <p className="font-display text-[clamp(1.5rem,4.5vw,2.6rem)] font-black leading-tight tracking-tight text-[#23201d]">
            {result
              ? result.words.map((w, i) => (
                  <span
                    key={i}
                    style={{
                      color: w.state === "good" ? "#2f9e63" : w.state === "close" ? "#c98a2b" : "#d94a4a",
                    }}
                  >
                    {fullGerman(current).split(/\s+/)[i] ?? w.word}{" "}
                  </span>
                ))
              : fullGerman(current)}
          </p>
          {current.english && <p className="mt-3 text-[16px] font-semibold text-[#6b645b]">{current.english}</p>}

          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              onClick={() => void speakGerman(fullGerman(current), 0.92)}
              className="inline-flex items-center gap-2 rounded-full bg-[#f3ece0] px-4 py-2.5 text-[13px] font-extrabold text-[#5a4a2e]"
            >
              <Volume2 size={16} /> Native
            </button>
            <button
              onClick={() => void speakGerman(fullGerman(current), 0.7)}
              className="inline-flex items-center gap-2 rounded-full bg-[#f3ece0] px-4 py-2.5 text-[13px] font-extrabold text-[#5a4a2e]"
            >
              <Turtle size={16} /> Slow
            </button>
            <button
              onClick={() => void flag.mutateAsync({ itemId: current.id, on: !current.flagged })}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-extrabold"
              style={{ color: current.flagged ? "#d94a4a" : "#b8b0a4" }}
            >
              <Flag size={15} fill={current.flagged ? "#d94a4a" : "none"} /> Flag
            </button>
          </div>

          {result && (
            <div className="mt-7">
              <div className="font-display text-[44px] font-black leading-none" style={{ color: b!.color }}>
                {result.score}
              </div>
              <div className="text-[13px] font-black uppercase tracking-[0.18em]" style={{ color: b!.color }}>
                {b!.label}
              </div>
              <p className="mx-auto mt-3 max-w-lg rounded-2xl bg-[#f6f1e6] px-4 py-3 text-[14px] font-semibold text-[#5a4a2e]">
                We heard: “{result.transcript || "…"}”
              </p>
            </div>
          )}
          {error && <p className="mt-5 text-[14px] font-bold text-[#b13636]">{error}</p>}
        </div>

        <div className="mt-8 flex items-center gap-3">
          {state === "recording" ? (
            <button
              onClick={() => void finish()}
              className="inline-flex items-center gap-3 rounded-full bg-[#d94a4a] px-8 py-4 text-[16px] font-extrabold text-white shadow-lg"
            >
              <Square size={18} fill="white" /> Stop &amp; score
            </button>
          ) : (
            <button
              onClick={() => void begin()}
              disabled={state === "scoring"}
              className="inline-flex items-center gap-3 rounded-full px-8 py-4 text-[16px] font-extrabold text-white shadow-lg disabled:opacity-50"
              style={{ background: ACCENT }}
            >
              {state === "scoring" ? <Loader2 className="animate-spin" size={18} /> : <Mic size={18} />}
              {state === "scoring" ? "Scoring…" : result ? "Record again" : "Record"}
            </button>
          )}
          <button
            onClick={next}
            className="rounded-full border border-black/10 bg-white px-6 py-4 text-[15px] font-extrabold text-[#23201d]"
          >
            {index + 1 >= list.length ? "Finish" : "Next"}
          </button>
        </div>
        <p className="mt-4 text-[13px] font-bold text-[#8b8378]">
          Say it out loud — every word is graded green, amber or red.
        </p>
      </div>
    </div>
  );
}
