// The chat of a classroom or group (only when its owners turned it on). Messages run like a
// messenger: yours on the right in ink, others on the left with their picture and name, grouped by
// day and by person. It follows new messages while you are at the bottom, and offers a jump back
// when you have scrolled up. Enter sends, Shift + Enter makes a new line.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, MessageCircle } from "lucide-react";
import { sendMessage, useSpaceMessages, type SpaceMember, type SpaceMessage } from "@/lib/spaces";
import { MemberAvatar } from "./MemberRow";
import { Spin, errorText } from "./shared";
import { clockTime, dayKey, dayLabel, fullDate } from "./time";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
const RUN_GAP = 5 * 60_000;

type Run = { key: string; author: string; mine: boolean; items: SpaceMessage[] };
type Day = { key: string; label: string; runs: Run[] };

function group(list: SpaceMessage[], meId: string): Day[] {
  const days: Day[] = [];
  for (const message of list) {
    const key = dayKey(message.created_at);
    let day = days[days.length - 1];
    if (!day || day.key !== key) {
      day = { key, label: dayLabel(message.created_at), runs: [] };
      days.push(day);
    }
    const run = day.runs[day.runs.length - 1];
    const last = run?.items[run.items.length - 1];
    const close =
      last &&
      new Date(message.created_at).getTime() - new Date(last.created_at).getTime() < RUN_GAP;
    if (run && run.author === message.author_id && close) {
      run.items.push(message);
    } else {
      day.runs.push({
        key: message.id,
        author: message.author_id,
        mine: message.author_id === meId,
        items: [message],
      });
    }
  }
  return days;
}

export function ChatTab({
  spaceId,
  members,
  meId,
  onSent,
}: {
  spaceId: string;
  members: SpaceMember[];
  meId: string;
  onSent: () => Promise<void>;
}) {
  const messages = useSpaceMessages(spaceId, true);
  const list = useMemo(() => messages.data ?? [], [messages.data]);
  const days = useMemo(() => group(list, meId), [list, meId]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const atBottom = useRef(true);
  const seen = useRef(0);
  const person = (id: string) => members.find((m) => m.user_id === id);

  // First load, and every new message while you are at the bottom: stay at the bottom.
  useIsoLayoutEffect(() => {
    const box = log.current;
    if (!box) return;
    const added = list.length - seen.current;
    if (seen.current === 0 || atBottom.current) {
      box.scrollTop = box.scrollHeight;
      setUnseen(0);
    } else if (added > 0) {
      setUnseen((n) => n + added);
    }
    seen.current = list.length;
  }, [list]);

  function onScroll() {
    const box = log.current;
    if (!box) return;
    atBottom.current = box.scrollHeight - box.scrollTop - box.clientHeight < 56;
    if (atBottom.current && unseen) setUnseen(0);
  }

  function toBottom() {
    const box = log.current;
    box?.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
    atBottom.current = true;
    setUnseen(0);
  }

  function fit() {
    const box = input.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${Math.min(box.scrollHeight, 148)}px`;
  }

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await sendMessage(spaceId, body);
      setText("");
      requestAnimationFrame(fit);
      atBottom.current = true;
      await onSent();
    } catch (error) {
      toast.error(errorText(error, "Could not send. Your message is still in the box."));
    } finally {
      setSending(false);
      input.current?.focus();
    }
  }

  return (
    <div className="sp-chat">
      <div
        ref={log}
        className="sp-chat-log"
        onScroll={onScroll}
        role="log"
        aria-live="polite"
        aria-label="Messages"
        tabIndex={0}
      >
        {messages.isLoading ? (
          <div className="sp-chat-state" aria-busy="true">
            <span className="sp-bone sp-bone-bubble" />
            <span className="sp-bone sp-bone-bubble sp-bone-right" />
            <span className="sp-bone sp-bone-bubble" />
          </div>
        ) : messages.isError ? (
          <p className="sp-state-text" role="alert">
            The chat could not be loaded. Refresh the page to try again.
          </p>
        ) : list.length === 0 ? (
          <div className="sp-chat-empty">
            <span className="sp-empty-icon" aria-hidden="true">
              <MessageCircle size={22} />
            </span>
            <p className="sp-empty-title">No messages yet</p>
            <p className="sp-empty-text">Say hello. Everyone in here can read the chat.</p>
          </div>
        ) : (
          days.map((day) => (
            <div key={day.key} className="sp-chat-dayblock">
              <p className="sp-chat-day">
                <span>{day.label}</span>
              </p>
              {day.runs.map((run) => {
                const author = person(run.author);
                const name = author?.username ?? "former member";
                const last = run.items[run.items.length - 1]!;
                return (
                  <div key={run.key} className={`sp-run${run.mine ? " is-mine" : ""}`}>
                    {!run.mine && (
                      <MemberAvatar path={author?.avatar_url ?? null} name={name} size={32} />
                    )}
                    <div className="sp-run-body">
                      {!run.mine && (
                        <p className="sp-run-name" dir="auto">
                          @{name}
                        </p>
                      )}
                      {run.items.map((message) => (
                        <p
                          key={message.id}
                          className="sp-bubble"
                          dir="auto"
                          title={fullDate(message.created_at)}
                        >
                          {message.body}
                        </p>
                      ))}
                      <p className="sp-run-time">
                        <time dateTime={last.created_at}>{clockTime(last.created_at)}</time>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {unseen > 0 && (
        <button type="button" className="sp-chat-jump" onClick={toBottom}>
          <ArrowDown size={15} aria-hidden="true" />
          {unseen === 1 ? "1 new message" : `${unseen} new messages`}
        </button>
      )}

      <form
        className="sp-chat-compose"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <label htmlFor="sp-chat-input" className="sp-sr">
          Message
        </label>
        <textarea
          id="sp-chat-input"
          ref={input}
          rows={1}
          value={text}
          maxLength={2000}
          placeholder="Write a message"
          dir="auto"
          onChange={(event) => {
            setText(event.target.value);
            fit();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <button
          type="submit"
          className="sp-btn sp-btn-dark sp-btn-icon"
          aria-label="Send"
          disabled={sending || !text.trim()}
        >
          {sending ? <Spin /> : <ArrowUp size={18} aria-hidden="true" />}
        </button>
      </form>
    </div>
  );
}
