// Settings of a classroom or group, for its owners: what it is called and how it looks, the invite
// link, how it works (chat, who adds decks, who posts), and leaving or deleting it.
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { KIND_LABEL, updateSpace, type Space } from "@/lib/spaces";
import { InvitePanel } from "./invite";
import { SpaceFields, type SpaceDraft } from "./SpaceFields";
import { Spin, errorText, type ConfirmFn } from "./shared";

type Who = "owners" | "members";

function draftOf(space: Space): SpaceDraft {
  return {
    name: space.name,
    description: space.description ?? "",
    emoji: space.emoji || "🎓",
    color: space.color || "apricot",
  };
}

export function SettingsTab({
  space,
  isOwner,
  onChanged,
  onLeave,
  onDelete,
  confirm,
}: {
  space: Space;
  isOwner: boolean;
  onChanged: () => Promise<void>;
  onLeave: () => void;
  onDelete: () => void;
  confirm: ConfirmFn;
}) {
  const [draft, setDraft] = useState<SpaceDraft>(() => draftOf(space));
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rule, setRule] = useState<string | null>(null);
  const kind = KIND_LABEL[space.kind].toLowerCase();

  // When the saved space changes (after a save, or someone else's), start from it again.
  useEffect(() => {
    setDraft(draftOf(space));
  }, [space]);

  const saved = draftOf(space);
  const dirty =
    draft.name !== saved.name ||
    draft.description !== saved.description ||
    draft.emoji !== saved.emoji ||
    draft.color !== saved.color;

  async function saveDetails(event: FormEvent) {
    event.preventDefault();
    const name = draft.name.trim();
    if (!name) {
      setNameError(`Your ${kind} needs a name.`);
      return;
    }
    setSaving(true);
    try {
      await updateSpace(space.id, {
        name,
        description: draft.description.trim() || null,
        emoji: draft.emoji,
        color: draft.color,
      });
      await onChanged();
      toast.success("Saved");
    } catch (error) {
      toast.error(errorText(error, "Could not save. Your changes are still here."));
    } finally {
      setSaving(false);
    }
  }

  async function setRuleValue(key: string, values: Partial<Space>) {
    setRule(key);
    try {
      await updateSpace(space.id, values);
      await onChanged();
    } catch (error) {
      toast.error(errorText(error, "Could not change that setting."));
    } finally {
      setRule(null);
    }
  }

  return (
    <div className="sp-settings">
      <section className="sp-set" aria-labelledby="sp-set-details">
        <div className="sp-set-head">
          <h2 id="sp-set-details" className="sp-h3">
            Name and look
          </h2>
          <p className="sp-set-note">What everyone sees on the card and at the top of this page.</p>
        </div>
        <form onSubmit={saveDetails} noValidate>
          <SpaceFields
            kind={space.kind}
            value={draft}
            onChange={(next) => {
              setDraft(next);
              if (nameError && next.name.trim()) setNameError(null);
            }}
            nameError={nameError}
          />
          <div className="sp-set-actions">
            <button type="submit" className="sp-btn sp-btn-dark" disabled={!dirty || saving}>
              {saving && <Spin />}
              Save changes
            </button>
            {dirty && !saving && (
              <button type="button" className="sp-btn sp-btn-ghost" onClick={() => setDraft(saved)}>
                Undo
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="sp-set" aria-labelledby="sp-set-invite">
        <div className="sp-set-head">
          <h2 id="sp-set-invite" className="sp-h3">
            Invite link
          </h2>
          <p className="sp-set-note">
            Anyone with the link or the code can join. Make a new one to stop the old one working.
          </p>
        </div>
        <InvitePanel spaceId={space.id} spaceName={space.name} confirm={confirm} />
      </section>

      <section className="sp-set" aria-labelledby="sp-set-rules">
        <div className="sp-set-head">
          <h2 id="sp-set-rules" className="sp-h3">
            How it works
          </h2>
        </div>
        <div className="sp-rules">
          <div className="sp-rule">
            <div className="sp-rule-copy">
              <p className="sp-rule-title" id="sp-rule-chat">
                Chat
              </p>
              <p className="sp-rule-note">
                Off by default. Turn it on if you want people talking here.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={space.chat_enabled}
              aria-labelledby="sp-rule-chat"
              className="sp-switch"
              disabled={rule !== null}
              onClick={() => setRuleValue("chat", { chat_enabled: !space.chat_enabled })}
            >
              <span className="sp-switch-knob" />
            </button>
          </div>
          <WhoRule
            id="decks"
            title="Who can add decks"
            note="Owners and co-owners can always add."
            value={space.who_can_add_decks}
            busy={rule !== null}
            onChange={(value) => setRuleValue("decks", { who_can_add_decks: value })}
          />
          <WhoRule
            id="posts"
            title="Who can post announcements"
            note="Owners and co-owners can always post."
            value={space.who_can_post}
            busy={rule !== null}
            onChange={(value) => setRuleValue("posts", { who_can_post: value })}
          />
        </div>
      </section>

      <section className="sp-set sp-set-danger" aria-labelledby="sp-set-danger">
        <div className="sp-set-head">
          <h2 id="sp-set-danger" className="sp-h3">
            {isOwner ? `Delete this ${kind}` : `Leave this ${kind}`}
          </h2>
          <p className="sp-set-note">
            {isOwner
              ? `Deleting removes it for everyone: its folders, announcements and chat. Shared decks stay with the people who made them.`
              : `You stop seeing its decks and news. You can come back with an invite.`}
          </p>
        </div>
        <div className="sp-set-actions">
          {isOwner ? (
            <button type="button" className="sp-btn sp-btn-danger" onClick={onDelete}>
              Delete {kind}
            </button>
          ) : (
            <button type="button" className="sp-btn sp-btn-danger" onClick={onLeave}>
              Leave {kind}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function WhoRule({
  id,
  title,
  note,
  value,
  busy,
  onChange,
}: {
  id: string;
  title: string;
  note: string;
  value: Who;
  busy: boolean;
  onChange: (value: Who) => void;
}) {
  return (
    <div className="sp-rule">
      <div className="sp-rule-copy">
        <p className="sp-rule-title" id={`sp-rule-${id}`}>
          {title}
        </p>
        <p className="sp-rule-note">{note}</p>
      </div>
      <div className="sp-seg" role="radiogroup" aria-labelledby={`sp-rule-${id}`}>
        {(["owners", "members"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            disabled={busy}
            onClick={() => {
              if (value !== option) onChange(option);
            }}
          >
            {option === "owners" ? "Owners only" : "Everyone"}
          </button>
        ))}
      </div>
    </div>
  );
}
