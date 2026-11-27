// Making a classroom or a study group: the kind, a live preview of its card, then its name, a line
// about it, an emoji and a colour.
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { GraduationCap, Users } from "lucide-react";
import { KIND_LABEL, createSpace, type SpaceKind } from "@/lib/spaces";
import { SpaceCardPreview } from "./SpaceCard";
import { SpaceFields, type SpaceDraft } from "./SpaceFields";
import { SpaceDialog, Spin, errorText } from "./shared";

const KIND_NOTE: Record<SpaceKind, string> = {
  classroom:
    "A whole course: one shared library in folders, members with roles, news for everyone.",
  group: "A few classmates: everyone adds decks, posts news and, if you like, chats.",
};

function fresh(kind: SpaceKind): SpaceDraft {
  return {
    name: "",
    description: "",
    emoji: kind === "classroom" ? "🎓" : "🧠",
    color: kind === "classroom" ? "sky" : "apricot",
  };
}

export function CreateSpaceDialog({
  open,
  kind: startKind,
  onClose,
  onCreated,
}: {
  open: boolean;
  kind: SpaceKind;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [kind, setKind] = useState<SpaceKind>(startKind);
  const [draft, setDraft] = useState<SpaceDraft>(() => fresh(startKind));
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Each time the window opens it starts clean, on the kind that was asked for.
  useEffect(() => {
    if (!open) return;
    setKind(startKind);
    setDraft(fresh(startKind));
    setNameError(null);
  }, [open, startKind]);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const name = draft.name.trim();
    if (!name) {
      setNameError(`Give your ${KIND_LABEL[kind].toLowerCase()} a name.`);
      return;
    }
    setSaving(true);
    try {
      const id = await createSpace({
        kind,
        name,
        description: draft.description.trim(),
        emoji: draft.emoji,
        color: draft.color,
      });
      toast.success(`${KIND_LABEL[kind]} created`);
      onCreated(id);
    } catch (error) {
      toast.error(errorText(error, "Could not create it. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SpaceDialog
      open={open}
      onClose={onClose}
      busy={saving}
      title={`New ${KIND_LABEL[kind].toLowerCase()}`}
      description={KIND_NOTE[kind]}
      footer={
        <>
          <button type="button" className="sp-btn sp-btn-light" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="submit"
            form="sp-create-form"
            className="sp-btn sp-btn-dark"
            disabled={saving}
          >
            {saving && <Spin />}
            Create {KIND_LABEL[kind].toLowerCase()}
          </button>
        </>
      }
    >
      <form id="sp-create-form" className="sp-create-form" onSubmit={submit} noValidate>
        <div className="sp-seg sp-seg-full" aria-label="What are you making?" role="group">
          {(["classroom", "group"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={kind === value}
              onClick={() => setKind(value)}
            >
              {value === "classroom" ? (
                <GraduationCap size={16} aria-hidden="true" />
              ) : (
                <Users size={16} aria-hidden="true" />
              )}
              {KIND_LABEL[value]}
            </button>
          ))}
        </div>

        <div className="sp-preview">
          <p className="sp-preview-label">Preview</p>
          <SpaceCardPreview
            space={{
              kind,
              name: draft.name,
              description: draft.description,
              emoji: draft.emoji,
              color: draft.color,
              role: "owner",
              members: 1,
              decks: 0,
            }}
          />
        </div>

        <SpaceFields
          kind={kind}
          value={draft}
          onChange={(next) => {
            setDraft(next);
            if (nameError && next.name.trim()) setNameError(null);
          }}
          nameError={nameError}
          autoFocus
        />
      </form>
    </SpaceDialog>
  );
}
