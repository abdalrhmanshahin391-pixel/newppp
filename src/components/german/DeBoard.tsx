import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Flag, Sparkles } from "lucide-react";
import { useDeItems, useDeTree } from "@/lib/use-de-lab";
import { ConfirmDialog, PromptDialog } from "@/components/study/SimpleDialogs";
import { AddWordsDialog } from "@/components/german/AddWordsDialog";
import { PickerBoard, type PickerGroup, type PickerItem } from "@/components/common/PickerBoard";
import { itemKey, whyNotPlayable, type DeSubject, type LabMode } from "@/lib/de-lab";

type Props = {
  mode: LabMode;
  accent: string;
  selected: string[];
  onSelect: (ids: string[]) => void;
};

const LAB_LABEL: Record<LabMode, string> = {
  articles: "der/die/das",
  speaking: "speaking",
  build: "build",
};

/** How many of a shelf entry's items this lab can actually play. */
export function playableCount(
  row: { items: number; nouns?: number; buildable?: number },
  mode: LabMode,
): number {
  if (mode === "articles") return row.nouns ?? 0;
  if (mode === "build") return row.buildable ?? 0;
  return row.items;
}

/** One shared shelf: subjects → sub-subjects, used by all three German labs. */
export function DeBoard({ mode, accent, selected, onSelect }: Props) {
  const tree = useDeTree(mode);
  const [addTo, setAddTo] = useState<{ subtopicId: string; name: string } | null>(null);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [subtopicFor, setSubtopicFor] = useState<DeSubject | null>(null);
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [onlyReady, setOnlyReady] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<
    { table: "de_subjects" | "de_subtopics"; id: string; label: string } | null
  >(null);

  // Existing entries in the sub-subject we're adding to — used to flag duplicates.
  const existingItems = useDeItems(addTo ? [addTo.subtopicId] : []);
  const existingKeys = useMemo(
    () => (existingItems.data ?? []).map((i) => itemKey(i)),
    [existingItems.data],
  );

  const toggle = (id: string) =>
    onSelect(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const groups: PickerGroup[] = tree.subjects
    .filter((s) => (onlyFlagged ? (s.flags ?? 0) > 0 : true))
    .filter((s) => (onlyReady ? playableCount(s, mode) > 0 : true))
    .map((s) => {
      const total = s.items ?? 0;
      const readyHere = playableCount(s, mode);
      const everywhere =
        total > 0 && (s.nouns ?? 0) > 0 && (s.buildable ?? 0) > 0;
      return {
        id: s.id,
        name: s.name,
        color: s.color,
        sample: s.is_sample,
        count: total,
        flags: s.flags,
        badge: everywhere ? "Ready in all three labs" : undefined,
        bars: [
          { label: "der/die/das", value: s.nouns ?? 0, total, color: "#2f6fd0" },
          { label: "speak", value: total, total, color: "#d98d3a" },
          { label: "build", value: s.buildable ?? 0, total, color: "#2f9e63" },
        ],
        items: s.subtopics
          .filter((t) => (onlyFlagged ? (t.flags ?? 0) > 0 : true))
          .filter((t) => (onlyReady ? playableCount(t, mode) > 0 : true))
          .map((t): PickerItem => {
            const ready = playableCount(t, mode);
            const skipped = Math.max(0, (t.items ?? 0) - ready);
            return {
              id: t.id,
              name: t.name,
              count: t.items,
              countLabel:
                t.items === 0
                  ? "Nothing added yet"
                  : `${ready} playable here · ${t.items} on the shelf`,
              note:
                t.items === 0
                  ? undefined
                  : ready === 0
                    ? `Not for this lab — ${whyNotPlayable(mode)}`
                    : skipped > 0
                      ? `${skipped} skipped here — ${whyNotPlayable(mode)}`
                      : undefined,
              disabled: ready === 0,
              flags: t.flags,
              sample: t.is_sample,
            };
          }),
      };
    });

  const chip = (on: boolean, label: string, onClick: () => void, icon?: React.ReactNode) => (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-extrabold transition"
      style={
        on
          ? { background: accent, color: "#fff" }
          : { background: "#f3ece0", color: "#6b645b" }
      }
    >
      {icon}
      {label}
    </button>
  );

  return (
    <>
      <PickerBoard
        accent={accent}
        groups={groups}
        selected={selected}
        onToggle={toggle}
        loading={tree.loading}
        unitNoun="items"
        addLabel="Add words"
        chips={
          <>
            <span className="mr-1 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-extrabold text-[#8a8175]">
              <Sparkles size={13} style={{ color: accent }} /> One shelf — every lab sees it
            </span>
            {chip(onlyReady, `Ready for ${LAB_LABEL[mode]}`, () => setOnlyReady((v) => !v))}
            {chip(onlyFlagged, "Has flags", () => setOnlyFlagged((v) => !v), <Flag size={12} />)}
          </>
        }
        onNewGroup={() => setSubjectOpen(true)}
        onNewItem={(g) => setSubtopicFor(tree.subjects.find((s) => s.id === g.id) ?? null)}
        onAddContent={(t) => setAddTo({ subtopicId: t.id, name: t.name })}
        onSelectAll={(g) =>
          onSelect(
            Array.from(
              new Set([...selected, ...g.items.filter((t) => !t.disabled).map((t) => t.id)]),
            ),
          )
        }
        onClearGroup={(g) => {
          const ids = new Set(g.items.map((t) => t.id));
          onSelect(selected.filter((x) => !ids.has(x)));
        }}
        onAddToGroup={(g) => {
          const subject = tree.subjects.find((s) => s.id === g.id);
          const first = subject?.subtopics[0];
          if (first) setAddTo({ subtopicId: first.id, name: first.name });
          else setSubtopicFor(subject ?? null);
        }}
        onDeleteGroup={(g) => setPendingDelete({ table: "de_subjects", id: g.id, label: g.name })}
        onDeleteItem={(t) => setPendingDelete({ table: "de_subtopics", id: t.id, label: t.name })}
        emptyHint={
          onlyReady || onlyFlagged
            ? "Nothing matches those filters."
            : "No subjects yet — tap New to create your first one. It shows up in every German lab."
        }
      />

      <PromptDialog
        open={subjectOpen}
        onOpenChange={setSubjectOpen}
        title="Add subject"
        description="Made once — it appears in all three German labs. Sub-subjects live inside it."
        label="Subject name"
        confirmLabel="Add subject"
        onSubmit={(v) => void tree.createSubject({ name: v, color: accent })}
      />

      <PromptDialog
        open={!!subtopicFor}
        onOpenChange={(v) => !v && setSubtopicFor(null)}
        title="Add sub-subject"
        description={subtopicFor ? `Inside ${subtopicFor.name}.` : undefined}
        label="Sub-subject name"
        confirmLabel="Add sub-subject"
        onSubmit={(v) => {
          if (subtopicFor) void tree.createSubtopic({ subjectId: subtopicFor.id, name: v });
          setSubtopicFor(null);
        }}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(v) => !v && setPendingDelete(null)}
        title="Delete"
        description={
          pendingDelete
            ? `Remove “${pendingDelete.label}”? It disappears from every German lab, with everything inside it.`
            : undefined
        }
        onConfirm={() => {
          if (pendingDelete) void tree.remove({ table: pendingDelete.table, id: pendingDelete.id });
          setPendingDelete(null);
        }}
      />

      {addTo && (
        <AddWordsDialog
          accent={accent}
          name={addTo.name}
          busy={tree.busy}
          existingKeys={existingKeys}
          onClose={() => setAddTo(null)}
          onSave={async (items) => {
            await tree.addItems({ subtopicId: addTo.subtopicId, items });
            if (!selected.includes(addTo.subtopicId)) onSelect([...selected, addTo.subtopicId]);
            toast.success(
              `${items.length} ${items.length === 1 ? "item" : "items"} saved to “${addTo.name}” — ready in every lab`,
            );
            setAddTo(null);
          }}
        />
      )}
    </>
  );
}
