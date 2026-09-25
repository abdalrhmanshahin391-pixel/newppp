import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Copy, Eye, Send, Pause, Save } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { guardRedirect } from "@/lib/guard-redirect";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/legacy-client";
import { RitaXCard } from "@/components/RitaXAnnouncements";
import {
  RITAX_AUDIENCES,
  RITAX_FREQUENCIES,
  RITAX_LAYOUTS,
  RITAX_THEMES,
  emptyRitaX,
  ritaxStats,
  useAllRitaX,
  type RitaX,
} from "@/lib/ritax";

export const Route = createFileRoute("/admin/ritax-announcements")({
  head: () => ({
    meta: [
      { title: "RitaX Announcements — Admin" },
      { name: "description", content: "Design, schedule and measure RitaX announcements." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "RitaX Announcements — Admin" },
      { property: "og:description", content: "Design, schedule and measure RitaX announcements." },
    ],
  }),
  component: RitaXStudio,
});

const FIELD =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";
const LABEL = "text-[11px] font-black uppercase tracking-widest text-muted-foreground";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-black text-foreground">{title}</h3>
      <div className="grid gap-3">{children}</div>
    </div>
  );
}

function RitaXStudio() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: list, isLoading } = useAllRitaX();
  const { data: stats } = useQuery({ queryKey: ["ritax-stats"], queryFn: ritaxStats, staleTime: 30_000 });

  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<RitaX> | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!loading && !isAdmin) guardRedirect(navigate);
  }, [loading, isAdmin, navigate]);

  useEffect(() => {
    if (!draft && list?.length) {
      setSelected(list[0]!.id);
      setDraft(list[0]!);
    }
  }, [list, draft]);

  const current = useMemo(() => ({ ...emptyRitaX(), ...(draft ?? {}) }) as RitaX, [draft]);
  const set = (patch: Partial<RitaX>) => setDraft((d) => ({ ...(d ?? {}), ...patch }));

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["ritax-all"] });
    await qc.invalidateQueries({ queryKey: ["ritax-live"] });
    await qc.invalidateQueries({ queryKey: ["ritax-stats"] });
  }

  async function save(extra: Partial<RitaX> = {}) {
    setSaving(true);
    try {
      const payload = { ...current, ...extra };
      delete (payload as Record<string, unknown>)["created_at"];
      delete (payload as Record<string, unknown>)["updated_at"];
      if (selected) {
        const { id, ...rest } = payload;
        const { error } = await (supabase.from as any)("announcements").update(rest).eq("id", selected);
        if (error) throw error;
      } else {
        const { id: _ignored, ...rest } = payload as RitaX;
        const { data, error } = await (supabase.from as any)("announcements")
          .insert(rest)
          .select("*")
          .maybeSingle();
        if (error) throw error;
        if (data) {
          setSelected((data as RitaX).id);
          setDraft(data as RitaX);
        }
      }
      setDraft((d) => ({ ...(d ?? {}), ...extra }));
      await refresh();
    } catch (err) {
      console.error(err);
      alert("Could not save this announcement.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this announcement?")) return;
    await (supabase.from as any)("announcements").delete().eq("id", id);
    setSelected(null);
    setDraft(null);
    await refresh();
  }

  function duplicate(a: RitaX) {
    const { id, created_at, updated_at, ...rest } = a;
    setSelected(null);
    setDraft({ ...rest, name: `${a.name} copy`, status: "draft" });
  }

  if (loading || !isAdmin) return <div className="min-h-screen bg-muted/40" />;

  return (
    <div className="min-h-screen bg-muted/40">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-5 py-10">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-primary">RitaX</p>
            <h1 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">
              Announcement studio
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Design a pop-up, choose who sees it and when, then watch how it performs.
            </p>
          </div>
          <button
            onClick={() => {
              setSelected(null);
              setDraft(emptyRitaX());
            }}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-black text-primary-foreground"
          >
            <Plus size={16} /> New announcement
          </button>
        </header>

        <div className="grid gap-5 lg:grid-cols-[260px_1fr_360px]">
          {/* list */}
          <aside className="rounded-2xl border border-border bg-card p-3">
            <h2 className="px-1 pb-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
              Your announcements
            </h2>
            {isLoading && <p className="px-1 text-sm text-muted-foreground">Loading…</p>}
            <ul className="grid gap-1.5">
              {(list ?? []).map((a) => {
                const s = stats?.[a.id];
                return (
                  <li key={a.id}>
                    <button
                      onClick={() => {
                        setSelected(a.id);
                        setDraft(a);
                      }}
                      className={`w-full rounded-xl px-3 py-2 text-left transition ${
                        selected === a.id ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-bold text-foreground">{a.name}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                            a.status === "live"
                              ? "bg-emerald-500/15 text-emerald-600"
                              : a.status === "paused"
                                ? "bg-amber-500/15 text-amber-600"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {a.status}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{a.title}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {s ? `${s.view} seen · ${s.click} clicks` : "no data yet"}
                      </p>
                    </button>
                  </li>
                );
              })}
              {!isLoading && !(list ?? []).length && (
                <li className="px-1 text-sm text-muted-foreground">Nothing yet — create your first one.</li>
              )}
            </ul>
          </aside>

          {/* editor */}
          <div className="grid gap-4">
            <Section title="The message">
              <div>
                <span className={LABEL}>Internal name</span>
                <input className={FIELD} value={current.name} onChange={(e) => set({ name: e.target.value })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <span className={LABEL}>Small line on top</span>
                  <input className={FIELD} value={current.eyebrow ?? ""} onChange={(e) => set({ eyebrow: e.target.value })} />
                </div>
                <div>
                  <span className={LABEL}>Emoji</span>
                  <input className={FIELD} value={current.emoji ?? ""} onChange={(e) => set({ emoji: e.target.value })} />
                </div>
              </div>
              <div>
                <span className={LABEL}>Headline</span>
                <input className={FIELD} value={current.title} onChange={(e) => set({ title: e.target.value })} />
              </div>
              <div>
                <span className={LABEL}>Body</span>
                <textarea
                  className={`${FIELD} min-h-[80px]`}
                  value={current.body ?? ""}
                  onChange={(e) => set({ body: e.target.value })}
                />
              </div>
              <div>
                <span className={LABEL}>Picture link (optional)</span>
                <input
                  className={FIELD}
                  placeholder="https://…"
                  value={current.image_url ?? ""}
                  onChange={(e) => set({ image_url: e.target.value })}
                />
              </div>
            </Section>

            <Section title="Buttons">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <span className={LABEL}>Main button text</span>
                  <input className={FIELD} value={current.primary_label ?? ""} onChange={(e) => set({ primary_label: e.target.value })} />
                </div>
                <div>
                  <span className={LABEL}>Main button goes to</span>
                  <input className={FIELD} placeholder="/offers" value={current.primary_href ?? ""} onChange={(e) => set({ primary_href: e.target.value })} />
                </div>
                <div>
                  <span className={LABEL}>Small link text</span>
                  <input className={FIELD} value={current.secondary_label ?? ""} onChange={(e) => set({ secondary_label: e.target.value })} />
                </div>
                <div>
                  <span className={LABEL}>Small link goes to</span>
                  <input className={FIELD} placeholder="/pricing" value={current.secondary_href ?? ""} onChange={(e) => set({ secondary_href: e.target.value })} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  { label: "Offers", href: "/offers" },
                  { label: "Pricing", href: "/pricing" },
                  { label: "Start learning", href: "/learn" },
                  { label: "Flashcards", href: "/study" },
                ].map((s) => (
                  <button
                    key={s.href}
                    onClick={() => set({ primary_href: s.href })}
                    className="rounded-full border border-border px-3 py-1 text-xs font-bold text-muted-foreground hover:bg-muted"
                  >
                    → {s.label}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Look">
              <div>
                <span className={LABEL}>Shape</span>
                <div className="mt-1 grid gap-2 sm:grid-cols-2">
                  {RITAX_LAYOUTS.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => set({ layout: l.id })}
                      className={`rounded-xl border p-3 text-left ${
                        current.layout === l.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                      }`}
                    >
                      <span className="block text-sm font-bold text-foreground">{l.name}</span>
                      <span className="block text-xs text-muted-foreground">{l.note}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className={LABEL}>Colours</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {RITAX_THEMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => set({ theme: t.id, accent: null })}
                      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${
                        current.theme === t.id ? "border-primary" : "border-border"
                      }`}
                    >
                      <span className="h-4 w-4 rounded-full" style={{ background: t.bg, boxShadow: `inset 0 0 0 3px ${t.accent}` }} />
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm font-bold text-foreground">
                <input type="checkbox" checked={current.confetti} onChange={(e) => set({ confetti: e.target.checked })} />
                Sprinkle confetti
              </label>
              <div>
                <span className={LABEL}>Countdown ends (optional)</span>
                <input
                  type="datetime-local"
                  className={FIELD}
                  value={current.countdown_to ? current.countdown_to.slice(0, 16) : ""}
                  onChange={(e) => set({ countdown_to: e.target.value ? new Date(e.target.value).toISOString() : null })}
                />
              </div>
            </Section>

            <Section title="Who, where and when">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <span className={LABEL}>Audience</span>
                  <select className={FIELD} value={current.audience} onChange={(e) => set({ audience: e.target.value as RitaX["audience"] })}>
                    {RITAX_AUDIENCES.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className={LABEL}>How often</span>
                  <select className={FIELD} value={current.frequency} onChange={(e) => set({ frequency: e.target.value as RitaX["frequency"] })}>
                    {RITAX_FREQUENCIES.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className={LABEL}>Starts</span>
                  <input
                    type="datetime-local"
                    className={FIELD}
                    value={current.starts_at ? current.starts_at.slice(0, 16) : ""}
                    onChange={(e) => set({ starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  />
                </div>
                <div>
                  <span className={LABEL}>Ends</span>
                  <input
                    type="datetime-local"
                    className={FIELD}
                    value={current.ends_at ? current.ends_at.slice(0, 16) : ""}
                    onChange={(e) => set({ ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  />
                </div>
              </div>
              <div>
                <span className={LABEL}>Pages (one per line, blank = everywhere, /study* allowed)</span>
                <textarea
                  className={`${FIELD} min-h-[70px]`}
                  value={(current.pages ?? []).join("\n")}
                  onChange={(e) => set({ pages: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                />
              </div>
              <div>
                <span className={LABEL}>Priority (higher wins)</span>
                <input
                  type="number"
                  className={FIELD}
                  value={current.priority}
                  onChange={(e) => set({ priority: Number(e.target.value) || 0 })}
                />
              </div>
            </Section>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => save()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-black text-background disabled:opacity-60"
              >
                <Save size={16} /> {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => save({ status: "live" })}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-black text-white disabled:opacity-60"
              >
                <Send size={16} /> Publish
              </button>
              <button
                onClick={() => save({ status: "paused" })}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-black text-foreground"
              >
                <Pause size={16} /> Pause
              </button>
              <button
                onClick={() => setPreviewOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-black text-foreground"
              >
                <Eye size={16} /> Full preview
              </button>
              {selected && (
                <>
                  <button
                    onClick={() => duplicate(current)}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-black text-foreground"
                  >
                    <Copy size={16} /> Duplicate
                  </button>
                  <button
                    onClick={() => remove(selected)}
                    className="inline-flex items-center gap-2 rounded-full border border-destructive/40 px-5 py-2.5 text-sm font-black text-destructive"
                  >
                    <Trash2 size={16} /> Delete
                  </button>
                </>
              )}
            </div>
          </div>

          {/* live preview */}
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <h2 className="mb-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
              Live preview
            </h2>
            <div className="rounded-3xl border border-border bg-[radial-gradient(circle_at_30%_20%,hsl(var(--muted)),transparent)] p-4">
              <RitaXCard a={current} preview />
            </div>
            {selected && stats?.[selected] && (
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {(["view", "click", "dismiss"] as const).map((k) => (
                  <div key={k} className="rounded-2xl border border-border bg-card p-3">
                    <div className="text-xl font-black text-foreground">{stats[selected]![k]}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{k}s</div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      </main>

      {previewOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4" onClick={() => setPreviewOpen(false)}>
          <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <RitaXCard a={current} preview onClose={() => setPreviewOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
