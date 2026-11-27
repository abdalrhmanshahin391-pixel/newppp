// Everyone in a classroom or group, grouped by role, with a search once the list is long. Owners and
// co-owners can make someone a co-owner (or a member again) and remove people.
import { useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { removeMember, setMemberRole, type SpaceMember, type SpaceRole } from "@/lib/spaces";
import { MemberRow } from "./MemberRow";
import { errorText, type ConfirmFn } from "./shared";

const GROUPS: { role: SpaceRole; title: string }[] = [
  { role: "owner", title: "Owner" },
  { role: "co_owner", title: "Co-owners" },
  { role: "member", title: "Members" },
];

export function MembersTab({
  spaceId,
  members,
  loading,
  failed,
  canManage,
  meId,
  onChanged,
  confirm,
}: {
  spaceId: string;
  members: SpaceMember[];
  loading: boolean;
  failed: boolean;
  canManage: boolean;
  meId: string;
  onChanged: () => Promise<void>;
  confirm: ConfirmFn;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q
    ? members.filter(
        (m) => m.username?.toLowerCase().includes(q) || m.full_name?.toLowerCase().includes(q),
      )
    : members;

  async function changeRole(member: SpaceMember, role: SpaceRole) {
    try {
      await setMemberRole(spaceId, member.user_id, role);
      await onChanged();
      toast.success(
        role === "co_owner"
          ? `@${member.username} is now a co-owner`
          : `@${member.username} is a member again`,
      );
    } catch (error) {
      toast.error(errorText(error, "Could not change the role."));
    }
  }

  async function remove(member: SpaceMember) {
    const ok = await confirm({
      title: `Remove @${member.username}?`,
      text: "They lose access to the decks, question sets and announcements here. They can come back with a new invite.",
      confirm: "Remove",
      danger: true,
    });
    if (!ok) return;
    try {
      await removeMember(spaceId, member.user_id);
      await onChanged();
      toast.success(`@${member.username} was removed`);
    } catch (error) {
      toast.error(errorText(error, "Could not remove them."));
    }
  }

  if (loading) {
    return (
      <ul className="sp-people-list" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <li key={i} className="sp-member">
            <span className="sp-bone sp-bone-avatar" />
            <span className="sp-bone sp-bone-line" />
          </li>
        ))}
      </ul>
    );
  }

  if (failed) {
    return (
      <p className="sp-state-text" role="alert">
        The member list could not be loaded. Refresh the page to try again.
      </p>
    );
  }

  return (
    <div className="sp-stack-lg">
      <div className="sp-toolbar">
        <div className="sp-toolbar-title">
          <h2 className="sp-h3">Members</h2>
          <span className="sp-chip">
            {members.length === 1 ? "1 person" : `${members.length.toLocaleString("en")} people`}
          </span>
        </div>
        {members.length > 8 && (
          <div className="sp-toolbar-actions">
            <label className="sp-search">
              <Search size={16} aria-hidden="true" />
              <span className="sp-sr">Search members</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name"
              />
            </label>
          </div>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="sp-state-text">Nobody matches “{query.trim()}”.</p>
      ) : (
        GROUPS.map(({ role, title }) => {
          const people = shown.filter((m) => m.role === role);
          if (people.length === 0) return null;
          return (
            <section key={role} className="sp-people-group" aria-label={title}>
              <h3 className="sp-group-title">
                {title}
                <span className="sp-group-count">{people.length}</span>
              </h3>
              <ul className="sp-people-list">
                {people.map((member) => (
                  <MemberRow
                    key={member.user_id}
                    member={member}
                    canManage={canManage}
                    isMe={member.user_id === meId}
                    onRole={(next) => void changeRole(member, next)}
                    onRemove={() => void remove(member)}
                  />
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
