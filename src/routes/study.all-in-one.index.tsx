import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, FileUp, Layers, ListChecks, ScrollText, Sparkles, Type, Wand2 } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";
import { usePlanGate } from "@/hooks/usePlanGate";
import { UpgradeWall } from "@/components/plan/UpgradeWall";
import { PdfScanError, condenseForAi, extractPdfText, friendlyError, renderPdfPages } from "@/lib/pdf-text";
import { lqGenerate } from "@/lib/lecture-lab.functions";
import { generateSummary } from "@/lib/summaries.functions";
import {
  aioBucket,
  aioCards,
  aioLinkSummary,
  aioList,
  aioReadPages,
  aioStart,
  aioSummary,
} from "@/lib/all-in-one.functions";
import { BuildProgress, estimateBuildSeconds, type BuildStep } from "@/components/study/BuildProgress";

export const Route = createFileRoute("/study/all-in-one/")({
  component: AllInOneUpload,
  head: () => ({
    meta: [
      { title: "All in one — one upload, everything | RitaJet" },
      {
        name: "description",
        content:
          "Upload one lecture and get a study guide, a short summary, flashcards and exam questions in a single workspace.",
      },
      { property: "og:title", content: "All in one — one upload, everything" },
      {
        property: "og:description",
        content: "One lecture in. Study guide, summary, flashcards and questions out.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const ACCENT = "#3f2c73";

const BUILD_STEPS: BuildStep[] = [
  { key: "read", label: "Reading the lecture", weight: 1 },
  { key: "home", label: "Making a home for it", weight: 0.3 },
  { key: "guide", label: "Study guide", weight: 2 },
  { key: "sheet", label: "Summary sheet", weight: 2.4 },
  { key: "cards", label: "Flashcards", weight: 1.6 },
  { key: "questions", label: "Questions", weight: 2 },
];

const DELIVERABLES = [
  { icon: <ScrollText size={17} />, name: "Study guide" },
  { icon: <Sparkles size={17} />, name: "Summary" },
  { icon: <Layers size={17} />, name: "Flashcards" },
  { icon: <ListChecks size={17} />, name: "Questions" },
];

type Row = {
  id: string;
  title: string;
  created_at: string;
  questions: number;
  cards: number;
  guide: boolean;
  example?: boolean;
};

function AllInOneUpload() {
  const { user } = useAuth();
  const gate = usePlanGate();
  const navigate = useNavigate();
  const bucket = useServerFn(aioBucket);
  const list = useServerFn(aioList);
  const start = useServerFn(aioStart);
  const buildSummary = useServerFn(aioSummary);
  const buildSheet = useServerFn(generateSummary);
  const linkSheet = useServerFn(aioLinkSummary);
  const buildCards = useServerFn(aioCards);
  const readPages = useServerFn(aioReadPages);
  const generate = useServerFn(lqGenerate);

  const [source, setSource] = useState<"pdf" | "text">("pdf");
  const [file, setFile] = useState<File | null>(null);
  const [pasted, setPasted] = useState("");
  const [rows, setRows] = useState<Row[]>([]);

  // Retain only Tuberculosis Handbook as the universal example card and exclude others
  const displayRows = useMemo(() => {
    return rows.filter((r) => !r.example || r.title.toLowerCase().includes("tuberculosis"));
  }, [rows]);

  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [done, setDone] = useState<string[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [estimate, setEstimate] = useState(120);
  const [runId, setRunId] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    const r: any = await list({ data: undefined } as any);
    setRows((r.lectures ?? []) as Row[]);
  }, [list]);

  useEffect(() => {
    if (!user) return;
    refresh().catch(() => undefined);
  }, [user, refresh]);

  async function run() {
    if (!gate.check({ feature: "feature_all_in_one", kind: "all_in_one_lectures" })) return;
    if (source === "pdf" && !file) return toast.error("Choose a PDF, or switch to pasted text.");
    if (source === "text" && pasted.trim().length < 200) {
      return toast.error("Paste a bit more of the lecture (a couple of paragraphs at least).");
    }
    const name = file?.name?.replace(/\.pdf$/i, "").slice(0, 120) || "Untitled lecture";

    setBusy(true);
    setFailed([]);
    setDone([]);
    setCurrent(null);
    setRunId((n) => n + 1);
    setEstimate(estimateBuildSeconds(pasted.trim().length || 20000, source === "pdf"));
    try {
      let text = pasted.trim();
      if (source === "pdf" && file) {
        setCurrent("read");
        setStage("Reading your lecture…");
        try {
          const r = await extractPdfText(file, (p) => setStage(`Reading page ${p.page} of ${p.pages}…`));
          text = r.text;
        } catch (e) {
          if (!(e instanceof PdfScanError)) throw e;
          setStage("This one is a scan — reading the pages as pictures…");
          const images = await renderPdfPages(file, 10, (p) =>
            setStage(`Photographing page ${p.page} of ${p.pages}…`),
          );
          const r: any = await readPages({ data: { images } });
          text = String(r.text ?? "");
          if (text.length < 200) throw new Error("Those pages were too blurry to read.");
        }
      }
      setDone((d) => [...d, "read"]);
      // A 300-page book is far too big to send in one request — condense it to
      // a representative slice first, or every step fails seconds after start.
      const aiText = condenseForAi(text, 90_000);
      if (aiText.length < 200) throw new Error("We could not read enough text from that file.");
      setEstimate(estimateBuildSeconds(aiText.length, source === "pdf"));

      setCurrent("home");
      setStage("Making a home for it…");
      const b: any = await bucket({ data: undefined } as any);
      const subtopicId = b.subtopicId as string;
      const started: any = await start({
        data: { subtopicId, title: name, sourceName: file?.name ?? "Pasted text" },
      });
      const lectureId = started.lectureId as string;
      setDone((d) => [...d, "home"]);

      const step = async (key: string, label: string, stageLine: string, fn: () => Promise<unknown>) => {
        setCurrent(key);
        setStage(stageLine);
        // One retry: a single slow answer should never cost the whole build.
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            await fn();
            setDone((d) => [...d, key]);
            return;
          } catch (e) {
            if (attempt === 0) {
              setStage(`${stageLine} (retrying)`);
              await new Promise((r) => setTimeout(r, 1500));
              continue;
            }
            const line = `${label}: ${friendlyError(e)}`;
            setFailed((f) => [...f, line]);
            toast.error(line);
          }
        }
      };

      await step("guide", "Study guide", "Writing your study guide…", () =>
        buildSummary({ data: { lectureId, title: name, text: aiText } }),
      );
      await step("sheet", "Summary sheet", "Writing your full summary…", async () => {
        const res: any = await buildSheet({
          data: {
            kind: "text",
            text: aiText,
            length: "comprehensive",
            tone: "concept",
            titleOverride: name,
            provider: "gemini",
          },
        } as any);
        if (res?.id) await linkSheet({ data: { lectureId, summaryId: res.id as string } });
      });
      await step("cards", "Flashcards", "Cutting your flashcards…", () =>
        buildCards({ data: { lectureId, title: name, text: aiText, count: 16 } }),
      );
      await step("questions", "Questions", "Writing your questions…", () =>
        generate({
          data: {
            subtopicId,
            title: name,
            sourceName: file?.name ?? "Pasted text",
            text: aiText,
            count: 15,
            difficulty: "mixed",
            keyPoints: false,
            lectureId,
          },
        } as any),
      );
      setCurrent(null);

      toast.success("Your lecture is ready.");
      void navigate({ to: "/study/all-in-one/$lectureId", params: { lectureId } });
    } catch (e: any) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
      setStage("");
    }
  }

  return (
    <div className="min-h-screen bg-[#fbf5e9] text-[#23201d]">
      <SiteHeader />
      <UpgradeWall block={gate.block} onClose={gate.closeBlock} />
      <main className="mx-auto w-full max-w-[980px] px-4 pb-24 pt-8">
        <Link to="/learn" className="inline-flex items-center gap-2 text-[13px] font-extrabold text-[#6b6357] hover:text-[#23201d]">
          <ArrowLeft size={15} /> Back to Start learning
        </Link>

        <header className="mt-4">
          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em]"
            style={{ background: "#e7dcf7", color: ACCENT }}
          >
            <Wand2 size={13} /> All in one
          </div>
          <h1 className="mt-3 font-display text-[34px] font-black leading-[1.05] sm:text-[42px]">
            Drop the lecture. That's it.
          </h1>
          <p className="mt-2 max-w-[54ch] text-[15px] text-[#6b6357]">
            Study guide, summary, flashcards and questions — built from one file.
          </p>
        </header>

        <section data-tour="aio-studio-box" className="mt-6 rounded-[28px] border border-black/[0.07] bg-white p-5 sm:p-6">
          <div className="flex gap-2">
            {(["pdf", "text"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSource(s)}
                className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-extrabold transition"
                style={source === s ? { background: ACCENT, color: "#fff" } : { background: "#f4efe4", color: "#6b6357" }}
              >
                {s === "pdf" ? <FileUp size={15} /> : <Type size={15} />}
                {s === "pdf" ? "PDF" : "Paste text"}
              </button>
            ))}
          </div>

          {source === "pdf" ? (
            <label
              data-tour="aio-dropzone"
              onClick={(e) => {
                if (!gate.check({ feature: "feature_all_in_one", kind: "all_in_one_lectures" })) {
                  e.preventDefault();
                }
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!gate.check({ feature: "feature_all_in_one", kind: "all_in_one_lectures" })) return;
                const f = e.dataTransfer.files?.[0] ?? null;
                if (f) setFile(f);
              }}
              className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-black/10 bg-[#fbf8f2] px-4 py-14 text-center"
            >
              <FileUp size={26} style={{ color: ACCENT }} />
              <span className="mt-3 text-[16px] font-black">{file ? file.name : "Drop your lecture PDF"}</span>
              <span className="mt-1 text-[12.5px] text-[#6b6357]">Any size. Scans work too.</span>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  e.target.value = "";
                  if (!f) return;
                  if (!gate.check({ feature: "feature_all_in_one", kind: "all_in_one_lectures" })) return;
                  setFile(f);
                }}
              />
            </label>
          ) : (
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={9}
              placeholder="Paste the lecture text here…"
              className="mt-4 w-full rounded-2xl border border-black/10 bg-[#fbf8f2] p-4 text-[14px] font-medium"
            />
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {DELIVERABLES.map((d) => (
              <span
                key={d.name}
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] font-extrabold"
                style={{ background: "#f4efe4", color: "#4a453d" }}
              >
                {d.icon}
                {d.name}
              </span>
            ))}
          </div>

          {busy && (
            <div className="mt-5">
              <BuildProgress
                steps={BUILD_STEPS}
                done={done}
                current={current}
                detail={stage}
                estimateSeconds={estimate}
                runId={runId}
              />
            </div>
          )}


          <button
            onClick={() => void run()}
            disabled={busy}
            className="mt-5 w-full rounded-full px-6 py-4 text-[15px] font-extrabold text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ background: "#23201d" }}
          >
            {busy ? "Building…" : "Build everything"}
          </button>

          <p className="mt-4 rounded-2xl border border-[#d94a3d]/25 bg-[#d94a3d]/[0.07] px-4 py-3 text-[13px] font-semibold leading-relaxed text-[#c1392b]">
            <span className="font-black">This takes time — you don't have to wait here.</span>{" "}
            Close the page and come back whenever you like. Big books can take up to two hours, but it is
            usually finished in under 30 minutes.
          </p>

          {failed.length > 0 && (
            <ul className="mt-3 space-y-1 rounded-2xl bg-[#f6f1e5] px-4 py-3 text-[13px] font-semibold text-[#8a3b32]">
              {failed.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-9">
          <h2 className="font-display text-[20px] font-black">Your lectures</h2>
          {displayRows.length === 0 ? (
            <p className="mt-2 text-[14px] text-[#6b6357]">Nothing yet — your first lecture will appear here.</p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {displayRows.map((r, i) => (
                <Link
                  key={r.id}
                  data-tour={r.example && i === 0 ? "aio-sample-card" : undefined}
                  to="/study/all-in-one/$lectureId"
                  params={{ lectureId: r.id }}
                  className={`group flex aspect-square flex-col justify-between rounded-3xl border bg-white p-4 transition hover:-translate-y-1 hover:shadow-[0_20px_40px_-26px_rgba(0,0,0,0.35)] ${r.example ? "border-[#3f2c73]/25" : "border-black/[0.07]"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className="grid h-9 w-9 place-items-center rounded-xl"
                      style={{ background: "#e7dcf7", color: ACCENT }}
                    >
                      <Wand2 size={17} />
                    </span>
                    {r.example && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-[0.16em]"
                        style={{ background: "#e7dcf7", color: ACCENT }}
                      >
                        Example
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="line-clamp-3 font-display text-[15px] font-black leading-tight">{r.title}</div>
                    <div className="mt-1.5 text-[11.5px] font-bold text-[#8b8375]">
                      {r.guide ? "guide" : "no guide"} · {r.cards} cards · {r.questions} questions
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
