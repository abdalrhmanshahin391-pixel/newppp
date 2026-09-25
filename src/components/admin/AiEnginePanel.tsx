import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Sliders, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  listAiEngine,
  saveToolKey,
  clearToolKey,
  testTool,
  type AiToolId,
} from "@/lib/ai-engine.functions";

type Tool = {
  id: AiToolId;
  name: string;
  blurb: string;
  source: "own" | "shared" | "secret" | "gateway";
  model: string;
  last4: string | null;
  updatedAt: string | null;
};

const SOURCE_LABEL: Record<Tool["source"], string> = {
  own: "its own key",
  shared: "shared Gemini key",
  secret: "site Gemini key",
  gateway: "shared RitaJet AI",
};

export function AiEnginePanel() {
  const list = useServerFn(listAiEngine);
  const save = useServerFn(saveToolKey);
  const clear = useServerFn(clearToolKey);
  const test = useServerFn(testTool);

  const [tools, setTools] = useState<Tool[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, { ok: boolean; message: string }>>({});

  async function refresh() {
    try {
      const r: any = await list();
      setTools((r?.tools ?? []) as Tool[]);
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  async function onSave(id: AiToolId) {
    const key = (draft[id] ?? "").trim();
    if (key.length < 20) {
      toast.error("Paste the full key first.");
      return;
    }
    setBusy(id);
    try {
      const r: any = await save({ data: { tool: id, apiKey: key } });
      setDraft((d) => ({ ...d, [id]: "" }));
      if (r?.test) setResult((s) => ({ ...s, [id]: r.test }));
      toast[r?.test?.ok ? "success" : "warning"](r?.test?.message || "Key saved.");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "Could not save that key.");
    } finally {
      setBusy(null);
    }
  }

  async function onTest(id: AiToolId) {
    setBusy(`${id}-test`);
    try {
      const r: any = await test({ data: { tool: id } });
      setResult((s) => ({ ...s, [id]: r }));
      toast[r?.ok ? "success" : "error"](r?.message || "No answer.");
    } catch (e: any) {
      toast.error(e?.message || "Test failed.");
    } finally {
      setBusy(null);
    }
  }

  async function onClear(id: AiToolId) {
    if (!confirm("Remove this key? The tool falls back to the shared key.")) return;
    setBusy(`${id}-del`);
    try {
      await clear({ data: { tool: id } });
      setResult((s) => {
        const next = { ...s };
        delete next[id];
        return next;
      });
      toast.success("Key removed.");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "Could not remove that key.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-3xl border border-violet-500/30 bg-gradient-to-br from-violet-500/[0.06] to-fuchsia-500/[0.04] p-6 md:p-7 mb-6">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-400 to-fuchsia-500">
          <Sliders className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-base font-bold">Every AI tool in one place</h2>
          <p className="mt-0.5 text-xs text-white/55">
            Each tool uses its own key if you paste one, otherwise the shared Gemini key, otherwise
            the shared RitaJet AI. Keys start with <code className="text-emerald-200">AIza</code> and
            come from aistudio.google.com/apikey.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {tools.map((t) => {
          const r = result[t.id];
          return (
            <div key={t.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-widest">
                  {t.name}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${
                    t.source === "own"
                      ? "text-emerald-300"
                      : t.source === "gateway"
                        ? "text-white/45"
                        : "text-sky-300"
                  }`}
                >
                  {t.source === "own" ? <Check className="h-3 w-3" /> : null}
                  using {SOURCE_LABEL[t.source]}
                  {t.last4 ? ` ••••${t.last4}` : ""}
                </span>
                <span className="text-[11px] text-white/40">model: {t.model}</span>
              </div>
              <p className="mt-2 text-xs text-white/55">{t.blurb}</p>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  type="password"
                  autoComplete="off"
                  value={draft[t.id] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [t.id]: e.target.value }))}
                  placeholder="AIza…"
                  className="flex-1 rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-sm outline-none placeholder:text-white/25 focus:border-violet-400/60"
                />
                <button
                  type="button"
                  onClick={() => onSave(t.id)}
                  disabled={busy === t.id}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-black disabled:opacity-50"
                >
                  {busy === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => onTest(t.id)}
                  disabled={busy === `${t.id}-test`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-white/80 disabled:opacity-40"
                >
                  {busy === `${t.id}-test` ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  Test
                </button>
                {t.source === "own" && (
                  <button
                    type="button"
                    onClick={() => onClear(t.id)}
                    disabled={busy === `${t.id}-del`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/30 px-3 py-2 text-sm font-bold text-rose-300 disabled:opacity-40"
                    aria-label={`Remove the ${t.name} key`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {r && (
                <p
                  className={`mt-2 text-xs font-semibold ${r.ok ? "text-emerald-300" : "text-amber-300"}`}
                >
                  {r.message}
                </p>
              )}
            </div>
          );
        })}
        {tools.length === 0 && <p className="text-sm text-white/50">Loading the tools…</p>}
      </div>
    </section>
  );
}
