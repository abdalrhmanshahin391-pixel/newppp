import { LanguageGate } from "@/components/language/LanguageGate";
import { LanguageScopeNote } from "@/components/language/LanguageScopeNote";
import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  BookOpen,
  FolderPlus,
  GraduationCap,
  Layers,
  ListPlus,
  Pencil,
  Plus,
  PlusSquare,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { type RailItem } from "@/components/study/StudyLayout";
import { PickerBoard, type PickerGroup } from "@/components/common/PickerBoard";
import { type SessionScope } from "@/components/study/SessionStarter";
import { CardImportSheet } from "@/components/study/CardImportSheet";
import { useCardFlags } from "@/lib/use-card-flags";
import { RitaCube } from "@/components/rita-study/RitaCube";
import "@/components/study/flashcards-page.css";
import { FlashCardOverlay } from "@/components/study/FlashCardOverlay";
import { StudyPlayer } from "@/components/study/StudyPlayer";
import { Flag } from "lucide-react";
import {
  useFlashcards,
  useCardsVersion,
  countCards,
  readCards,
  type FlashCardItem,
} from "@/lib/use-flashcards";
import {
  AddSubSubjectDialog,
  AddSubjectDialog,
  EditItemDialog,
  RemoveDialog,
} from "@/components/study/StudyDialogs";
import { useStudySubjects } from "@/lib/use-study-subjects";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useAuth } from "@/hooks/useAuth";

const ACCENT = "#b26b00";

