import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Brain, FolderPlus, ListPlus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { StudyLayout, type RailItem } from "@/components/study/StudyLayout";
import { SubjectBoard } from "@/components/study/SubjectBoard";
import {
  AddSubSubjectDialog,
  AddSubjectDialog,
  EditItemDialog,
  RemoveDialog,
} from "@/components/study/StudyDialogs";
import { PairCreator } from "@/components/study/memory/PairCreator";
import { GameSetup } from "@/components/study/memory/GameSetup";
import { GameOverlay } from "@/components/study/memory/GameOverlay";
import { useStudySubjects, type Selection } from "@/lib/use-study-subjects";
import {
  bumpMisses,
  collectPairs,
  countPairs,
  readPairs,
  usePairsVersion,
  type MemoryPair,
} from "@/lib/use-memory-pairs";
import { isMuted, setMuted, type GameMode } from "@/lib/memory-game";

const MEMORY_SUBJECTS_KEY = "rita_memory_subjects";

export const Route = createFileRoute("/study/match")({
  head: () => ({
    meta: [
      { title: "Memory Lab — RitaJet matching games" },
      {
        name: "description",
        content:
          "Beat the facts that will not stick: build pairs like drug and dose, then play matching, speed, recall and sequence rounds.",
      },
      { property: "og:title", content: "Memory Lab — RitaJet matching games" },
      {
        property: "og:description",
        content: "Turn hard facts into fast matching games and drill the ones you keep missing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MemoryWorkspace,
});

function MemoryWorkspace() {
  const board = useStudySubjects(MEMORY_SUBJECTS_KEY);
  const [mode, setMode] = useState<"study" | "edit">("study");
  const [selection, setSelection] = useState<Selection>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addSubOpen, setAddSubOpen] = useState(false);
  const [addSubParent, setAddSubParent] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Selection>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Selection>(null);
  const [game, setGame] = useState<GameMode>("match");
  const [suddenDeath, setSuddenDeath] = useState(false);
  const [timed, setTimed] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [playing, setPlaying] = useState(false);
  const version = usePairsVersion();

  useEffect(() => {
    setMutedState(isMuted());
  }, []);

  const scope = useMemo(() => {
    if (!selection) return { subject: null as string | null, subtopic: null as string | null };
    const subject = board.subjects[selection.si];
    if (!subject) return { subject: null, subtopic: null };
    return {
      subject: subject.name,
      subtopic: selection.kind === "sub" ? (subject.subs[selection.sj]?.name ?? null) : null,
    };
  }, [selection, board.subjects]);

  const pairs = useMemo(() => {
    void version;
    if (!scope.subject) return [] as MemoryPair[];
    if (scope.subtopic) return readPairs(scope.subject, scope.subtopic);
    const subject = board.subjects.find((s) => s.name === scope.subject);
    return collectPairs(
      scope.subject,
      (subject?.subs ?? []).map((s) => s.name),
    );
  }, [scope, board.subjects, version]);

  const scopeLabel = scope.subject
    ? scope.subtopic
      ? `${scope.subject} · ${scope.subtopic}`
      : scope.subject
    : null;

  const nameOf = (sel: Selection) => {
    if (!sel) return "";
    const subject = board.subjects[sel.si];
    if (!subject) return "";
    return sel.kind === "subject" ? subject.name : (subject.subs[sel.sj]?.name ?? "");
  };

  const openEdit = (sel: Selection) => {
    if (!sel) return;
    setEditTarget(sel);
    setSelection(sel);
    setEditOpen(true);
  };
  const openRemove = (sel: Selection) => {
    if (!sel) return;
    setRemoveTarget(sel);
    setSelection(sel);
    setRemoveOpen(true);
  };
  const openAddSub = (si: number) => {
    setAddSubParent(si);
    setAddSubOpen(true);
  };

  const play = () => {
    if (pairs.length < 2) {
      toast.info("Add at least two pairs before playing");
      return;
    }
    setPlaying(true);
  };

  const rail: RailItem[] = [
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
        openAddSub(selection ? selection.si : 0);
      },
    },
    {
      label: "Add pairs",
      hint: "Build the facts",
      icon: <Brain size={20} />,
      tone: "mint",
      onClick: () => {
        setMode("edit");
        if (!scope.subtopic) toast.info("Tick a sub-subject and the pair builder opens");
      },
    },
    {
      label: "Remove",
      hint: "Delete",
      icon: <Trash2 size={20} />,
      tone: "clay",
      onClick: () => {
        if (!selection) {
          toast.info("Tick an item to remove");
          return;
        }
        openRemove(selection);
      },
    },
    {
      label: "Edit",
      hint: "Rename",
      icon: <Pencil size={20} />,
      tone: "lilac",
      onClick: () => {
        if (!selection) {
          toast.info("Tick a subject or sub-subject to edit");
          return;
        }
        openEdit(selection);
      },
    },
  ];

  return (
    <StudyLayout rail={rail} activeMode={mode} onModeChange={setMode}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div data-tour="ml-subjects" className="max-h-[74vh] min-w-0 overflow-y-auto pr-1">
          <SubjectBoard
            subjects={board.subjects}
            selection={selection}
            onSelect={setSelection}
            onMoveSubject={board.moveSubject}
            onMoveSub={board.moveSub}
            onEdit={openEdit}
            onRemove={openRemove}
            onAddSub={openAddSub}
            countFor={(si, sj) => {
              void version;
              const subject = board.subjects[si];
              const sub = subject?.subs[sj];
              return subject && sub ? countPairs(subject.name, sub.name) : 0;
            }}
          />

          {mode === "edit" && scope.subject && scope.subtopic && (
            <div className="mt-6">
              <PairCreator subject={scope.subject} subtopic={scope.subtopic} />
            </div>
          )}

          {mode === "edit" && (!scope.subject || !scope.subtopic) && (
            <div className="mt-6 rounded-2xl border border-dashed border-black/10 bg-[#fbf5e9] px-5 py-8 text-center">
              <p className="text-[14px] font-bold text-[#a29a8d]">
                Tick a sub-subject to start building pairs — a left side and the fact that belongs
                to it.
              </p>
            </div>
          )}
        </div>

        <div data-tour="ml-modes" className="flex flex-col gap-4 lg:sticky lg:top-0 lg:self-start">
          <GameSetup
            mode={game}
            onMode={setGame}
            pairCount={pairs.length}
            suddenDeath={suddenDeath}
            onSuddenDeath={setSuddenDeath}
            timed={timed}
            onTimed={setTimed}
            muted={muted}
            onMuted={(v) => {
              setMutedState(v);
              setMuted(v);
            }}
            onPlay={play}
            scopeLabel={scopeLabel}
          />
        </div>
      </div>

      <GameOverlay
        open={playing}
        title={scopeLabel ?? "Memory Lab"}
        mode={game}
        pairs={pairs}
        suddenDeath={suddenDeath}
        timed={timed}
        onClose={() => setPlaying(false)}
        onMissed={(ids) => {
          if (!scope.subject) return;
          const subject = board.subjects.find((s) => s.name === scope.subject);
          const subs = scope.subtopic ? [scope.subtopic] : (subject?.subs ?? []).map((s) => s.name);
          bumpMisses(scope.subject, subs, ids);
        }}
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
        isSub={editTarget?.kind === "sub"}
        initialName={nameOf(editTarget)}
        onSave={(name) => {
          if (!editTarget) return;
          if (editTarget.kind === "subject") board.renameSubject(editTarget.si, name);
          else board.updateSub(editTarget.si, editTarget.sj, name);
          toast.success("Changes saved");
        }}
      />
      <RemoveDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        isSub={removeTarget?.kind === "sub"}
        name={nameOf(removeTarget)}
        onConfirm={() => {
          if (!removeTarget) return;
          if (removeTarget.kind === "subject") board.removeSubject(removeTarget.si);
          else board.removeSub(removeTarget.si, removeTarget.sj);
          setSelection(null);
          toast.success("Removed");
        }}
      />
    </StudyLayout>
  );
}
