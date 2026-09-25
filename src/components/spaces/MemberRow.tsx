import { useAvatarUrl, avatarTone } from "@/lib/avatars";
import { ROLE_LABEL, type SpaceMember, type SpaceRole } from "@/lib/spaces";

export function MemberAvatar({
  path,
  name,
  size = 36,
}: {
  path: string | null;
  name: string;
  size?: number;
}) {
  const url = useAvatarUrl(path);
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-full text-[12px] font-black text-white ring-2 ring-white"
      style={{ height: size, width: size, background: avatarTone(name || "student") }}
    >
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        (name || "?").charAt(0).toUpperCase()
      )}
    </span>
  );
}

/** One person inside a classroom or group, Telegram-style. */
export function MemberRow({
  member,
  spaceEmoji,
  spaceTone,
  canManage,
  isMe,
  onRole,
  onRemove,
}: {
  member: SpaceMember;
  spaceEmoji: string;
  spaceTone: string;
  canManage: boolean;
  isMe: boolean;
  onRole: (role: SpaceRole) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-black/[0.06] bg-white px-4 py-3">
      <MemberAvatar path={member.avatar_url} name={member.username} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-[15px] font-black">
          @{member.username || "student"}
          <span
            className="grid h-5 w-5 place-items-center rounded-full text-[11px]"
            style={{ background: spaceTone }}
            title="Member of this space"
          >
            {spaceEmoji}
          </span>
          {isMe && <span className="text-[11px] font-bold text-[#a29a8d]">you</span>}
        </p>
        <p className="truncate text-[13px] text-[#6b655c]">
          {member.full_name || "—"} · joined {new Date(member.joined_at).toLocaleDateString()}
        </p>
      </div>
      <span
        className={`rounded-full px-3 py-1 text-[11px] font-black ${
          member.role === "member" ? "bg-black/[0.06] text-[#6b655c]" : "bg-[#e6f4d8] text-[#3d5c14]"
        }`}
      >
        {ROLE_LABEL[member.role]}
      </span>
      {canManage && member.role !== "owner" && (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onRole(member.role === "co_owner" ? "member" : "co_owner")}
            className="rounded-full bg-black/[0.05] px-3 py-1.5 text-[12px] font-black hover:bg-black/[0.09]"
          >
            {member.role === "co_owner" ? "Make member" : "Make co-owner"}
          </button>
          <button
            onClick={onRemove}
            className="rounded-full px-3 py-1.5 text-[12px] font-black text-red-600 hover:bg-red-50"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
