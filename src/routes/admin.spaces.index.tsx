import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MessagesSquare, Search, UsersRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { guardRedirect } from "@/lib/guard-redirect";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/legacy-client";

export const Route = createFileRoute("/admin/spaces/")({
  head: () => ({
    meta: [
      { title: "Classrooms & groups — Administration Site" },
      { name: "description", content: "Watch every classroom and study group: members, decks, posts and activity." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Classrooms & groups — Administration Site" },
      { property: "og:description", content: "Oversee every space on the site." },
    ],
  }),
  component: AdminSpaces,
});

type Row = {
  id: string;
  kind: string;
  name: string;
  emoji: string | null;
  color: string | null;
  created_at: string;
  owner_name: string | null;
  owner_username: string | null;
  owner_email: string | null;
  members: number;
  decks: number;
  messages: number;
  last_activity: string | null;
  chat_enabled: boolean;
  discoverable: boolean;
};

function AdminSpaces() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!loading && !isAdmin) guardRedirect(navigate);
  }, [loading, isAdmin, navigate]);

  const { data } = useQuery({
    enabled: isAdmin,
    queryKey: ["admin-spaces"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("admin_list_spaces");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return data ?? [];
    return (data ?? []).filter((r) =>
      [r.name, r.owner_name, r.owner_username, r.owner_email].some((v) => (v ?? "").toLowerCase().includes(term)),
    );
  }, [data, q]);

  if (loading || !isAdmin) return <div className="min-h-screen bg-muted/40" />;

  return (
    <div className="min-h-screen bg-muted/40 text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-5 pt-28 pb-20">
        <Link to="/admin" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-muted-foreground">
          <ArrowLeft size={15} /> Administration site
        </Link>
        <h1 className="mb-1 inline-flex items-center gap-3 text-3xl font-black tracking-tight">
          <UsersRound size={26} className="text-primary" /> Classrooms & groups
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Every space students created, who runs it and how busy it is. Open one to read its posts and take action.
        </p>

        <div className="mb-5 flex items-center gap-2 rounded-xl border-2 border-border bg-card px-3 py-2">
          <Search size={15} className="text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, owner or email"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>

        <div className="space-y-2">
          {rows.map((r) => (
            <Link
              key={r.id}
              to="/admin/spaces/$spaceId"
              params={{ spaceId: r.id }}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:border-primary"
            >
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg"
                style={{ background: r.color ?? "var(--muted)" }}
              >
                {r.emoji || "🏫"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black">
                  {r.name} <span className="text-xs font-bold text-muted-foreground">· {r.kind}</span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.owner_name || r.owner_username || r.owner_email || "Unknown owner"} · {r.members} members ·{" "}
                  {r.decks} decks · {r.messages} messages
                  {r.last_activity ? ` · active ${new Date(r.last_activity).toLocaleDateString()}` : ""}
                </p>
              </div>
              {!r.chat_enabled && (
                <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-black uppercase text-muted-foreground">
                  Chat off
                </span>
              )}
              <MessagesSquare size={15} className="text-muted-foreground" />
            </Link>
          ))}
          {rows.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No spaces yet.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
