import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ExternalLink, KeyRound, Loader2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { guardRedirect } from "@/lib/guard-redirect";
import { getRitaV3Admin, testRitaV3ControlPlane } from "@/lib/rita-v3.functions";

const LOVABLE_SECRETS_URL =
  "https://lovable.dev/projects/84f9560d-cda3-444b-b692-31491571e090?view=more&subview=cloud&section=secrets";

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

function RitaVoiceAdmin() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const getAdmin = useServerFn(getRitaV3Admin);
  const testPlane = useServerFn(testRitaV3ControlPlane);
  const [data, setData] = useState<Awaited<ReturnType<typeof getAdmin>> | null>(null);
  const [busy, setBusy] = useState<"refresh" | "test" | null>(null);

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/login" });
    else if (!loading && user && !isAdmin) guardRedirect(navigate);
  }, [isAdmin, loading, navigate, user]);

  async function refresh() {
    setBusy("refresh");
    try {
      setData(await getAdmin());
    } catch (error) {
      toast.error(String((error as Error)?.message ?? error));
    } finally {
      setBusy(null);
    }
  }
  useEffect(() => {
    if (isAdmin) void refresh();
  }, [isAdmin]);

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
    latencyP50: 0,
    latencyP95: 0,
    latencyP99: 0,
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
            ["p50 audio", `${metrics.latencyP50}ms`],
            ["p95 audio", `${metrics.latencyP95}ms`],
            ["p99 audio", `${metrics.latencyP99}ms`],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs font-bold text-[#817a84]">{label}</p>
              <p className="mt-1 text-xl font-black">{value}</p>
            </div>
          ))}
        </section>

        <section className="mt-4 rounded-2xl border bg-white px-5 py-4 text-sm font-semibold text-[#5d5661]">
          Pipecat secret set: <strong>{data?.workerSecretStatus ?? "not checked"}</strong>
          {data?.workerRegion ? ` · ${data.workerRegion}` : ""}. Updating a worker secret requires a
          Rita worker redeploy.
        </section>

        <section className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <div>
            <p className="font-black text-emerald-900">Keys are protected by Lovable Cloud</p>
            <p className="mt-1 text-sm text-emerald-800">
              This page never stores or reveals secret values. Add or replace them only in Lovable
              Secrets, then refresh this status page.
            </p>
          </div>
          <a
            href={LOVABLE_SECRETS_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-3 font-bold text-white"
          >
            Manage Lovable Secrets <ExternalLink size={16} />
          </a>
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
                          ? "Configured in Lovable; worker sync is still pending"
                          : "Not configured in Lovable Secrets"}
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
                <a
                  href={LOVABLE_SECRETS_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#ddd7df] px-4 py-2.5 text-sm font-bold text-[#5c3f7c]"
                >
                  {configured ? "Replace in Lovable Secrets" : "Add in Lovable Secrets"}
                  <ExternalLink size={15} />
                </a>
              </article>
            );
          })}
        </section>

        <section className="mt-6 rounded-3xl bg-[#241932] p-6 text-white">
          <h2 className="text-xl font-black">Deployment check</h2>
          <p className="mt-2 text-sm text-white/65">
            Lovable Secrets supply the website control plane. Soniox, Groq, and Google must also
            exist in the Pipecat secret set <code>ritajet-voice-v3-secrets</code> before the worker
            can serve calls.
          </p>
          <button
            onClick={async () => {
              setBusy("test");
              const result = await testPlane();
              if (result.ok) toast.success(result.message);
              else toast.error(result.message);
              setBusy(null);
            }}
            className="mt-4 rounded-xl bg-white px-4 py-3 font-bold text-[#241932]"
          >
            {busy === "test" ? "Checking…" : "Check Pipecat deployment"}
          </button>
        </section>
      </div>
    </main>
  );
}
