import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowRight, Blocks, Check, Layers, Loader2, Mic, Plus, Shapes, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { WorkspaceHeader } from "@/components/common/LaunchPanel";
import { PromptDialog } from "@/components/study/SimpleDialogs";
import { useDeTree } from "@/lib/use-de-lab";
import { canBuild, parseBulk } from "@/lib/de-lab";
import { createCards, createSubject as createFlashSubject, fetchSubjects } from "@/lib/flashcards";
import { useAuth } from "@/hooks/useAuth";

const ACCENT = "#2f9e63";

export const Route = createFileRoute("/german/add")({
  head: () => ({
    meta: [
      { title: "One Place — add German words once, play every mode | RitaJet" },
      {
        name: "description",
        content:
          "Type a German word or sentence once, drop it in one sub-subject, and it shows up in der/die/das, pronunciation, the build game and your flashcards.",
      },
      { property: "og:title", content: "One Place — add German once, play everywhere" },
      {
        property: "og:description",
        content: "One shelf for every German mode: articles, pronunciation, build game and flashcards.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OnePlace,
});

function OnePlace() {
  const { user, loading, isRealAdmin: isAdmin } = useAuth();
  const tree = useDeTree("speaking");
  const [text, setText] = useState("");
  const [subtopicId, setSubtopicId] = useState("");
  const [alsoFlash, setAlsoFlash] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [subtopicFor, setSubtopicFor] = useState<string | null>(null);

  /** One shared parse: nouns keep der/die/das, sentences stay sentences. */
  const rows = useMemo(() => parseBulk(text), [text]);

  const counts = {
    articles: rows.filter((r) => r.article).length,
    speak: rows.length,
    build: rows.filter((r) => canBuild(r)).length,
    flash: rows.filter((r) => r.english).length,
  };

  const chosen = tree.subjects.flatMap((s) => s.subtopics.map((t) => ({ ...t, subject: s.name }))).find((t) => t.id === subtopicId);

  const save = async () => {
    if (!subtopicId) return toast.error("Choose one sub-subject first — that's its home.");
    if (!rows.length) return toast.error("Nothing to add yet.");
    setSaving(true);
    try {
      await tree.addItems({ subtopicId, items: rows });
      if (alsoFlash) {
        const deckName = `German · ${chosen?.name ?? "Words"}`;
        let subjects = await fetchSubjects();
        let deck = subjects.find((s) => s.name === deckName);
        if (!deck) {
          await createFlashSubject({ name: deckName, color: "mint", emoji: "🇩🇪", parent_id: null });
          subjects = await fetchSubjects();
          deck = subjects.find((s) => s.name === deckName);
        }
        if (deck) {
          await createCards(
            deck.id,
            rows.map((r) => ({
              front: r.article ? `${r.article} ${r.german}` : r.german,
              back: r.english ?? "—",
            })),
          );
        }
      }
      toast.success(`${rows.length} saved to “${chosen?.name}” — ready in every German mode.`);
      setText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  if (!loading && !isAdmin) {
    return (
      <div className="min-h-screen" style={{ background: "#fbf5e9", color: "#23201d" }}>
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-4 py-20 text-center">
          <h1 className="font-display text-[26px] font-black">This page is being prepared</h1>
          <p className="mt-3 text-[15px] font-semibold text-[#6b645b]">
            One Place is not open yet. Meanwhile you can train in the Article, Pronunciation and Build labs.
          </p>
          <Link
            to="/german"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#23201d] px-6 py-3 text-[15px] font-black text-white"
          >
            Back to German Lab <ArrowRight size={16} />
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#fbf5e9", color: "#23201d" }}>
      <SiteHeader />
      <main className="mx-auto max-w-[76rem] px-4 py-8 md:px-8 md:py-10">
        <WorkspaceHeader
          back={
            <Link to="/german" className="text-[13px] font-extrabold text-[#6b645b] hover:text-[#23201d]">
              ← German Lab
            </Link>
          }
          eyebrow="German · one place"
          title="Add once. Play everywhere."
          description={
            <>
              Type a word or a whole sentence, give it <b>one home</b>, and it appears in der/die/das,
              pronunciation, the build game and — if you want — your flashcards. Nothing gets scattered.
            </>
          }
          stats={[
            { label: "Subjects", value: tree.subjects.length },
            { label: "Lines ready", value: rows.length },
            { label: "Home", value: chosen ? 1 : 0 },
          ]}
        />

        {loading ? null : !user ? (
          <p className="mt-8 rounded-2xl bg-white p-6 text-[15px] font-bold">
            <Link to="/login" className="underline">
              Sign in
            </Link>{" "}
            to build your German shelf.
          </p>
        ) : (
          <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
            {/* LEFT — type once */}
            <section className="rounded-[26px] border border-black/[0.07] bg-white p-5 md:p-6">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#b3aa9c]">Step 1 · Write it</p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={9}
                spellCheck={false}
                placeholder={"die Nacht = the night\nGuten Morgen = good morning\nIch hätte gern einen Kaffee. = I would like a coffee."}
                className="mt-3 w-full resize-y rounded-2xl border border-black/[0.08] bg-[#fcf8f1] p-4 text-[16px] font-semibold leading-relaxed outline-none focus:border-[#2f9e63]"
              />
              <p className="mt-2 text-[12.5px] font-bold text-[#8a8175]">
                One per line. Keep the article (der/die/das) and add the meaning after <b>=</b>.
              </p>

              <p className="mt-6 text-[11px] font-black uppercase tracking-[0.18em] text-[#b3aa9c]">
                Step 2 · Where it lives
              </p>
              <div className="mt-3 space-y-2">
                {tree.subjects.length === 0 && (
                  <p className="rounded-2xl bg-[#fcf8f1] p-4 text-[14px] font-bold text-[#8a8175]">
                    No subjects yet — make your first one.
                  </p>
                )}
                {tree.subjects.map((s, i) => (
                  <div key={s.id} className="rounded-2xl border border-black/[0.07] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 text-[11px] font-black tabular-nums text-[#b3aa9c]">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="text-[15px] font-black">{s.name}</span>
                        <span className="text-[12px] font-bold text-[#a89e90]">{s.items} items</span>
                      </div>
                      <button
                        onClick={() => setSubtopicFor(s.id)}
                        className="inline-flex items-center gap-1 rounded-full border border-black/[0.08] px-3 py-1 text-[12px] font-extrabold text-[#6b645b] hover:bg-[#f7f2e8]"
                      >
                        <Plus size={13} /> Sub-subject
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 pl-8">
                      {s.subtopics.map((t) => {
                        const on = t.id === subtopicId;
                        return (
                          <button
                            key={t.id}
                            onClick={() => setSubtopicId(t.id)}
                            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13.5px] font-extrabold transition"
                            style={{
                              background: on ? ACCENT : "#f3ece0",
                              color: on ? "#fff" : "#5a4a2e",
                            }}
                          >
                            {on && <Check size={14} />}
                            {t.name}
                            <span className="opacity-60">{t.items}</span>
                          </button>
                        );
                      })}
                      {s.subtopics.length === 0 && (
                        <span className="text-[13px] font-bold text-[#a89e90]">No sub-subjects yet.</span>
                      )}
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setSubjectOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] px-4 py-2 text-[13px] font-extrabold text-[#6b645b] hover:bg-[#f7f2e8]"
                >
                  <Plus size={14} /> New subject
                </button>
              </div>
            </section>

            {/* RIGHT — where it goes */}
            <aside className="lg:sticky lg:top-6">
              <div className="rounded-[26px] border border-black/[0.07] bg-white p-5 shadow-[0_20px_50px_-34px_rgba(0,0,0,0.4)]">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#b3aa9c]">
                  Step 3 · It lands here
                </p>
                <div className="mt-3 space-y-2">
                  <Dest icon={<Shapes size={15} />} color="#2f6fd0" name="Article Lab" n={counts.articles} unit="nouns with der/die/das" />
                  <Dest icon={<Mic size={15} />} color="#e0774f" name="Pronunciation Lab" n={counts.speak} unit="lines to speak" />
                  <Dest icon={<Blocks size={15} />} color="#7a5cc4" name="Build Lab" n={counts.build} unit="to put in order" />
                  <button
                    onClick={() => setAlsoFlash((v) => !v)}
                    className="flex w-full items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-left transition"
                    style={{
                      borderColor: alsoFlash ? "#7fcaa5" : "rgba(0,0,0,0.07)",
                      background: alsoFlash ? "#e0f2ea" : "#fff",
                    }}
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: "#d9f2e3", color: "#2f9e63" }}>
                      <Layers size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-black">Flashcards</span>
                      <span className="block text-[12px] font-bold text-[#8a8175]">
                        {alsoFlash ? `${counts.flash} cards will be made` : "Off — tap to also make cards"}
                      </span>
                    </span>
                    {alsoFlash && <Check size={16} style={{ color: "#2f9e63" }} />}
                  </button>
                </div>

                <button
                  disabled={saving || !rows.length || !subtopicId}
                  onClick={() => void save()}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-[15px] font-extrabold text-white transition active:scale-[0.98] disabled:opacity-40"
                  style={{ background: ACCENT, boxShadow: "0 14px 30px -18px rgba(47,158,99,0.9)" }}
                >
                  {saving ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                  Send to every mode
                </button>
                <p className="mt-2 text-center text-[12.5px] font-bold text-[#8a8175]">
                  {!subtopicId ? "Pick one home above." : `Home: ${chosen?.subject} › ${chosen?.name}`}
                </p>

                <div className="mt-4 border-t border-black/[0.06] pt-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#b3aa9c]">Play now</p>
                  <div className="mt-2 space-y-1.5">
                    {[
                      { to: "/german/articles", label: "der · die · das" },
                      { to: "/german/speak", label: "Pronunciation" },
                      { to: "/german/build", label: "Build it" },
                    ].map((l) => (
                      <Link
                        key={l.to}
                        to={l.to}
                        className="flex items-center justify-between rounded-xl bg-[#f7f2e8] px-3.5 py-2.5 text-[13.5px] font-extrabold hover:bg-[#f0e9dc]"
                      >
                        {l.label}
                        <ArrowRight size={15} />
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>

      <PromptDialog
        open={subjectOpen}
        onOpenChange={setSubjectOpen}
        title="New German subject"
        description="A big area. Sub-subjects live inside it."
        label="Subject name"
        confirmLabel="Add subject"
        onSubmit={(v) => void tree.createSubject({ name: v, color: ACCENT })}
      />
      <PromptDialog
        open={!!subtopicFor}
        onOpenChange={(v) => !v && setSubtopicFor(null)}
        title="New sub-subject"
        label="Sub-subject name"
        confirmLabel="Add sub-subject"
        onSubmit={(v) => {
          if (subtopicFor) void tree.createSubtopic({ subjectId: subtopicFor, name: v });
          setSubtopicFor(null);
        }}
      />
    </div>
  );
}

function Dest({
  icon,
  color,
  name,
  n,
  unit,
}: {
  icon: React.ReactNode;
  color: string;
  name: string;
  n: number;
  unit: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-black/[0.07] px-3.5 py-2.5">
      <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: `${color}1a`, color }}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-black">{name}</span>
        <span className="block text-[12px] font-bold text-[#8a8175]">
          {n} {unit}
        </span>
      </span>
    </div>
  );
}
