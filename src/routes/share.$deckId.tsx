import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookmarkPlus, ChevronLeft, ChevronRight, EyeOff, Layers, Loader2, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { AuthorChip } from "@/components/share/DeckCard";
import { DeckRating } from "@/components/share/DeckRating";
import { useAuth } from "@/hooks/useAuth";
import { coverOf, deleteDeck, fetchDeck, saveDeckToMySubjects, setPublished } from "@/lib/share-decks";

export const Route = createFileRoute("/share/$deckId")({
  head: () => ({
    meta: [
      { title: "Shared flashcard deck | RitaJet" },
      {
        name: "description",
        content:
          "Flip through a flashcard deck shared by another student and save it into your own subjects in one tap.",
      },
      { property: "og:title", content: "A shared flashcard deck on RitaJet" },
      {
        property: "og:description",
        content: "Study this student-made deck and copy it into your own subjects.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DeckPage,
});

function DeckPage() {
  const { deckId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [saving, setSaving] = useState(false);

  const q = useQuery({ queryKey: ["share-deck", deckId], queryFn: () => fetchDeck(deckId) });
  const cards = q.data?.cards ?? [];
  const card = cards[i];
  const c = coverOf(q.data?.deck.cover ?? "apricot");
  const groups = useMemo(
    () => [...new Set(cards.map((x) => x.group_name).filter(Boolean))] as string[],
    [cards],
  );

  function step(d: number) {
    setFlipped(false);
    setI((v) => (v + d + cards.length) % Math.max(cards.length, 1));
  }

  async function save() {
    if (!user) return navigate({ to: "/login" });
    setSaving(true);
    try {
      await saveDeckToMySubjects(deckId, q.data!.deck.title);
      toast.success("Saved into your subjects");
    } catch (e: any) {
      toast.error(e?.message || "Could not save this deck");
    } finally {
      setSaving(false);
    }
  }

  if (q.isLoading) {
    return <Shell><p className="text-[#6b655c]">Loading deck…</p></Shell>;
  }
  if (!q.data) {
    return (
      <Shell>
        <h1 className="font-display text-3xl font-black">Deck not found</h1>
        <Link to="/share" className="mt-4 inline-block font-black text-[#8ec63f]">
          Back to shared flashcards
        </Link>
      </Shell>
    );
  }

  const deck = q.data.deck;
  const isOwner = !!user && deck.owner_id === user.id;

  async function unshare() {
    if (!confirm("Take this deck off the public shelf? You keep the cards in your own subjects.")) return;
    try {
      await setPublished(deck.id, false);
      toast.success("Deck is no longer public");
      void navigate({ to: "/share" });
    } catch (e: any) {
      toast.error(e?.message || "Could not unshare this deck.");
    }
  }

  async function removeForever() {
    if (!confirm("Delete this shared deck for everyone? This cannot be undone.")) return;
    try {
      await deleteDeck(deck.id);
      toast.success("Shared deck deleted");
      void navigate({ to: "/share" });
    } catch (e: any) {
      toast.error(e?.message || "Could not delete this deck.");
    }
  }

  return (
    <Shell>
      <Link to="/share" className="inline-flex items-center gap-1.5 text-sm font-black text-[#6b655c] hover:text-[#23201d]">
        <ArrowLeft size={15} /> Shared flashcards
      </Link>

      <div
        className="mt-6 overflow-hidden rounded-[30px] border border-black/[0.07]"
        style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}
      >
        <div className="flex flex-wrap items-center gap-6 p-8 md:p-10">
          <span className="grid h-20 w-20 place-items-center rounded-3xl bg-white/85 text-4xl">
            {deck.emoji || "🃏"}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-black leading-tight tracking-tight md:text-4xl" style={{ color: c.ink }}>
              {deck.title}
            </h1>
            {deck.description && (
              <p className="mt-2 max-w-xl text-[15px] font-semibold" style={{ color: c.ink, opacity: 0.85 }}>
                {deck.description}
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-full bg-white/80 px-4 py-2 w-fit">
              <AuthorChip author={q.data.author} />
              <span className="inline-flex items-center gap-1 text-[12px] font-black text-[#4a453d]">
                <Layers size={13} /> {deck.card_count} cards
              </span>
              <span className="text-[12px] font-black text-[#4a453d]">{deck.save_count} saves</span>
            </div>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-[#23201d] px-6 py-3.5 text-[15px] font-black text-white disabled:opacity-60"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <BookmarkPlus size={16} />}
            Save to my subjects
          </button>
          {isOwner && (
            <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
              <button
                onClick={unshare}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/85 px-4 py-2.5 text-[13px] font-black text-[#4a453d] hover:bg-white"
              >
                <EyeOff size={14} /> Unshare
              </button>
              <button
                onClick={removeForever}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/85 px-4 py-2.5 text-[13px] font-black text-red-600 hover:bg-white"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {groups.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {groups.map((g) => (
            <span key={g} className="rounded-full bg-white px-3.5 py-1.5 text-[12px] font-black text-[#4a453d]">
              {g}
            </span>
          ))}
        </div>
      )}

      {card && (
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-black">
              <Play size={15} className="mr-1.5 inline" /> Preview
            </h2>
            <span className="text-[13px] font-bold text-[#6b655c]">
              {i + 1} / {cards.length}
            </span>
          </div>

          <button
            onClick={() => setFlipped((f) => !f)}
            className="group mt-4 block w-full [perspective:1400px]"
            aria-label="Flip card"
          >
            <div
              className="relative h-[300px] w-full transition-transform duration-500 [transform-style:preserve-3d]"
              style={{ transform: flipped ? "rotateY(180deg)" : "none" }}
            >
              <Face>{card.front}</Face>
              <Face back tone={c.from}>{card.back}</Face>
            </div>
          </button>

          <div className="mt-5 flex items-center justify-center gap-3">
            <Nav onClick={() => step(-1)} label="Previous card"><ChevronLeft size={18} /></Nav>
            <button
              onClick={() => setFlipped((f) => !f)}
              className="rounded-full bg-[#8ec63f] px-6 py-3 text-sm font-black text-white"
            >
              {flipped ? "Show front" : "Show answer"}
            </button>
            <Nav onClick={() => step(1)} label="Next card"><ChevronRight size={18} /></Nav>
          </div>
        </section>
      )}

      <DeckRating deckId={deckId} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "#fbf5e9", color: "#23201d" }}>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-14 md:px-8 md:py-20">{children}</main>
    </div>
  );
}

function Face({ children, back, tone }: { children: React.ReactNode; back?: boolean; tone?: string }) {
  return (
    <div
      className="absolute inset-0 grid place-items-center overflow-auto rounded-[26px] border border-black/[0.07] p-8 text-center font-display text-2xl font-black leading-snug [backface-visibility:hidden]"
      style={{
        background: back ? tone : "#fff",
        transform: back ? "rotateY(180deg)" : undefined,
      }}
    >
      <span className="whitespace-pre-wrap">{children}</span>
    </div>
  );
}

function Nav({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="grid h-11 w-11 place-items-center rounded-full border border-black/[0.1] bg-white text-[#4a453d] hover:bg-black/[0.04]"
    >
      {children}
    </button>
  );
}
