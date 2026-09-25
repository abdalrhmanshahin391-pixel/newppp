import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { refreshSpace } from "@/lib/spaces";
import { ArrowLeft, Check, Loader2, Send, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { openAuth } from "@/lib/auth-dialog";
import { useAuth } from "@/hooks/useAuth";
import { readBoardWithCounts, readTopicCards } from "@/lib/local-board";
import { DECK_COVERS, coverOf, publishDeck, getDailyShareQuota } from "@/lib/share-decks";

export const Route = createFileRoute("/share/new")({
  // ?space=<id> builds a deck that lives only inside that classroom or group.
  validateSearch: (search: Record<string, unknown>): { space?: string } => {
    const raw = typeof search.space === "string" ? search.space.trim() : "";
    return {
      space: raw && raw !== "undefined" && raw !== "null" ? raw : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Share your flashcards | RitaJet" },
      {
        name: "description",
        content:
          "Pick the subjects and sub-subjects you want to share and publish them as a flashcard deck other students can study.",
      },
      { property: "og:title", content: "Share your flashcards on RitaJet" },
      {
        property: "og:description",
        content: "Publish your subjects as a deck other students can study and save.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShareNew,
});

const EMOJIS = ["🃏", "🧠", "💊", "🫀", "🦴", "🔬", "📚", "🇩🇪", "⚡️", "🌿"];

/** Stable key for one sub-subject inside the local board. */
const keyOf = (subject: string, sub: string) => `${subject}///${sub}`;

function ShareNew() {
  const { space: spaceId } = Route.useSearch();
  const toSpace = !!spaceId;
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState("apricot");
  const [emoji, setEmoji] = useState("🃏");
  const [tagText, setTagText] = useState("");
  const [saving, setSaving] = useState(false);
  const [board, setBoard] = useState<ReturnType<typeof readBoardWithCounts>>([]);

  const quotaQuery = useQuery({
    queryKey: ["daily-share-quota", user?.id],
    queryFn: () =>
      getDailyShareQuota(user!.id).catch(() => ({
        decksToday: 0,
        questionsToday: 0,
        usedToday: 0,
        limit: 5,
        remaining: 5,
        isBlocked: false,
      })),
    enabled: !!user,
  });
  const quota = quotaQuery.data;

  useEffect(() => {
    try {
      setBoard(readBoardWithCounts() ?? []);
    } catch {
      setBoard([]);
    }
  }, []);

  const total = useMemo(
    () =>
      (board ?? []).reduce(
        (n, s) =>
          n +
          (s.subs ?? []).reduce(
            (m, x) => m + (picked.has(keyOf(s.name, x.name)) ? x.count : 0),
            0,
          ),
        0,
      ),
    [board, picked],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbf5e9]">
        <SiteHeader />
        <div className="mx-auto flex max-w-5xl items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-[#8ec63f]" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#fbf5e9] text-[#23201d]">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-4 py-20 text-center">
          <span className="text-5xl">🃏</span>
          <h1 className="mt-4 font-display text-3xl font-black">Sign in to share flashcards</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#6b655c]">
            Rita saves your decks to your account so students across RitaJet can learn from your work.
          </p>
          <button
            type="button"
            onClick={() => openAuth("signin", "/share/new")}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#8ec63f] px-6 py-3 text-sm font-black text-white shadow-sm transition hover:brightness-105"
          >
            Sign in
          </button>
        </main>
      </div>
    );
  }

  function toggle(keys: string[]) {
    setPicked((prev) => {
      const next = new Set(prev);
      const on = !keys.every((k) => next.has(k));
      for (const k of keys) (on ? next.add(k) : next.delete(k));
      return next;
    });
  }

  async function publish() {
    if (!title.trim()) return toast.error("Give your deck a title");
    setSaving(true);
    try {
      const tags = tagText
        .split(/[,\s]+/)
        .map((t) => t.replace(/^#/, "").trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 6);
      const groups = board.flatMap((s) =>
        s.subs
          .filter((x) => picked.has(keyOf(s.name, x.name)))
          .map((x) => ({
            name: s.subs.length > 1 ? `${s.name} · ${x.name}` : s.name,
            cards: readTopicCards(s.name, x.name).map((c) => ({ front: c.front, back: c.back })),
          })),
      );
      const id = await publishDeck({
        title,
        description,
        cover,
        emoji,
        tags,
        groups,
        spaceId: spaceId ?? null,
      });
      if (spaceId) {
        toast.success("Deck added to your space — only its members can see it.");
        // Drop the space's cached deck/folder lists first, otherwise the page we
        // land on shows the copy it had before this deck existed until a reload.
        await refreshSpace(qc, spaceId);
        navigate({ to: "/spaces/$spaceId", params: { spaceId } });
      } else {
        toast.success("Deck shared with everyone!");
        navigate({ to: "/share/$deckId", params: { deckId: id } });
      }
    } catch (e: any) {
      toast.error(e?.message || "Could not share this deck");
    } finally {
      setSaving(false);
    }
  }

  const c = coverOf(cover);

  return (
    <div className="min-h-screen" style={{ background: "#fbf5e9", color: "#23201d" }}>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-14 md:px-8 md:py-20">
        {toSpace ? (
          <Link
            to="/spaces/$spaceId"
            params={{ spaceId: spaceId! }}
            className="inline-flex items-center gap-1.5 text-sm font-black text-[#6b655c] hover:text-[#23201d]"
          >
            <ArrowLeft size={15} /> Back to your space
          </Link>
        ) : (
          <Link to="/share" className="inline-flex items-center gap-1.5 text-sm font-black text-[#6b655c] hover:text-[#23201d]">
            <ArrowLeft size={15} /> Shared flashcards
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-purple-800">
            🃏 Flashcard Deck
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black ${
              quota?.isBlocked
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            Quota: {quota?.usedToday ?? 0} / 5 shared today ({quota?.remaining ?? 5} left)
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black ${
              toSpace ? "bg-[#eef7e4] text-[#3f6a17]" : "bg-[#fdf0d8] text-[#8a6a1f]"
            }`}
          >
            {toSpace ? "🔒 Space members only" : "🌍 Everyone on RitaJet"}
          </span>
        </div>

        <h1 className="mt-4 font-display text-4xl font-black tracking-tight">
          {toSpace ? "Share flashcard deck with your space" : "Share flashcards with everyone"}
        </h1>
        <p className="mt-2 max-w-xl text-[#6b655c]">
          {toSpace
            ? "Tick the subjects you want to include. Only members of this classroom or group will see this deck."
            : "Tick the subjects or sub-subjects you want to include. A snapshot of front & back cards becomes a deck anyone can flip and study."}
        </p>

        {quota?.isBlocked && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/90 p-4 text-xs font-semibold text-red-800">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <p className="font-bold">Daily sharing limit reached (5/5 items shared today)</p>
              <p className="mt-1 leading-relaxed">
                You have used all 5 sharing slots for today. To share this flashcard deck right now,
                simply delete one of the items you shared today in{" "}
                <Link
                  to="/share"
                  search={{ type: "flashcards" }}
                  className="font-black text-red-900 underline"
                >
                  My Shared Items
                </Link>
                . Deleting an item automatically frees up your slot immediately!
              </p>
            </div>
          </div>
        )}

        {/* Cross-navigation switcher */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/[0.08] bg-white/70 p-3.5 shadow-sm">
          <div className="flex items-center gap-2.5 text-xs text-[#6b655c]">
            <span className="text-xl">❓</span>
            <span>Looking to share Multiple-Choice Exam Questions or Quizzes instead?</span>
          </div>
          <Link
            to="/share/questions/new"
            search={{ space: spaceId, source: "lecture" }}
            className="inline-flex items-center gap-1 text-xs font-black text-[#8ec63f] hover:underline"
          >
            Share Question Set →
          </Link>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-[26px] border border-black/[0.07] bg-white p-6">
            <h2 className="font-display text-lg font-black">Pick subjects</h2>
            {board.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-black/15 bg-[#fbf5e9] p-8 text-center">
                <span className="text-3xl">🃏</span>
                <p className="mt-2 font-display text-base font-black text-[#23201d]">
                  No flashcards found
                </p>
                <p className="mt-1 text-xs text-[#6b655c]">
                  Create subjects and flashcards in your Study Workspace first, or share exam questions.
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                  <Link
                    to="/study"
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#23201d] px-4 py-2 text-xs font-black text-white hover:bg-black"
                  >
                    Open Study Workspace
                  </Link>
                  <Link
                    to="/share/questions/new"
                    className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-black text-[#23201d] hover:bg-black/5"
                  >
                    Share Exam Questions Instead →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
                {board.map((s) => {
                  const keys = s.subs.map((x) => keyOf(s.name, x.name));
                  return (
                    <div key={s.name} className="rounded-2xl border border-black/[0.06]">
                      <Row
                        label={s.name}
                        count={s.count}
                        checked={keys.length > 0 && keys.every((k) => picked.has(k))}
                        onToggle={() => toggle(keys)}
                        bold
                      />
                      {s.subs.map((x) => (
                        <Row
                          key={x.name}
                          label={x.name}
                          count={x.count}
                          checked={picked.has(keyOf(s.name, x.name))}
                          onToggle={() => toggle([keyOf(s.name, x.name)])}
                          indent
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </section>


          <aside className="space-y-5">
            <div
              className="grid h-32 place-items-center rounded-[26px]"
              style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}
            >
              <span className="text-5xl">{emoji}</span>
            </div>

            <div className="space-y-4 rounded-[26px] border border-black/[0.07] bg-white p-6">
              <Field label="Deck title">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Pharmacology — doses"
                  className={input}
                />
              </Field>
              <Field label="Short description">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's inside and who it's for."
                  className={`${input} min-h-[80px]`}
                />
              </Field>
              {!toSpace && (
                <Field label="Tags">
                  <input
                    value={tagText}
                    onChange={(e) => setTagText(e.target.value)}
                    placeholder="pharma, year3, exam"
                    className={input}
                  />
                </Field>
              )}
              <Field label="Cover colour">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(DECK_COVERS).map(([key, v]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setCover(key)}
                      aria-label={key}
                      className={`h-9 w-9 rounded-full transition ${
                        cover === key ? "ring-2 ring-[#23201d] ring-offset-2" : ""
                      }`}
                      style={{ background: `linear-gradient(135deg, ${v.from}, ${v.to})` }}
                    />
                  ))}
                </div>
              </Field>
              <Field label="Emoji">
                <div className="flex flex-wrap gap-1.5">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEmoji(e)}
                      className={`h-9 w-9 rounded-xl text-lg transition ${
                        emoji === e ? "bg-black/[0.08]" : "hover:bg-black/[0.05]"
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </Field>

              <div className="rounded-2xl bg-[#fbf5e9] px-4 py-3 text-[13px] font-bold text-[#4a453d]">
                {picked.size} selected · {total} cards
              </div>
              <button
                onClick={publish}
                disabled={saving || picked.size === 0 || quota?.isBlocked}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-black text-white disabled:opacity-50 ${
                  toSpace ? "bg-[#d94f3d]" : "bg-[#8ec63f]"
                }`}
              >
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                {saving
                  ? "Publishing…"
                  : quota?.isBlocked
                    ? "Daily Limit Reached (5/5)"
                    : toSpace
                      ? "Add to my space"
                      : "Publish for everyone"}
              </button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

const input =
  "w-full rounded-xl border border-black/[0.1] bg-white px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-[#8ec63f]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.15em] text-[#a29a8d]">
        {label}
      </label>
      {children}
    </div>
  );
}

function Row({
  label,
  count,
  checked,
  onToggle,
  bold,
  indent,
}: {
  label: string;
  count: number;
  checked: boolean;
  onToggle: () => void;
  bold?: boolean;
  indent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-black/[0.03] ${
        indent ? "pl-10" : ""
      }`}
    >
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition ${
          checked ? "border-[#8ec63f] bg-[#8ec63f] text-white" : "border-black/20"
        }`}
      >
        {checked && <Check size={13} strokeWidth={3} />}
      </span>
      <span className={`min-w-0 flex-1 truncate text-[14px] ${bold ? "font-black" : "font-semibold"}`}>
        {label}
      </span>
      <span className="text-[12px] font-bold text-[#a29a8d]">{count}</span>
    </button>
  );
}
