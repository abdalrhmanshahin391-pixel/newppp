// Inviting people: one hook that makes the link when there is none yet, copies it, opens the phone's
// share sheet, or replaces it; and the panel owners see on the overview and in settings.
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Link2, Share2 } from "lucide-react";
import { inviteLink, rotateInvite, useSpaceInvite } from "@/lib/spaces";
import { Spin, errorText, type ConfirmFn } from "./shared";

type Busy = null | "create" | "copy" | "share" | "renew";

export function useInvite(spaceId: string, canManage: boolean) {
  const qc = useQueryClient();
  const invite = useSpaceInvite(spaceId, canManage);
  const [busy, setBusy] = useState<Busy>(null);
  const [canShare, setCanShare] = useState(false);
  const code = invite.data?.code ?? null;

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const reload = () =>
    qc.invalidateQueries({ queryKey: ["space-invite", spaceId], refetchType: "all" });

  /** The current code, making the first one if there is none yet. */
  async function ensure(): Promise<string> {
    if (code) return code;
    const made = await rotateInvite(spaceId);
    await reload();
    return made;
  }

  async function create() {
    setBusy("create");
    try {
      await ensure();
      toast.success("Invite link ready");
    } catch (error) {
      toast.error(errorText(error, "Could not make an invite link."));
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    setBusy("copy");
    try {
      // With a code already there, copy straight away (Safari wants it inside the tap).
      const current = code ?? (await ensure());
      await navigator.clipboard.writeText(inviteLink(current));
      toast.success("Invite link copied");
    } catch (error) {
      toast.error(errorText(error, "Could not copy the link. Select it and copy it by hand."));
    } finally {
      setBusy(null);
    }
  }

  async function share(name: string) {
    setBusy("share");
    try {
      const current = code ?? (await ensure());
      const url = inviteLink(current);
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({
            title: `Join ${name} on Uzyra`,
            text: `Join ${name} on Uzyra`,
            url,
          });
        } catch (error) {
          // Closing the share sheet is not an error.
          if (!(error instanceof DOMException && error.name === "AbortError")) throw error;
        }
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Invite link copied");
      }
    } catch (error) {
      toast.error(errorText(error, "Could not share the link."));
    } finally {
      setBusy(null);
    }
  }

  async function renew() {
    setBusy("renew");
    try {
      await rotateInvite(spaceId, invite.data?.id);
      await reload();
      toast.success("New link made. The old one no longer works.");
    } catch (error) {
      toast.error(errorText(error, "Could not make a new link."));
    } finally {
      setBusy(null);
    }
  }

  return {
    loading: canManage && invite.isLoading,
    failed: invite.isError,
    code,
    link: code ? inviteLink(code) : "",
    busy,
    canShare,
    create,
    copy,
    share,
    renew,
  };
}

/** The code in large type, the link under it, and the ways to send it. Owners and co-owners only. */
export function InvitePanel({
  spaceId,
  spaceName,
  confirm,
}: {
  spaceId: string;
  spaceName: string;
  confirm: ConfirmFn;
}) {
  const invite = useInvite(spaceId, true);

  if (invite.loading) {
    return (
      <div className="sp-invite" aria-busy="true">
        <span className="sp-bone sp-bone-code" />
        <span className="sp-bone sp-bone-line" />
      </div>
    );
  }

  if (invite.failed) {
    return (
      <div className="sp-invite">
        <p className="sp-muted">
          The invite link could not be loaded. Refresh the page to try again.
        </p>
      </div>
    );
  }

  if (!invite.code) {
    return (
      <div className="sp-invite">
        <p className="sp-muted">
          No invite link yet. Make one and send it to the people you want in here.
        </p>
        <button
          type="button"
          className="sp-btn sp-btn-dark"
          onClick={invite.create}
          disabled={invite.busy !== null}
        >
          {invite.busy === "create" ? <Spin /> : <Link2 size={16} aria-hidden="true" />}
          Create invite link
        </button>
      </div>
    );
  }

  return (
    <div className="sp-invite">
      <div className="sp-code-row">
        <code className="sp-code" aria-label={`Invite code ${invite.code}`}>
          {invite.code}
        </code>
        <button
          type="button"
          className="sp-btn sp-btn-ghost sp-btn-icon"
          onClick={invite.copy}
          disabled={invite.busy !== null}
          aria-label="Copy invite link"
          title="Copy invite link"
        >
          <Copy size={17} aria-hidden="true" />
        </button>
      </div>
      <p className="sp-invite-link" title={invite.link}>
        {invite.link.replace(/^https?:\/\//, "")}
      </p>
      <div className="sp-invite-actions">
        <button
          type="button"
          className="sp-btn sp-btn-dark"
          onClick={invite.copy}
          disabled={invite.busy !== null}
        >
          {invite.busy === "copy" ? <Spin /> : <Link2 size={16} aria-hidden="true" />}
          Copy link
        </button>
        {invite.canShare && (
          <button
            type="button"
            className="sp-btn sp-btn-light"
            onClick={() => invite.share(spaceName)}
            disabled={invite.busy !== null}
          >
            {invite.busy === "share" ? <Spin /> : <Share2 size={16} aria-hidden="true" />}
            Share
          </button>
        )}
      </div>
      <button
        type="button"
        className="sp-textbtn"
        disabled={invite.busy !== null}
        onClick={async () => {
          const ok = await confirm({
            title: "Make a new link?",
            text: "The current link and code stop working. Everyone who already joined stays in.",
            confirm: "Make new link",
          });
          if (ok) await invite.renew();
        }}
      >
        {invite.busy === "renew" && <Spin />}
        Make a new link
      </button>
    </div>
  );
}
