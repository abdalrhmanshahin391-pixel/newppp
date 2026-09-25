import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, Layers, Loader2, Lock, RefreshCw, Star, Trash2, Unlock, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { guardRedirect } from "@/lib/guard-redirect";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/legacy-client";

export const Route = createFileRoute("/admin/spaces/$spaceId")({
  head: () => ({
    meta: [
      { title: "Space details — Administration Site" },
      { name: "description", content: "Members, decks, posts, invites and moderation history for one classroom." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Space details — Administration Site" },
      { property: "og:description", content: "Watch and moderate one classroom or study group." },
    ],
  }),
  component: AdminSpaceDetail,
});

type Detail = {
  space: Record<string, any> | null;
  owner: Record<string, any> | null;
  members: any[];
  decks: any[];
  posts: any[];
  messages: any[];
  invites: any[];
  log: any[];
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border-2 border-border bg-card p-5">
      <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function AdminSpaceDetail() {
  const { spaceId } = Route.useParams();
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [reader, setReader] = useState<{ title: string; cards: any[] } | null>(null);

  useEffect(() => {
    if (!loading && !isAdmin) guardRedirect(navigate);
  }, [loading, isAdmin, navigate]);

  const { data } = useQuery({
    enabled: isAdmin,
    queryKey: ["admin-space", spaceId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("admin_space_detail", { _space_id: spaceId });
      if (error) throw error;
      return (data ?? null) as Detail | null;
    },
  });

  async function act(action: string, target?: string) {
    const reason = prompt("Why? (kept in the moderation log)") ?? "";
    setBusy(action + (target ?? ""));
    try {
      const { error } = await (supabase.rpc as any)("admin_space_action", {
        _space_id: spaceId,
        _action: action,
        _reason: reason,
        _target: target ?? null,
      });
      if (error) throw error;
      toast.success("Done.");
      qc.invalidateQueries({ queryKey: ["admin-space", spaceId] });
    } catch (e: any) {
      toast.error(e?.message || "Could not do that");
    } finally {
      setBusy(null);
    }
  }

  if (loading || !isAdmin) return <div className="min-h-screen bg-muted/40" />;

  const s = data?.space;

  return (
    <div className="min-h-screen bg-muted/40 text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-5 pt-28 pb-20">
        <Link to="/admin/spaces" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-muted-foreground">
          <ArrowLeft size={15} /> All classrooms
        </Link>

        <h1 className="mb-1 text-3xl font-black tracking-tight">
          {s?.emoji || "🏫"} {s?.name || "Space"}
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Owner: {data?.owner?.full_name || data?.owner?.username || data?.owner?.email || "unknown"} · Join code{" "}
          <span className="font-black">{s?.join_code ?? "—"}</span>
        </p>

        <div className="mb-8 flex flex-wrap gap-2">
          <button
            onClick={() => act(s?.chat_enabled ? "freeze_chat" : "unfreeze_chat")}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-border bg-card px-4 py-2 text-sm font-bold"
          >
            {busy?.startsWith("freeze") || busy?.startsWith("unfreeze") ? (
              <Loader2 size={14} className="animate-spin" />
            ) : s?.chat_enabled ? (
              <Lock size={14} />
            ) : (
              <Unlock size={14} />
            )}
            {s?.chat_enabled ? "Freeze chat" : "Unfreeze chat"}
          </button>
          <button
            onClick={() => act("hide")}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-border bg-card px-4 py-2 text-sm font-bold"
          >
            <Eye size={14} /> Hide from discovery
          </button>
          <button
            onClick={() => act("rotate_code")}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-border bg-card px-4 py-2 text-sm font-bold"
          >
            <RefreshCw size={14} /> New join code
          </button>
          <button
            onClick={() => act("close_space")}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-destructive/40 px-4 py-2 text-sm font-bold text-destructive"
          >
            <Trash2 size={14} /> Close space
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card title={`Members (${data?.members?.length ?? 0})`}>
            <div className="space-y-1.5">
              {(data?.members ?? []).map((m: any) => (
                <p key={m.user_id} className="truncate text-sm">
                  <span className="font-bold">{m.full_name || m.username || m.user_id}</span>{" "}
                  <span className="text-xs text-muted-foreground">· {m.role}</span>
                </p>
              ))}
              {!(data?.members ?? []).length && <p className="text-sm text-muted-foreground">Nobody yet.</p>}
            </div>
          </Card>

          <Card title={`Decks (${data?.decks?.length ?? 0})`}>
            <div className="space-y-2">
              {(data?.decks ?? []).map((d: any) => (
                <div key={d.id} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">
                    {d.emoji || "🃏"} {d.title}
                  </span>
                  {d.rating_count > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-black text-amber-500">
                      <Star size={12} className="fill-amber-400 text-amber-400" />
                      {Number(d.rating_avg).toFixed(1)} ({d.rating_count})
                    </span>
                  )}
                  <button
                    onClick={async () => {
                      const { data: cards, error } = await (supabase.rpc as any)("admin_space_deck_cards", {
                        _deck_id: d.id,
                      });
                      if (error) return toast.error(error.message);
                      setReader({ title: d.title, cards: cards ?? [] });
                    }}
                    className="inline-flex items-center gap-1 text-xs font-black text-primary"
                  >
                    <Layers size={13} /> Open cards
                  </button>
                  <button
                    onClick={() => act("unpublish_deck", d.id)}
                    className="text-xs font-black text-destructive"
                  >
                    Unpublish
                  </button>
                </div>
              ))}
              {!(data?.decks ?? []).length && <p className="text-sm text-muted-foreground">No decks shared here.</p>}
            </div>
          </Card>

          <Card title={`Posts (${data?.posts?.length ?? 0})`}>
            <div className="space-y-2">
              {(data?.posts ?? []).map((p: any) => (
                <p key={p.id} className="text-sm">
                  <span className="font-bold">{p.title || "Announcement"}</span>{" "}
                  <span className="text-xs text-muted-foreground">{p.body}</span>
                </p>
              ))}
              {!(data?.posts ?? []).length && <p className="text-sm text-muted-foreground">Nothing posted.</p>}
            </div>
          </Card>

          <Card title={`Chat (${data?.messages?.length ?? 0})`}>
            <div className="space-y-2">
              {(data?.messages ?? []).map((m: any) => (
                <div key={m.id} className="flex items-start gap-2">
                  <p className="min-w-0 flex-1 text-sm">
                    <span className="font-bold">{m.author_name || "Member"}:</span>{" "}
                    <span className="text-muted-foreground">{m.body}</span>
                  </p>
                  <button
                    onClick={() => act("delete_message", m.id)}
                    className="shrink-0 text-destructive"
                    aria-label="Delete message"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {!(data?.messages ?? []).length && <p className="text-sm text-muted-foreground">No messages.</p>}
            </div>
          </Card>

          <Card title="Moderation history">
            <div className="space-y-1.5">
              {(data?.log ?? []).map((l: any) => (
                <p key={l.id} className="text-xs text-muted-foreground">
                  {new Date(l.created_at).toLocaleString()} · <span className="font-bold">{l.action}</span>
                  {l.reason ? ` — ${l.reason}` : ""}
                </p>
              ))}
              {!(data?.log ?? []).length && <p className="text-sm text-muted-foreground">Nothing yet.</p>}
            </div>
          </Card>
        </div>
      </main>

      {reader && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setReader(null)}>
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl border-2 border-border bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-lg font-black">{reader.title}</h2>
              <span className="text-xs font-bold text-muted-foreground">
                {reader.cards.length} cards · read-only, nobody is told
              </span>
              <button onClick={() => setReader(null)} className="ms-auto text-muted-foreground" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2">
              {reader.cards.map((c: any) => (
                <div key={c.id} className="rounded-2xl border border-border p-4">
                  {c.group_name && (
                    <p className="mb-1 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                      {c.group_name}
                    </p>
                  )}
                  <p className="text-sm font-black">{c.front}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{c.back}</p>
                </div>
              ))}
              {reader.cards.length === 0 && (
                <p className="text-sm text-muted-foreground">This deck has no cards.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