export const Route = createFileRoute("/study/")({
  head: () => ({
    meta: [
      { title: "Flashcards — Uzyra study workspace" },
      {
        name: "description",
        content:
          "Build subjects, fill them with your own flashcards and study any combination of them in one session.",
      },
      { property: "og:title", content: "Flashcards — Uzyra study workspace" },
      {
        property: "og:description",
        content: "Your subjects, your cards, one calm place to study them.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <LanguageGate>
      <StudyBoard />
    </LanguageGate>
  ),
});

/** Keys look like "2:0" — subject index, sub-subject index. */
const keyOf = (si: number, sj: number) => `${si}:${sj}`;
const parseKey = (key: string) => {
  const [a, b] = key.split(":");
  return { si: Number(a), sj: Number(b) };
};

function StudyBoard() {
  const board = useStudySubjects();
  const siteSettings = useSiteSettings();
  const { isRealAdmin } = useAuth();
  const aiCardsAllowed = siteSettings.feature_ai_cards_enabled || isRealAdmin;
  const version = useCardsVersion();
  const [mode, setMode] = useState<"study" | "edit">("study");
  const [selected, setSelected] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addSubOpen, setAddSubOpen] = useState(false);
  const [addSubParent, setAddSubParent] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<{ si: number; sj?: number } | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ si: number; sj?: number } | null>(null);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [sessionScope, setSessionScope] = useState<SessionScope>("all");
  const flags = useCardFlags();
  const [cardsMode, setCardsMode] = useState<"create" | "gallery">("create");
  const [playing, setPlaying] = useState<{ title: string; cards: FlashCardItem[] } | null>(null);
  const levels = useRef({ input: 0, output: 0 });

  /** Everything that is ticked, resolved to real names. */
  const picked = useMemo(() => {
    return selected
      .map((k) => {
        const { si, sj } = parseKey(k);
        const subject = board.subjects[si];
        const sub = subject?.subs[sj];
        if (!subject || !sub) return null;
        return { key: k, si, sj, subject: subject.name, sub: sub.name };
      })
      .filter(Boolean) as { key: string; si: number; sj: number; subject: string; sub: string }[];
  }, [selected, board.subjects]);

  /** The sub-subject that "add cards" acts on — the last one you ticked. */
  const target = picked[picked.length - 1] ?? null;
  const flash = useFlashcards(target?.subject || "general", target?.sub || "cards");
  const topicLabel = target ? `${target.subject} · ${target.sub}` : "No topic selected";

  const groups: PickerGroup[] = useMemo(() => {
    void version;
    return board.subjects.map((s, si) => {
      const items = s.subs.map((x, sj) => ({
        id: keyOf(si, sj),
        name: x.name,
        count: countCards(s.name, x.name),
      }));
      return {
        id: String(si),
        name: s.name,
        color: ACCENT,
        count: items.reduce((n, i) => n + (i.count ?? 0), 0),
        items,
      };
    });
  }, [board.subjects, version]);

  /** Cards + label for whatever is ticked (or the whole board when nothing is). */
  const scope = useMemo(() => {
    void version;
    if (picked.length > 0) {
      const cards = picked.flatMap((p) => readCards(p.subject, p.sub));
      const subjects = new Set(picked.map((p) => p.subject));
      const label =
        picked.length === 1
          ? `${picked[0]!.subject} · ${picked[0]!.sub}`
          : `${picked.length} sub-subjects · ${subjects.size} subject${subjects.size === 1 ? "" : "s"}`;
      return { label, cards };
    }
    return {
      label: "your whole board",
      cards: board.subjects.flatMap((s) => s.subs.flatMap((x) => readCards(s.name, x.name))),
    };
  }, [picked, board.subjects, version]);

  const nameOf = (sel: { si: number; sj?: number } | null) => {
    if (!sel) return "";
    const subject = board.subjects[sel.si];
    if (!subject) return "";
    return sel.sj === undefined ? subject.name : (subject.subs[sel.sj]?.name ?? "");
  };

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const openAddSub = (si: number) => {
    setAddSubParent(si);
    setAddSubOpen(true);
  };
  const openCards = (next: "create" | "gallery") => {
    if (!target) {
      toast.info("Tick a sub-subject first — that is where the cards live");
      return;
    }
    setCardsMode(next);
    setCardsOpen(true);
  };

  const flaggedCards = useMemo(
    () => scope.cards.filter((c) => flags.ids.has(c.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scope.cards, flags.flags],
  );

  const sessionCards = sessionScope === "flagged" ? flaggedCards : scope.cards;

  const startSession = () => {
    if (sessionCards.length === 0) {
      toast.info(
        sessionScope === "flagged"
          ? "Nothing is flagged in here yet — raise a flag while you study"
          : "Add some flashcards first",
      );
      return;
    }
    setPlaying({
      title: sessionScope === "flagged" ? `${scope.label} · flagged` : scope.label,
      cards: sessionCards,
    });
  };

  const studyRail: RailItem[] = [
    {
      label: "Add subject",
      hint: "New",
      icon: <FolderPlus size={17} />,
      tone: "apricot",
      onClick: () => setAddOpen(true),
    },
    {
      label: "Add sub-subject",
      hint: "Nest",
      icon: <ListPlus size={17} />,
      tone: "sky",
      onClick: () => {
        if (board.subjects.length === 0) {
          toast.info("Add a subject first");
          return;
        }
        openAddSub(target ? target.si : 0);
      },
    },
    {
      label: "Remove",
      hint: "Delete",
      icon: <Trash2 size={17} />,
      tone: "clay",
      onClick: () => {
        if (!target) {
          toast.info("Tick a sub-subject to remove");
          return;
        }
        setRemoveTarget({ si: target.si, sj: target.sj });
        setRemoveOpen(true);
      },
    },
    {
      label: "Edit",
      hint: "Rename",
      icon: <Pencil size={17} />,
      tone: "lilac",
      onClick: () => {
        if (!target) {
          toast.info("Tick a sub-subject to rename");
          return;
        }
        setEditTarget({ si: target.si, sj: target.sj });
        setEditOpen(true);
      },
    },
  ];

  const editRail: RailItem[] = [
    {
      label: "Add flashcards",
      hint: target ? target.sub : "Tick a sub-subject",
      icon: <PlusSquare size={17} />,
      tone: "mint",
      disabled: !target,
      onClick: () => openCards("create"),
    },
    {
      label: "View flashcards",
      hint: target ? `${flash.cards.length} cards` : "Tick a sub-subject",
      icon: <Layers size={17} />,
      tone: "lilac",
      disabled: !target,
      onClick: () => openCards("gallery"),
    },
    ...(aiCardsAllowed
      ? [
          {
            label: "Make cards from material",
            hint: target ? "PDF · text · photos" : "Tick a sub-subject",
            icon: <Sparkles size={17} />,
            tone: "clay" as const,
            disabled: !target,
            onClick: () => {
              if (!target) {
                toast.info("Tick a sub-subject first — that is where the cards land");
                return;
              }
              setImportOpen(true);
            },
          },
        ]
      : []),

    {
      label: "Add sub-subject",
      hint: "Nest",
      icon: <ListPlus size={17} />,
      tone: "sky",
      onClick: () => {
        if (board.subjects.length === 0) {
          toast.info("Add a subject first");
          return;
        }
        openAddSub(target ? target.si : 0);
      },
    },
    {
      label: "Edit",
      hint: "Rename",
      icon: <Pencil size={17} />,
      tone: "apricot",
      onClick: () => {
        if (!target) {
          toast.info("Tick a sub-subject to rename");
          return;
        }
        setEditTarget({ si: target.si, sj: target.sj });
        setEditOpen(true);
      },
    },
  ];

  const rail = mode === "study" ? studyRail : editRail;
  const count = sessionCards.length;
  const cardsWord = `card${count === 1 ? "" : "s"}`;

  return (
    <div className="fc-page min-h-screen bg-white text-[var(--pp-ink)]">
      <SiteHeader />
      <div className="fc-wrap">
        <header className="fc-head">
          <p className="fc-kicker">
            <span className="fc-cube" aria-hidden="true">
              <RitaCube levelsRef={levels} mode="idle" label="" />
            </span>
            Flashcards
          </p>
          <h1 className="fc-title">Your flashcards.</h1>
          <p className="fc-lead">Make subjects, add cards, then study them.</p>
        </header>

        <div className="fc-toolbar">
          <div className="fc-switch" role="group" aria-label="Mode">
            {(
              [
                ["study", "Study", BookOpen],
                ["edit", "Edit", SlidersHorizontal],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                aria-pressed={mode === key}
                onClick={() => setMode(key)}
              >
                <Icon size={16} aria-hidden="true" /> {label}
              </button>
            ))}
          </div>
          <div className="fc-tools">
            {rail.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`fc-tool${item.label === "Remove" ? " is-danger" : ""}`}
                aria-disabled={item.disabled || undefined}
                title={item.hint}
                onClick={item.onClick}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="fc-grid">
          <aside className="fc-side">
            <section className="fc-session" aria-label="Start a session">
              <p className="fc-eyebrow">Start a session</p>
              <p className="fc-stat">
                <b>{count}</b> {cardsWord} ready
              </p>
              <dl className="fc-rows">
                <div>
                  <dt>From</dt>
                  <dd>{scope.label}</dd>
                </div>
                <div>
                  <dt>Flagged</dt>
                  <dd>{flaggedCards.length}</dd>
                </div>
              </dl>
              <div className="fc-scope" role="group" aria-label="Which cards">
                {(["all", "flagged"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={sessionScope === key}
                    onClick={() => setSessionScope(key)}
                  >
                    {key === "all" ? (
                      picked.length > 0 ? (
                        "All ticked"
                      ) : (
                        "All cards"
                      )
                    ) : (
                      <>
                        <Flag size={14} aria-hidden="true" /> Flagged
                        {flaggedCards.length > 0 ? ` ${flaggedCards.length}` : ""}
                      </>
                    )}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="fc-go"
                aria-disabled={count === 0 || undefined}
                onClick={startSession}
              >
                <GraduationCap size={18} aria-hidden="true" />
                {count > 0 ? `Study · ${count} ${cardsWord}` : "Study"}
              </button>
              {picked.length > 0 && (
                <div className="fc-picked">
                  <div className="fc-picked-list">
                    {picked.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => toggle(p.key)}
                        aria-label={`Untick ${p.sub}`}
                      >
                        {p.sub} <X size={12} aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                  <button type="button" className="fc-clear" onClick={() => setSelected([])}>
                    Clear selection
                  </button>
                </div>
              )}
              <p className="fc-note">
                {picked.length === 0
                  ? "Using your whole board. Tick sub-subjects to study only those."
                  : "Studying only what you ticked."}
              </p>
            </section>
          </aside>

          <main className="fc-main">
            <LanguageScopeNote />
            {board.subjects.length === 0 ? (
              <div className="fc-empty">
                <span className="fc-empty-cube" aria-hidden="true">
                  <RitaCube levelsRef={levels} mode="idle" label="" />
                </span>
                <h2>No subjects yet</h2>
                <p>A subject holds sub-subjects, and each sub-subject holds its own cards.</p>
                <button type="button" className="fc-go" onClick={() => setAddOpen(true)}>
                  <Plus size={18} aria-hidden="true" /> Make your first subject
                </button>
              </div>
            ) : (
              <PickerBoard
                framed={false}
                accent={ACCENT}
                groups={groups}
                selected={selected}
                onToggle={toggle}
                unitNoun="cards"
                searchPlaceholder="Search subjects and sub-subjects…"
                addLabel="Cards"
                onNewGroup={() => setAddOpen(true)}
                onNewItem={(g) => openAddSub(Number(g.id))}
                onAddContent={(item) => {
                  if (!selected.includes(item.id)) setSelected((s) => [...s, item.id]);
                  setCardsMode("create");
                  setTimeout(() => setCardsOpen(true), 0);
                }}
                onDeleteGroup={(g) => {
                  setRemoveTarget({ si: Number(g.id) });
                  setRemoveOpen(true);
                }}
                onDeleteItem={(item) => {
                  setRemoveTarget(parseKey(item.id));
                  setRemoveOpen(true);
                }}
                emptyHint="No subjects yet — tap New to make your first one."
              />
            )}
          </main>
        </div>
      </div>

      <FlashCardOverlay
        open={cardsOpen && !!target}
        mode={cardsMode}
        topicLabel={topicLabel}
        cards={flash.cards}
        onAdd={flash.addCard}
        onUpdate={flash.updateCard}
        onDelete={flash.deleteCard}
        onClose={() => setCardsOpen(false)}
      />

      <CardImportSheet
        open={importOpen && !!target}
        topicLabel={topicLabel}
        onClose={() => setImportOpen(false)}
        onAdd={(drafts) => {
          for (const d of drafts) flash.addCard(d.front, d.back);
        }}
      />

      <StudyPlayer
        open={!!playing}
        title={playing?.title ?? ""}
        cards={playing?.cards ?? []}
        onClose={() => setPlaying(null)}
      />

      <AddSubjectDialog open={addOpen} onOpenChange={setAddOpen} onAdd={board.addSubject} />
      <AddSubSubjectDialog
        open={addSubOpen}
        onOpenChange={setAddSubOpen}
        subjects={board.subjects}
        defaultParent={addSubParent}
        onAdd={board.addSub}
      />
      <EditItemDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        isSub={editTarget?.sj !== undefined}
        initialName={nameOf(editTarget)}
        onSave={(name) => {
          if (!editTarget) return;
          if (editTarget.sj === undefined) board.renameSubject(editTarget.si, name);
          else board.updateSub(editTarget.si, editTarget.sj, name);
          toast.success("Changes saved");
        }}
      />
      <RemoveDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        isSub={removeTarget?.sj !== undefined}
        name={nameOf(removeTarget)}
        onConfirm={() => {
          if (!removeTarget) return;
          if (removeTarget.sj === undefined) board.removeSubject(removeTarget.si);
          else board.removeSub(removeTarget.si, removeTarget.sj);
          setSelected([]);
          toast.success("Removed");
        }}
      />
    </div>
  );
}
