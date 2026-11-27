import type { CSSProperties } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal, ShieldCheck, UserMinus, UserX } from "lucide-react";
import { useAvatarUrl, avatarTone } from "@/lib/avatars";
import { ROLE_LABEL, type SpaceMember, type SpaceRole } from "@/lib/spaces";
import { fullDate, timeAgo } from "./time";

/** A person's round picture, or their first letter on their own colour. */
export function MemberAvatar({
  path,
  name,
  size = 36,
  className = "",
}: {
  path: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const url = useAvatarUrl(path);
  return (
    <span
      className={`sp-avatar ${className}`}
      style={{ "--sp-av": `${size}px`, background: avatarTone(name || "student") } as CSSProperties}
      aria-hidden="true"
    >
      {url ? <img src={url} alt="" loading="lazy" /> : (name || "?").charAt(0).toUpperCase()}
    </span>
  );
}

/** Owner in ink, co-owner outlined, member in grey: told apart by words and weight, not colour. */
export function RoleChip({ role }: { role: SpaceRole }) {
  const tone = role === "owner" ? "sp-chip-dark" : role === "co_owner" ? "sp-chip-line" : "";
  return <span className={`sp-chip ${tone}`}>{ROLE_LABEL[role]}</span>;
}

/** One person in a classroom or group. Owners and co-owners can change others' roles. */
export function MemberRow({
  member,
  canManage,
  isMe,
  onRole,
  onRemove,
}: {
  member: SpaceMember;
  canManage: boolean;
  isMe: boolean;
  onRole: (role: SpaceRole) => void;
  onRemove: () => void;
}) {
  const name = member.username || "student";
  return (
    <li className="sp-member">
      <MemberAvatar path={member.avatar_url} name={name} size={40} />
      <div className="sp-member-info">
        <p className="sp-member-name">
          <span dir="auto">@{name}</span>
          {isMe && <span className="sp-chip sp-chip-sm">You</span>}
        </p>
        <p className="sp-member-sub">
          {member.full_name && (
            <>
              <span dir="auto">{member.full_name}</span>
              <span aria-hidden="true"> · </span>
            </>
          )}
          <span title={fullDate(member.joined_at)}>joined {timeAgo(member.joined_at)}</span>
        </p>
      </div>
      <RoleChip role={member.role} />
      {canManage && member.role !== "owner" && !isMe && (
        <Menu.Root modal={false}>
          <Menu.Trigger asChild>
            <button
              type="button"
              className="sp-btn sp-btn-ghost sp-btn-icon sp-btn-icon-sm"
              aria-label={`Options for @${name}`}
            >
              <MoreHorizontal size={17} aria-hidden="true" />
            </button>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content align="end" sideOffset={6} className="sp sp-menu">
              <Menu.Item
                className="sp-menu-item"
                onSelect={() => onRole(member.role === "co_owner" ? "member" : "co_owner")}
              >
                {member.role === "co_owner" ? (
                  <>
                    <UserMinus size={16} aria-hidden="true" />
                    Make a member again
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} aria-hidden="true" />
                    Make co-owner
                  </>
                )}
              </Menu.Item>
              <Menu.Separator className="sp-menu-sep" />
              <Menu.Item className="sp-menu-item sp-menu-danger" onSelect={onRemove}>
                <UserX size={16} aria-hidden="true" />
                Remove @{name}
              </Menu.Item>
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
      )}
    </li>
  );
}
