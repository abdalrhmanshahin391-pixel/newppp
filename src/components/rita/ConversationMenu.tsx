import * as Menu from "@radix-ui/react-dropdown-menu";
import { Loader2, MoreHorizontal } from "lucide-react";

export type ConversationAction = "pdf" | "md" | "json" | "repair" | "delete";

/**
 * The "More" menu of a conversation card: the files, and delete at the bottom. The admin's Repair
 * file is only in the list for admins. One button on the card instead of six.
 */
export function ConversationMenu({
  title,
  isAdmin,
  busy,
  onAction,
}: {
  title: string;
  isAdmin: boolean;
  busy: boolean;
  onAction: (action: ConversationAction) => void;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <button
          type="button"
          aria-label={`More for ${title}`}
          aria-busy={busy}
          disabled={busy}
          className="rita-btn rita-btn-soft rita-btn-icon disabled:opacity-60"
        >
          {busy ? (
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          ) : (
            <MoreHorizontal size={20} aria-hidden="true" />
          )}
        </button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={6} className="edith-premium rita-menu">
          {isAdmin ? (
            <>
              <Menu.Item className="rita-menu-item" onSelect={() => onAction("repair")}>
                Repair file
                <small>
                  The whole conversation with the AI review of every reply. Send it to Claude when
                  this conversation went wrong.
                </small>
              </Menu.Item>
              <div className="rita-menu-sep" role="separator" />
            </>
          ) : null}
          <Menu.Item className="rita-menu-item" onSelect={() => onAction("pdf")}>
            PDF
            <small>To read or print</small>
          </Menu.Item>
          <Menu.Item className="rita-menu-item" onSelect={() => onAction("md")}>
            Text for AI
            <small>The plain transcript</small>
          </Menu.Item>
          <Menu.Item className="rita-menu-item" onSelect={() => onAction("json")}>
            JSON
            <small>The raw data</small>
          </Menu.Item>
          <div className="rita-menu-sep" role="separator" />
          <Menu.Item
            className="rita-menu-item rita-menu-item-danger"
            onSelect={() => onAction("delete")}
          >
            Delete conversation
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
