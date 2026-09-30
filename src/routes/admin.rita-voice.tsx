import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { guardRedirect } from "@/lib/guard-redirect";
import {
  deleteRitaV3Key,
  getRitaV3Admin,
  retryRitaV3WorkerSync,
  runRitaV3LiveProbe,
  saveRitaV3Key,
  testRitaV3ControlPlane,
} from "@/lib/rita-v3.functions";

export const Route = createFileRoute("/admin/rita-voice")({
  head: () => ({ meta: [{ title: "Rita Voice v3 — Admin" }] }),
  component: RitaVoiceAdmin,
});

const PROVIDERS = [
  {
    id: "soniox",
    name: "Soniox",
    purpose: "Multilingual listening · stt-rt-v5",
    url: "https://console.soniox.com/",
  },
  {
    id: "groq",
    name: "Groq",
    purpose: "Fast reasoning · openai/gpt-oss-120b",
    url: "https://console.groq.com/keys",
  },
  {
    id: "google",
    name: "Google AI",
    purpose: "Gemini 3.8 Flash-Lite TTS · Achernar",
    url: "https://aistudio.google.com/apikey",
  },
  {
    id: "pipecat_public",
    name: "Pipecat public key",
    purpose: "Start student sessions safely",
    url: "https://pipecat.daily.co/",
  },
  {
    id: "pipecat_private",
    name: "Pipecat private key",
    purpose: "Deployment health and session stop",
    url: "https://pipecat.daily.co/",
  },
] as const;

type Provider = (typeof PROVIDERS)[number]["id"];

