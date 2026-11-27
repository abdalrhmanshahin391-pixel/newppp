// Announcements: news for everyone in a classroom or group. Pinned ones stay on top; owners pin and
// delete. Who may post is set in Settings (owners only, or everyone).
import { useState } from "react";
import { toast } from "sonner";
import { Megaphone, Pin, PinOff, Trash2 } from "lucide-react";
import {
  deleteAnnouncement,
  postAnnouncement,
  setAnnouncementPinned,
  useSpaceAnnouncements,
  type SpaceMember,
} from "@/lib/spaces";
import { MemberAvatar } from "./MemberRow";
import { plural } from "./SpaceCard";
import { Spin, errorText, type ConfirmFn } from "./shared";
import { fullDate, timeAgo } from "./time";

export function NewsTab({
  spaceId,
  members,
  me,
  canPost,
  canManage,
  onChanged,
  confirm,
}: {
  spaceId: string;
  members: SpaceMember[];
  me: SpaceMember | undefined;
  canPost: boolean;
  canManage: boolean;
  onChanged: () => Promise<void>;
  confirm: ConfirmFn;
}) {
  const news = useSpaceAnnouncements(spaceId);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const person = (id: string) => members.find((m) => m.user_id === id);
  const list = news.data ?? [];

  async function post(event?: { preventDefault: () => void }) {
    event?.preventDefault();
    const text = body.trim();
    if (!text || posting) return;
    setPosting(true);
    try {
      await postAnnouncement(spaceId, text);
      setBody("");
      await onChanged();
      toast.success("Announcement posted");
    } catch (error) {
      toast.error(errorText(error, "Could not post it. Your text is still here; try again."));
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="sp-stack-lg sp-narrow">
      <div className="sp-toolbar">
        <div className="sp-toolbar-title">
          <h2 className="sp-h3">Announcements</h2>
          {!news.isLoading && <span className="sp-chip">{plural(list.length, "post")}</span>}
        </div>
      </div>

      {canPost && (
        <form className="sp-composer" onSubmit={post}>
          {me && <MemberAvatar path={me.avatar_url} name={me.username} size={40} />}
          <div className="sp-composer-main">
            <label htmlFor="sp-news-body" className="sp-sr">
              New announcement
            </label>
            <textarea
              id="sp-news-body"
              className="sp-composer-input"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void post(event);
              }}
              placeholder="Share news with everyone here: a new deck, an exam date, what to study this week…"
              rows={3}
              maxLength={2000}
              dir="auto"
            />
            <div className="sp-composer-foot">
              <span className="sp-help">Everyone in here sees it.</span>
              <button
                type="submit"
                className="sp-btn sp-btn-dark sp-btn-sm"
                disabled={posting || !body.trim()}
              >
                {posting ? <Spin /> : <Megaphone size={15} aria-hidden="true" />}
                Post
              </button>
            </div>
          </div>
        </form>
      )}

      {news.isLoading ? (
        <div className="sp-posts" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="sp-post">
              <span className="sp-bone sp-bone-avatar" />
              <span className="sp-bone sp-bone-line" />
            </div>
          ))}
        </div>
      ) : news.isError ? (
        <p className="sp-state-text" role="alert">
          The announcements could not be loaded. Refresh the page to try again.
        </p>
      ) : list.length === 0 ? (
        <div className="sp-empty">
          <span className="sp-empty-icon" aria-hidden="true">
            <Megaphone size={22} />
          </span>
          <h3 className="sp-empty-title">No announcements yet</h3>
          <p className="sp-empty-text">
            {canPost
              ? "Post the first one: what you added, when the exam is, what to study next."
              : "News from the owners shows up here."}
          </p>
        </div>
      ) : (
        <div className="sp-posts">
          {list.map((item) => {
            const author = person(item.author_id);
            const name = author?.username ?? "former member";
            return (
              <article key={item.id} className={`sp-post${item.pinned ? " is-pinned" : ""}`}>
                <div className="sp-post-head">
                  <MemberAvatar path={author?.avatar_url ?? null} name={name} size={36} />
                  <div className="sp-post-who">
                    <p className="sp-post-name" dir="auto">
                      @{name}
                    </p>
                    <p className="sp-post-time">
                      <time dateTime={item.created_at} title={fullDate(item.created_at)}>
                        {timeAgo(item.created_at)}
                      </time>
                      {item.pinned && (
                        <span className="sp-chip sp-chip-sm">
                          <Pin size={12} aria-hidden="true" />
                          Pinned
                        </span>
                      )}
                    </p>
                  </div>
                  {canManage && (
                    <div className="sp-post-tools">
                      <button
                        type="button"
                        className="sp-btn sp-btn-ghost sp-btn-icon sp-btn-icon-sm"
                        aria-label={item.pinned ? "Unpin" : "Pin to the top"}
                        title={item.pinned ? "Unpin" : "Pin to the top"}
                        disabled={busy === item.id}
                        onClick={async () => {
                          setBusy(item.id);
                          try {
                            await setAnnouncementPinned(item.id, !item.pinned);
                            await onChanged();
                          } catch (error) {
                            toast.error(errorText(error, "Could not change the pin."));
                          } finally {
                            setBusy(null);
                          }
                        }}
                      >
                        {item.pinned ? (
                          <PinOff size={15} aria-hidden="true" />
                        ) : (
                          <Pin size={15} aria-hidden="true" />
                        )}
                      </button>
                      <button
                        type="button"
                        className="sp-btn sp-btn-ghost sp-btn-icon sp-btn-icon-sm sp-text-danger"
                        aria-label="Delete announcement"
                        title="Delete"
                        disabled={busy === item.id}
                        onClick={async () => {
                          const ok = await confirm({
                            title: "Delete this announcement?",
                            text: "It disappears for everyone in here.",
                            confirm: "Delete",
                            danger: true,
                          });
                          if (!ok) return;
                          setBusy(item.id);
                          try {
                            await deleteAnnouncement(item.id);
                            await onChanged();
                          } catch (error) {
                            toast.error(errorText(error, "Could not delete it."));
                          } finally {
                            setBusy(null);
                          }
                        }}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="sp-post-body" dir="auto">
                  {item.body}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
