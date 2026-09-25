import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Image as ImageIcon,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Upload,
  X,
  Sparkles,
  FileType2,
  Key,
  Check,
  PlugZap,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePlanGate } from "@/hooks/usePlanGate";
import { UpgradeWall } from "@/components/plan/UpgradeWall";
import { generateSummary } from "@/lib/summaries.functions";
import { saveAiKey, listAiKeyStatus, testGeminiKey } from "@/lib/jarvis.functions";
import { SiteHeader } from "@/components/SiteHeader";
import { toast } from "sonner";
import { z } from "zod";

const SearchSchema = z.object({
  source: z.enum(["photos", "pdf"]).optional(),
});

export const Route = createFileRoute("/summaries/new")({
  head: () => ({
    meta: [
      { title: "New summary — RitaJet study workspace" },
      {
        name: "description",
        content: "Turn photos of your pages or a lecture PDF into a clean Rita summary sheet.",
      },
      { property: "og:title", content: "New summary — RitaJet study workspace" },
      {
        property: "og:description",
        content: "Upload pages or a PDF and Rita writes the summary sheet for you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s) => SearchSchema.parse(s),
  component: NewSummary,
});

type Source = "photos" | "pdf";

function NewSummary() {
  const { user, profile, isAdmin, loading } = useAuth();
  const gate = usePlanGate();
  const navigate = useNavigate();
  const search = Route.useSearch();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);
  const [step, setStep] = useState<1 | 2>(1);
  const [source, setSource] = useState<Source>(search.source ?? "photos");

  // step 1 data
  const [photos, setPhotos] = useState<
    { name: string; mimeType: string; base64: string; preview: string }[]
  >([]);
  const [pdfFile, setPdfFile] = useState<{ name: string; base64: string; sizeKb: number } | null>(
    null,
  );

  // step 2 data
  const [length, setLength] = useState<"short" | "standard" | "comprehensive">("standard");
  const [tone, setTone] = useState<"exam" | "concept" | "revision">("exam");
  const [titleOverride, setTitleOverride] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (profile?.full_name && !authorName) setAuthorName(profile.full_name);
  }, [profile, authorName]);

  const genFn = useServerFn(generateSummary);

  async function fileToBase64(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const s = String(r.result || "");
        const i = s.indexOf(",");
        resolve(i >= 0 ? s.slice(i + 1) : s);
      };
      r.onerror = () => reject(r.error);
      r.readAsDataURL(f);
    });
  }

  async function handlePhotos(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files).slice(0, 10 - photos.length);
    const newOnes: typeof photos = [];
    for (const f of arr) {
      if (!f.type.startsWith("image/")) {
        toast.error(`${f.name} is not an image.`);
        continue;
      }
      if (f.size > 8 * 1024 * 1024) {
        toast.error(`${f.name} is over 8 MB.`);
        continue;
      }
      try {
        const b64 = await fileToBase64(f);
        newOnes.push({ name: f.name, mimeType: f.type, base64: b64, preview: URL.createObjectURL(f) });
      } catch (err: any) {
        toast.error(`Failed to read ${f.name}: ${err?.message || "unknown error"}`);
      }
    }
    setPhotos((p) => [...p, ...newOnes].slice(0, 10));
  }

  async function handlePdf(file: File | null | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please upload a PDF file.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("PDF is over 20 MB.");
      return;
    }
    try {
      const b64 = await fileToBase64(file);
      setPdfFile({ name: file.name, base64: b64, sizeKb: Math.round(file.size / 1024) });
    } catch (err: any) {
      toast.error(`Failed to read PDF: ${err?.message || "unknown error"}`);
    }
  }

  function canNext() {
    if (source === "pdf") return !!pdfFile;
    return photos.length > 0;
  }

  async function generate() {
    if (!canNext()) return;
    setGenerating(true);
    try {
      const base = {
        length,
        tone,
        authorName: authorName.trim() || undefined,
        titleOverride: titleOverride.trim() || undefined,
        provider: "gemini" as const,
      };
      const res =
        source === "pdf"
          ? await genFn({
              data: { kind: "pdf", pdfBase64: pdfFile!.base64, filename: pdfFile!.name, ...base },
            })
          : await genFn({
              data: {
                kind: "photos",
                images: photos.map((p) => ({ mimeType: p.mimeType, base64: p.base64 })),
                ...base,
              },
            });
      toast.success("Summary created!");
      navigate({ to: "/summaries/$summaryId", params: { summaryId: res.id } });
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate.");
    } finally {
      setGenerating(false);
    }
  }

  if (!loading && !user) {
    navigate({ to: "/login" });
    return null;
  }

  return (
    <div className="min-h-screen" style={{ background: "#fbf5e9", color: "#23201d" }}>
      <SiteHeader />
      <UpgradeWall block={gate.block} onClose={gate.closeBlock} />

      <div className="mx-auto max-w-3xl px-5 py-12 md:py-16">
        <Link
          to="/study/pdf"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-[#4a453d] hover:text-[#23201d]"
        >
          <ArrowLeft size={14} /> Back to summaries
        </Link>

        <div className="mt-6 flex items-center gap-3">
          <span
            className={`grid h-9 w-9 place-items-center rounded-full text-sm font-extrabold ${step === 1 ? "rita-pill" : "bg-white text-[#6d675e]"}`}
          >
            1
          </span>
          <span className="text-sm font-bold text-[#4a453d]">Source</span>
          <span className="h-px flex-1 bg-black/[0.1]" />
          <span
            className={`grid h-9 w-9 place-items-center rounded-full text-sm font-extrabold ${step === 2 ? "rita-pill" : "bg-white text-[#6d675e]"}`}
          >
            2
          </span>
          <span className="text-sm font-bold text-[#4a453d]">Style</span>
        </div>

        {step === 1 && (
          <div className="mt-8 space-y-6">
            <h1 className="font-display text-3xl font-black tracking-tight md:text-4xl">
              Where should we get the material?
            </h1>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SourceCard
                toneIndex={0}
                active={source === "photos"}
                onClick={() => setSource("photos")}
                icon={<ImageIcon size={20} />}
                label="From photos"
              />
              <SourceCard
                toneIndex={1}
                active={source === "pdf"}
                onClick={() => setSource("pdf")}
                icon={<FileType2 size={20} />}
                label="From PDF"
              />
            </div>

            <div className="rounded-3xl border border-black/[0.07] bg-white p-6 md:p-7">
              {source === "photos" && (
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-widest text-[#6d675e]">
                    Upload pages or screenshots (up to 10)
                  </label>
                  <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-black/[0.12] bg-[#fbf5e9] p-8 text-center transition-colors hover:border-[#58a700] hover:bg-[#f4fae9]">
                    <Upload className="mx-auto text-[#8d857a]" />
                    <p className="mt-2 text-sm font-bold text-[#23201d]">Click or drop images</p>
                    <p className="text-xs text-[#6d675e]">JPG / PNG, up to 8 MB each</p>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = e.target.files;
                        if (!files?.length) return;
                        if (!gate.check({ kind: "summaries" })) return;
                        handlePhotos(files);
                      }}
                    />
                  </label>
                  {photos.length > 0 && (
                    <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                      {photos.map((p, i) => (
                        <div
                          key={i}
                          className="group relative overflow-hidden rounded-xl border border-black/[0.1]"
                        >
                          <img src={p.preview} alt={p.name} className="h-24 w-full object-cover" />
                          <button
                            onClick={() => setPhotos((arr) => arr.filter((_, j) => j !== i))}
                            className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {source === "pdf" && (
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-widest text-[#6d675e]">
                    Upload a PDF (lecture, chapter, slides)
                  </label>
                  {!pdfFile ? (
                    <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-black/[0.12] bg-[#fbf5e9] p-8 text-center transition-colors hover:border-[#58a700] hover:bg-[#f4fae9]">
                      <FileType2 className="mx-auto text-[#8d857a]" />
                      <p className="mt-2 text-sm font-bold text-[#23201d]">Click or drop a PDF</p>
                      <p className="text-xs text-[#6d675e]">Up to 20 MB · we'll read every page</p>
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          if (!gate.check({ kind: "summaries" })) return;
                          handlePdf(f);
                        }}
                      />
                    </label>
                  ) : (
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-black/[0.08] bg-[#fbf5e9] p-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e4dcf3] text-[#9b83d1]">
                          <FileType2 size={18} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[#23201d]">{pdfFile.name}</p>
                          <p className="text-xs text-[#6d675e]">{pdfFile.sizeKb} KB · ready</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setPdfFile(null)}
                        className="grid h-8 w-8 place-items-center rounded-full border border-black/[0.1] bg-white text-[#6d675e] hover:text-[#b4485f]"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                  <p className="mt-2 text-xs text-[#6d675e]">
                    Best for textbook chapters, slide decks, or lecture handouts. Scanned PDFs work too.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                disabled={!canNext()}
                onClick={() => setStep(2)}
                className="rita-pill inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold disabled:opacity-40"
              >
                Continue <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mt-8 space-y-6">
            <h1 className="font-display text-3xl font-black tracking-tight md:text-4xl">
              Style your summary
            </h1>

            <div className="space-y-6 rounded-3xl border border-black/[0.07] bg-white p-6 md:p-7">
              <Group label="Length">
                <Pill active={length === "short"} onClick={() => setLength("short")}>
                  Short · 2-3 pages
                </Pill>
                <Pill active={length === "standard"} onClick={() => setLength("standard")}>
                  Standard · 4-6 pages
                </Pill>
                <Pill active={length === "comprehensive"} onClick={() => setLength("comprehensive")}>
                  Comprehensive · 8-12 pages
                </Pill>
              </Group>

              <Group label="Tone">
                <Pill active={tone === "exam"} onClick={() => setTone("exam")}>
                  Exam-focused
                </Pill>
                <Pill active={tone === "concept"} onClick={() => setTone("concept")}>
                  Conceptual
                </Pill>
                <Pill active={tone === "revision"} onClick={() => setTone("revision")}>
                  Quick revision
                </Pill>
              </Group>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-[#6d675e]">
                    Title (optional)
                  </label>
                  <input
                    value={titleOverride}
                    onChange={(e) => setTitleOverride(e.target.value)}
                    placeholder="Auto from content"
                    className="w-full rounded-2xl border border-black/[0.1] px-4 py-3 text-sm focus:border-[#58a700] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-black uppercase tracking-widest text-[#6d675e]">
                    Your name
                  </label>
                  <input
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="Shown on cover"
                    className="w-full rounded-2xl border border-black/[0.1] px-4 py-3 text-sm focus:border-[#58a700] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {isAdmin && <AdminKeyPanel />}

            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 text-sm font-bold text-[#4a453d] hover:text-[#23201d]"
              >
                <ArrowLeft size={14} /> Back
              </button>
              <button
                disabled={generating}
                onClick={generate}
                className="rita-pill inline-flex items-center gap-2 rounded-full px-8 py-4 text-sm font-semibold disabled:opacity-60"
              >
                {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {generating ? "Crafting your summary…" : "Generate summary"}
              </button>
            </div>
            {generating && (
              <p className="text-center text-sm text-[#6d675e]">
                This usually takes 10-25 seconds. Hang tight ✨
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Admin-only: save and test the Gemini key that powers every summary. */
function AdminKeyPanel() {
  const listFn = useServerFn(listAiKeyStatus);
  const saveFn = useServerFn(saveAiKey);
  const testFn = useServerFn(testGeminiKey);

  const [draft, setDraft] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function refresh() {
    try {
      const r: any = await listFn();
      const row = (r.keys ?? []).find((k: any) => k.provider === "gemini" && (k.slot ?? 1) === 1);
      setUpdatedAt(row?.updated_at ?? null);
    } catch {
      /* non-admins never see this panel */
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    const key = draft.trim();
    if (key.length < 20) {
      toast.error("That key looks too short.");
      return;
    }
    setBusy("save");
    try {
      await saveFn({ data: { provider: "gemini", apiKey: key, slot: 1 } });
      setDraft("");
      toast.success("Key saved");
      await refresh();
      await test();
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    setBusy("test");
    setResult(null);
    try {
      const r: any = await testFn({ data: { slot: 1 } });
      setResult({ ok: !!r.ok, msg: r.ok ? `Working — ${r.model ?? "Gemini"} replied` : r.error });
    } catch (e: any) {
      setResult({ ok: false, msg: e?.message || "Test failed" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-3xl border border-black/[0.07] bg-white p-6 md:p-7">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[#e4dcf3] text-[#9b83d1]">
          <Key size={17} />
        </span>
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-[#6d675e]">Admin only</p>
          <p className="text-sm font-bold">Summary engine key</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-[#6d675e]">
        Every summary runs on this key. Students never see this box. The key itself is never sent back
        to the browser — only the date it was saved.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="password"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={updatedAt ? "•••••••••••• (paste to replace)" : "Paste the API key"}
          className="flex-1 rounded-2xl border border-black/[0.1] px-4 py-3 text-sm focus:border-[#58a700] focus:outline-none"
        />
        <button
          onClick={save}
          disabled={busy === "save" || !draft.trim()}
          className="rita-pill inline-flex items-center justify-center gap-1.5 rounded-2xl px-5 py-3 text-sm font-bold disabled:opacity-40"
        >
          {busy === "save" ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          Save
        </button>
        <button
          onClick={test}
          disabled={busy === "test" || !updatedAt}
          className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-black/[0.1] px-5 py-3 text-sm font-bold text-[#4a453d] hover:bg-[#f6efe1] disabled:opacity-40"
        >
          {busy === "test" ? <Loader2 size={15} className="animate-spin" /> : <PlugZap size={15} />}
          Test
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        <span className={updatedAt ? "font-bold text-[#4c9a2a]" : "text-[#a29a8d]"}>
          {updatedAt ? `Saved · ${new Date(updatedAt).toLocaleString()}` : "No key saved yet"}
        </span>
        {result && (
          <span
            className={`inline-flex items-center gap-1 font-bold ${result.ok ? "text-[#4c9a2a]" : "text-[#b4485f]"}`}
          >
            {result.ok ? <Check size={13} /> : <AlertTriangle size={13} />}
            {result.msg}
          </span>
        )}
      </div>
    </div>
  );
}

const SOURCE_TONES = [
  { soft: "#e4dcf3", dot: "#9b83d1", ink: "#4a3877" },
  { soft: "#d8ecdd", dot: "#6ab887", ink: "#215237" },
];

function SourceCard({ active, onClick, icon, label, toneIndex = 0 }: any) {
  const tone = SOURCE_TONES[toneIndex % SOURCE_TONES.length]!;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-3 rounded-3xl border p-5 text-left transition-all duration-200 hover:-translate-y-1 ${
        active ? "border-transparent shadow-[0_12px_26px_-16px_rgba(0,0,0,0.35)]" : "bg-white"
      }`}
      style={
        active ? { background: tone.soft, borderColor: tone.dot } : { borderColor: "rgba(0,0,0,0.08)" }
      }
    >
      <span
        className="grid h-11 w-11 place-items-center rounded-2xl"
        style={{ background: active ? "rgba(255,255,255,0.75)" : tone.soft, color: tone.dot }}
      >
        {icon}
      </span>
      <span className="text-sm font-bold" style={{ color: active ? tone.ink : "#23201d" }}>
        {label}
      </span>
    </button>
  );
}

function Group({ label, children }: any) {
  return (
    <div>
      <p className="mb-2 text-xs font-black uppercase tracking-widest text-[#6d675e]">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Pill({ active, onClick, children }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-5 py-2.5 text-sm font-bold transition-all ${
        active ? "rita-pill" : "border border-black/[0.09] bg-white text-[#4a453d] hover:bg-[#f6efe1]"
      }`}
    >
      {children}
    </button>
  );
}
