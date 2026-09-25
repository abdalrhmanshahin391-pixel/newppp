import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  FolderPlus,
  GraduationCap,
  Layers,
  ListPlus,
  Pencil,
  PlusSquare,
  Shuffle,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { StudyLayout, type RailItem } from "@/components/study/StudyLayout";
import { PickerBoard, type PickerGroup } from "@/components/common/PickerBoard";
import { LaunchPanel } from "@/components/common/LaunchPanel";
import { type SessionScope } from "@/components/study/SessionStarter";
import { CardImportSheet } from "@/components/study/CardImportSheet";
import { useCardFlags } from "@/lib/use-card-flags";
import { DailyPanel } from "@/components/study/DailyPanel";
import { ReviewSession } from "@/components/study/ReviewSession";
import { useReviewQueue } from "@/lib/use-review";
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

const ACCENT = "#c9762a";

export const Route = createFileRoute("/study/")({
  head: () => ({
    meta: [
      { title: "Flashcards — RitaJet study workspace" },
      {
        name: "description",
        content:
          "Build subjects, fill them with your own flashcards and study any combination of them in one session.",
      },
      { property: "og:title", content: "Flashcards — RitaJet study workspace" },
      {
        property: "og:description",
        content: "Your subjects, your cards, one calm place to study them.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudyBoard,
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
  const review = useReviewQueue();
  const [reviewItems, setReviewItems] = useState<ReturnType<typeof useReviewQueue>["queue"] | null>(null);
  const [reviewTitle, setReviewTitle] = useState("Smart review");


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

  /** The spaced-repetition queue narrowed to whatever is ticked. */
  const scopedQueue = useMemo(() => {
    if (picked.length === 0) return review.queue;
    const keys = new Set(picked.map((p) => `${p.subject}||${p.sub}`));
    return review.queue.filter((i) => keys.has(`${i.row.subject}||${i.row.sub_subject}`));
  }, [review.queue, picked]);

  const startSmartReview = () => {
    if (scopedQueue.length === 0) {
      toast.info(
        picked.length === 0
          ? "Nothing is due right now — add cards or come back tomorrow"
          : "Nothing due in what you ticked — try Study mode to practise it now",
      );
      return;
    }
    setReviewTitle(picked.length === 0 ? "Smart review · everything" : `Smart review · ${scope.label}`);
    setReviewItems(scopedQueue);
  };

  const startSession = (shuffle: boolean) => {

    if (sessionCards.length === 0) {
      toast.info(
        sessionScope === "flagged"
          ? "Nothing is flagged in here yet — raise a flag while you study"
          : "Add some flashcards first",
      );
      return;
    }
    const list = shuffle ? [...sessionCards].sort(() => Math.random() - 0.5) : sessionCards;
    setPlaying({
      title: sessionScope === "flagged" ? `${scope.label} · flagged` : scope.label,
      cards: list,
    });
  };

  const studyRail: RailItem[] = [
    {
      label: "Add subject",
      hint: "New",
      icon: <FolderPlus size={20} />,
      tone: "apricot",
      onClick: () => setAddOpen(true),
    },
    {
      label: "Add sub-subject",
      hint: "Nest",
      icon: <ListPlus size={20} />,
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
      icon: <Trash2 size={20} />,
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
      icon: <Pencil size={20} />,
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
      icon: <PlusSquare size={20} />,
      tone: "mint",
      disabled: !target,
      onClick: () => openCards("create"),
    },
    {
      label: "View flashcards",
      hint: target ? `${flash.cards.length} cards` : "Tick a sub-subject",
      icon: <Layers size={20} />,
      tone: "lilac",
      disabled: !target,
      onClick: () => openCards("gallery"),
    },
    ...(aiCardsAllowed
      ? [
          {
            label: "Make cards from material",
            hint: target ? "PDF · text · photos" : "Tick a sub-subject",
            icon: <Sparkles size={20} />,
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
      icon: <ListPlus size={20} />,
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
      icon: <Pencil size={20} />,
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

  return (
    <StudyLayout
      rail={mode === "study" ? studyRail : editRail}
      activeMode={mode}
      onModeChange={(m) => setMode(m)}
    >
      <div className="grid min-h-[62vh] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div data-tour="subject-shelf" className="min-w-0">
          <PickerBoard
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
        </div>

        <div data-tour="launch-panel" className="grid gap-4 lg:sticky lg:top-4 lg:self-start">
          <div data-tour="start-session">
            <LaunchPanel
              accent={ACCENT}
              stat={sessionCards.length}
              statLabel={`card${sessionCards.length === 1 ? "" : "s"} ready`}
              rows={[
                { label: "From", value: scope.label },
                { label: "Due now", value: String(scopedQueue.length) },
                { label: "Flagged", value: String(flaggedCards.length) },
              ]}
              actions={[
                {
                  label: "Study mode",
                  icon: <GraduationCap size={16} />,
                  onClick: () => startSession(false),
                  disabled: sessionCards.length === 0,
                  tone: "outline",
                },
                {
                  label: "Shuffle and study",
                  icon: <Shuffle size={15} />,
                  onClick: () => startSession(true),
                  disabled: sessionCards.length === 0,
                  tone: "outline",
                },
                {
                  label: `Smart review${scopedQueue.length ? ` · ${scopedQueue.length}` : ""}`,
                  icon: <Sparkles size={16} />,
                  onClick: startSmartReview,
                  disabled: review.isLoading,
                  tone: "solid",
                },
              ]}
              footnote={
                picked.length === 0
                  ? "Smart review uses the schedule; Study mode is a free practice run."
                  : "Tick as many sub-subjects as you like — Smart review only shows what is due in them."
              }
            >
              <div className="flex gap-1.5 rounded-xl bg-[#faf6ee] p-1">
                <button
                  type="button"
                  onClick={() => setSessionScope("all")}
                  className="h-8 flex-1 rounded-lg text-[12px] font-extrabold transition-colors"
                  style={
                    sessionScope === "all" ? { background: "#fff", color: "#23201d" } : { color: "#a29a8d" }
                  }
                >
                  All ticked
                </button>
                <button
                  type="button"
                  onClick={() => setSessionScope("flagged")}
                  className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg text-[12px] font-extrabold transition-colors"
                  style={
                    sessionScope === "flagged"
                      ? { background: "#f6ddd5", color: "#7d3421" }
                      : { color: "#a29a8d" }
                  }
                >
                  <Flag size={12} /> Flagged {flaggedCards.length > 0 ? flaggedCards.length : ""}
                </button>
              </div>

              {picked.length > 0 && (
                <div className="mt-3">
                  <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                    {picked.map((p) => (
                      <button
                        key={p.key}
                        onClick={() => toggle(p.key)}
                        className="inline-flex items-center gap-1 rounded-full bg-[#f3ece0] px-2.5 py-1 text-[12px] font-extrabold text-[#5a4a2e] hover:bg-[#e9dfcd]"
                      >
                        {p.sub} <X size={12} />
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setSelected([])}
                    className="mt-2 text-[12px] font-extrabold text-[#a89e90] hover:text-[#b13636]"
                  >
                    Clear selection
                  </button>
                </div>
              )}
            </LaunchPanel>
          </div>

          <div data-tour="daily-schedule">
            <DailyPanel onReview={(items) => setReviewItems(items)} />
          </div>
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

      <ReviewSession
        open={!!reviewItems}
        title={reviewTitle}
        items={reviewItems ?? []}

        onClose={() => {
          setReviewItems(null);
          review.refresh();
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
    </StudyLayout>
  );
}