function RitaVoiceAdmin() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const getAdmin = useServerFn(getRitaV3Admin);
  const saveKey = useServerFn(saveRitaV3Key);
  const deleteKey = useServerFn(deleteRitaV3Key);
  const retryWorkerSync = useServerFn(retryRitaV3WorkerSync);
  const testPlane = useServerFn(testRitaV3ControlPlane);
  const runLiveProbe = useServerFn(runRitaV3LiveProbe);
  const [data, setData] = useState<Awaited<ReturnType<typeof getAdmin>> | null>(null);
  const [drafts, setDrafts] = useState<Record<Provider, string>>({
    soniox: "",
    groq: "",
    google: "",
    pipecat_public: "",
    pipecat_private: "",
  });
  const [visible, setVisible] = useState<Record<Provider, boolean>>({
    soniox: false,
    groq: false,
    google: false,
    pipecat_public: false,
    pipecat_private: false,
  });
  const [feedback, setFeedback] = useState<
    Partial<Record<Provider, { kind: "success" | "warning" | "error"; message: string }>>
  >({});
  const [readiness, setReadiness] = useState<{
    ok: boolean;
    message: string;
    checks?: { id: string; label: string; ok: boolean; message: string }[];
  } | null>(null);
  const [probe, setProbe] = useState<{
    ok: boolean;
    message: string;
    startupMs?: number;
  } | null>(null);
  const [busy, setBusy] = useState<Provider | "refresh" | "sync" | "test" | "probe" | null>(null);

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/login" });
    else if (!loading && user && !isAdmin) guardRedirect(navigate);
  }, [isAdmin, loading, navigate, user]);

  const applyAdminData = useCallback((nextData: Awaited<ReturnType<typeof getAdmin>>) => {
    setData(nextData);
    setFeedback((current) => {
      const next = { ...current };
      for (const provider of ["soniox", "groq", "google"] as const) {
        if (nextData.workerConfigured[provider]) delete next[provider];
      }
      return next;
    });
  }, []);

  const applyProviderSync = useCallback(
    (
      providerSync: Record<
        string,
        { synced?: boolean; pending?: boolean; reason?: string } | undefined
      >,
    ) => {
      setFeedback((current) => {
        const next = { ...current };
        for (const provider of ["soniox", "groq", "google"] as const) {
          const result = providerSync[provider];
          if (!result) continue;
          next[provider] = {
            kind: result.synced ? "success" : result.pending ? "warning" : "error",
            message:
              result.reason || (result.synced ? "Ready in Pipecat." : "Pipecat sync failed."),
          };
        }
        return next;
      });
    },
    [],
  );

  const refresh = useCallback(async () => {
    setBusy("refresh");
    try {
      applyAdminData(await getAdmin());
    } catch (error) {
      toast.error(String((error as Error)?.message ?? error));
    } finally {
      setBusy(null);
    }
  }, [applyAdminData, getAdmin]);
  useEffect(() => {
    if (isAdmin) void refresh();
  }, [isAdmin, refresh]);

  async function save(provider: Provider) {
    const apiKey = drafts[provider].trim();
    if (!apiKey) return;
    setBusy(provider);
    setFeedback((current) => ({ ...current, [provider]: undefined }));
    try {
      const result = await saveKey({ data: { provider, apiKey } });
      setDrafts((current) => ({ ...current, [provider]: "" }));
      const message = result.reason;
      setFeedback((current) => ({
        ...current,
        [provider]: {
          kind: result.synced ? "success" : "warning",
          message,
        },
      }));
      if (result.synced) toast.success(message);
      else toast.warning(message);
      if ("providerSync" in result && result.providerSync) {
        applyProviderSync(result.providerSync);
      }
      applyAdminData(await getAdmin());
    } catch (error) {
      const message = String((error as Error)?.message ?? error);
      setFeedback((current) => ({ ...current, [provider]: { kind: "error", message } }));
      toast.error(message);
    } finally {
      setBusy(null);
    }
  }

  async function remove(provider: Provider) {
    if (!confirm(`Remove the Rita v3 ${provider} key?`)) return;
    setBusy(provider);
    setFeedback((current) => ({ ...current, [provider]: undefined }));
    try {
      await deleteKey({ data: { provider } });
      setDrafts((current) => ({ ...current, [provider]: "" }));
      setFeedback((current) => ({
        ...current,
        [provider]: { kind: "success", message: "Key removed." },
      }));
      toast.success("Key removed");
      applyAdminData(await getAdmin());
    } catch (error) {
      const message = String((error as Error)?.message ?? error);
      setFeedback((current) => ({ ...current, [provider]: { kind: "error", message } }));
      toast.error(message);
    } finally {
      setBusy(null);
    }
  }

  async function retrySync() {
    setBusy("sync");
    try {
      const result = await retryWorkerSync();
      applyProviderSync(result.providerSync);
      if (result.synced) toast.success(result.reason);
      else if (result.pending) toast.warning(result.reason);
      else toast.error(result.reason);
      applyAdminData(await getAdmin());
    } catch (error) {
      toast.error(String((error as Error)?.message ?? error));
    } finally {
      setBusy(null);
    }
  }

  if (loading || !isAdmin)
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  const metrics = data?.metrics ?? {
    sessions: 0,
    active: 0,
    failed: 0,
    uniqueUsers: 0,
    latencySamples: 0,
    latencyP50: null,
    latencyP95: null,
    latencyP99: null,
  };

  return (
    <main className="min-h-screen bg-[#f7f5f8] px-4 py-8 text-[#211f24] sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link to="/admin/ai-keys" className="text-sm font-bold text-[#76539f]">
              ← General AI settings
            </Link>
            <h1 className="mt-2 text-3xl font-black">Rita Realtime Voice v3</h1>
            <p className="mt-1 text-[#6f6972]">
              One clean control room for the new voice system only.
            </p>
          </div>
          <button
            onClick={() => void refresh()}
            className="flex items-center gap-2 rounded-xl border bg-white px-4 py-3 font-bold"
          >
            <RefreshCw size={16} className={busy === "refresh" ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        <section className="mt-7 rounded-3xl border-2 border-red-300 bg-red-50 p-5 sm:p-7">
          <p className="text-xs font-black uppercase tracking-[.15em] text-red-700">
            Active architecture — no hidden fallback
          </p>
          <h2 className="mt-2 text-xl font-black">
            Daily WebRTC → Soniox → Groq → Gemini 3.8 Flash-Lite TTS
          </h2>
          <p className="mt-2 text-sm text-red-800">
            Voice: Achernar · Agent: {data?.agentName ?? "ritajet-voice-v3"}. A provider failure
            produces a visible error; Rita never drops into Legacy.
          </p>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {[
            ["Sessions", metrics.sessions],
            ["Active", metrics.active],
            ["Failed", metrics.failed],
            ["Learners", metrics.uniqueUsers],
            ["Audio samples", metrics.latencySamples],
            ["p50 remote audio", metrics.latencyP50 === null ? "—" : `${metrics.latencyP50}ms`],
            ["p95 remote audio", metrics.latencyP95 === null ? "—" : `${metrics.latencyP95}ms`],
            ["p99 remote audio", metrics.latencyP99 === null ? "—" : `${metrics.latencyP99}ms`],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs font-bold text-[#817a84]">{label}</p>
              <p className="mt-1 text-xl font-black">{value}</p>
            </div>
          ))}
        </section>

        <p className="mt-2 text-xs text-[#6f6972]">
          Remote-audio timing is a transport-level proxy, not proof that a speaker played the first
          sample. Percentiles are provisional below 200 samples (p95) or 1,000 samples (p99).
        </p>

        <section className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white px-5 py-4 text-sm font-semibold text-[#5d5661]">
          <p>
            Pipecat secret set: <strong>{data?.workerSecretStatus ?? "not checked"}</strong>
            {data?.workerRegion ? ` · ${data.workerRegion}` : ""}. Updating a worker secret requires
            a Rita worker redeploy.
          </p>
          <button
            type="button"
            onClick={() => void retrySync()}
            disabled={busy === "sync" || !data?.configured?.pipecat_private}
            className="rounded-xl bg-[#21172c] px-4 py-2.5 font-bold text-white disabled:opacity-40"
          >
            {busy === "sync" ? "Syncing…" : "Retry Pipecat sync"}
          </button>
        </section>

        <section className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <div>
            <p className="font-black text-emerald-900">Manage the keys here</p>
            <p className="mt-1 text-sm text-emerald-800">
              Keys are saved server-side in Lovable Cloud behind admin-only database rules. Their
              values are never returned to this page. Saving Soniox, Groq, or Google also syncs that
              key to Pipecat; saving the Pipecat private key later automatically retries all pending
              provider keys.
            </p>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          {PROVIDERS.map((provider) => {
            const configured = Boolean(data?.configured?.[provider.id]);
            const workerConfigured =
              provider.id === "soniox" || provider.id === "groq" || provider.id === "google"
                ? Boolean(data?.workerConfigured?.[provider.id])
                : configured;
            return (
              <article key={provider.id} className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <KeyRound size={18} />
                      <h3 className="text-lg font-black">{provider.name}</h3>
                      {workerConfigured ? (
                        <CheckCircle2 className="text-emerald-600" size={18} />
                      ) : (
                        <XCircle className="text-amber-500" size={18} />
                      )}
                    </div>
                    <p className="mt-1 text-sm text-[#77717a]">{provider.purpose}</p>
                    <p className="mt-1 text-xs font-bold text-[#8a748f]">
                      {workerConfigured
                        ? "Available to the running worker configuration"
                        : configured
                          ? provider.id === "soniox" ||
                            provider.id === "groq" ||
                            provider.id === "google"
                            ? "Saved in Lovable Cloud; Pipecat sync is pending"
                            : "Saved in Lovable Cloud"
                          : "Not configured"}
                    </p>
                  </div>
                  <a
                    href={provider.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#76539f]"
                  >
                    <ExternalLink size={18} />
                  </a>
                </div>
                <div className="relative mt-4">
                  <input
                    type={visible[provider.id] ? "text" : "password"}
                    value={drafts[provider.id]}
                    onChange={(event) =>
                      setDrafts((current) => ({ ...current, [provider.id]: event.target.value }))
                    }
                    placeholder={
                      configured ? "Configured — paste only to replace" : "Paste the API key"
                    }
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full rounded-xl border border-[#ddd7df] px-4 py-3 pr-12 outline-none focus:border-[#8c5ee7]"
                  />
                  <button
                    type="button"
                    aria-label={visible[provider.id] ? "Hide API key" : "Show API key"}
                    onClick={() =>
                      setVisible((current) => ({
                        ...current,
                        [provider.id]: !current[provider.id],
                      }))
                    }
                    className="absolute right-3 top-3.5 text-[#77717a]"
                  >
                    {visible[provider.id] ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void save(provider.id)}
                    disabled={!drafts[provider.id].trim() || busy === provider.id}
                    className="flex-1 rounded-xl bg-[#21172c] px-4 py-2.5 font-bold text-white disabled:opacity-40"
                  >
                    {busy === provider.id ? "Saving…" : configured ? "Replace" : "Save"}
                  </button>
                  {configured && (
                    <button
                      type="button"
                      aria-label={`Remove ${provider.name} key`}
                      onClick={() => void remove(provider.id)}
                      disabled={busy === provider.id}
                      className="rounded-xl border border-red-200 px-3 text-red-700 disabled:opacity-40"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                {feedback[provider.id] && (
                  <p
                    className={`mt-3 rounded-xl px-3 py-2 text-xs font-bold ${feedback[provider.id]?.kind === "error" ? "bg-red-50 text-red-700" : feedback[provider.id]?.kind === "warning" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}
                  >
                    {feedback[provider.id]?.message}
                  </p>
                )}
              </article>
            );
          })}
        </section>

        <section className="mt-6 rounded-3xl bg-[#241932] p-6 text-white">
          <h2 className="text-xl font-black">Worker readiness</h2>
          <p className="mt-2 text-sm text-white/65">
            Keys saved above supply the website control plane. Soniox, Groq, and Google are also
            synchronized automatically to the Pipecat secret set{" "}
            <code>ritajet-voice-v3-secrets</code>. A successful sync still requires a Rita worker
            redeploy before an already-running worker uses the replacement value.
          </p>
          <button
            onClick={async () => {
              setBusy("test");
              try {
                const result = await testPlane();
                setReadiness(result);
                if (result.ok) toast.success(result.message);
                else toast.error(result.message);
              } catch (error) {
                toast.error(String((error as Error)?.message ?? error));
              } finally {
                setBusy(null);
              }
            }}
            className="mt-4 rounded-xl bg-white px-4 py-3 font-bold text-[#241932]"
          >
            {busy === "test" ? "Checking…" : "Run full readiness check"}
          </button>
          {readiness && (
            <div className="mt-5 grid gap-2">
              {(readiness.checks ?? []).map((check) => (
                <div
                  key={check.id}
                  className={`rounded-xl border px-4 py-3 ${check.ok ? "border-emerald-400/30 bg-emerald-400/10" : "border-red-400/40 bg-red-400/10"}`}
                >
                  <div className="flex items-center gap-2 font-black">
                    {check.ok ? (
                      <CheckCircle2 size={17} className="text-emerald-300" />
                    ) : (
                      <XCircle size={17} className="text-red-300" />
                    )}
                    {check.label}
                  </div>
                  <p className="mt-1 text-xs text-white/75">{check.message}</p>
                </div>
              ))}
            </div>
          )}
          <div className="mt-5 border-t border-white/10 pt-5">
            <p className="text-sm text-white/65">
              The live probe briefly starts the real worker and immediately stops it. It does not
              use a microphone or the Legacy voice system.
            </p>
            <button
              type="button"
              onClick={async () => {
                setBusy("probe");
                setProbe(null);
                try {
                  const result = await runLiveProbe();
                  setProbe(result);
                  if (result.ok) toast.success(result.message);
                  else toast.error(result.message);
                } catch (error) {
                  const message = String((error as Error)?.message ?? error);
                  setProbe({ ok: false, message });
                  toast.error(message);
                } finally {
                  setBusy(null);
                }
              }}
              disabled={busy === "probe"}
              className="mt-3 rounded-xl border border-white/25 px-4 py-3 font-bold disabled:opacity-40"
            >
              {busy === "probe" ? "Starting real worker…" : "Run short live worker probe"}
            </button>
            {probe && (
              <p
                className={`mt-3 rounded-xl px-4 py-3 text-sm font-bold ${probe.ok ? "bg-emerald-400/15 text-emerald-100" : "bg-red-400/15 text-red-100"}`}
              >
                {probe.message}
                {probe.startupMs !== undefined ? ` Startup: ${probe.startupMs}ms.` : ""}
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
