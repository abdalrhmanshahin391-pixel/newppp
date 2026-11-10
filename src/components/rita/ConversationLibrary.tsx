import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Grid2X2, List, MessageCircle, Pin, Search } from "lucide-react";
import { useUiLanguage } from "@/components/language/useUiLanguage";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ConversationMenu } from "./ConversationMenu";
import type { RitaConversation } from "@/lib/rita-conversation";

type Props = {
  conversations: RitaConversation[];
  busy: boolean;
  isAdmin: boolean;
  userId: string;
  onRename: (conversation: RitaConversation, title: string) => Promise<void>;
  onPin: (conversation: RitaConversation) => Promise<void>;
  onDelete: (conversation: RitaConversation) => Promise<void>;
  onExport: (conversation: RitaConversation, format: "md" | "json" | "pdf" | "repair") => void;
  onTranscript: (conversation: RitaConversation) => void;
  pendingId: string;
  renderDetails: (conversation: RitaConversation) => ReactNode;
};

export function ConversationLibrary(props: Props) {
  const ui = useUiLanguage();
  const t = (en: string, ar: string) => (ui === "ar" ? ar : en);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [view, setView] = useState("list");
  const [action, setAction] = useState<{
    kind: "rename" | "delete";
    conversation: RitaConversation;
  } | null>(null);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const mutationLock = useRef(false);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const key = `uzyra-conversations-view:${props.userId}`;
  useEffect(() => {
    try {
      setView(localStorage.getItem(key) === "cards" ? "cards" : "list");
    } catch {
      /* Optional preference. */
    }
  }, [key]);
  const visible = useMemo(
    () =>
      props.conversations
        .filter((c) => c.title.toLocaleLowerCase(ui).includes(query.trim().toLocaleLowerCase(ui)))
        .sort((a, b) => {
          const pinned = Number(Boolean(b.pinned_at)) - Number(Boolean(a.pinned_at));
          if (pinned) return pinned;
          if (sort === "name") return a.title.localeCompare(b.title, ui);
          const delta =
            Date.parse(b.last_message_at ?? b.created_at) -
            Date.parse(a.last_message_at ?? a.created_at);
          return (sort === "oldest" ? -delta : delta) || a.id.localeCompare(b.id);
        }),
    [props.conversations, query, sort, ui],
  );
  async function submit() {
    if (!action || mutationLock.current) return;
    mutationLock.current = true;
    setSaving(true);
    setError("");
    try {
      if (action.kind === "rename") await props.onRename(action.conversation, title.trim());
      else await props.onDelete(action.conversation);
      setAction(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not save. Try again.", "تعذّر الحفظ. جرّب مرة ثانية."),
      );
    } finally {
      mutationLock.current = false;
      setSaving(false);
    }
  }
  return (
    <div dir={ui === "ar" ? "rtl" : "ltr"}>
      <div className="mt-7 flex flex-wrap items-center gap-3 border-b border-[var(--pp-line)] pb-5">
        <label className="flex min-h-11 min-w-0 basis-full flex-1 items-center sm:basis-0 gap-2 rounded-xl border border-[var(--pp-line)] px-3 focus-within:ring-2 focus-within:ring-black">
          <Search size={18} aria-hidden="true" />
          <input
            ref={searchInput}
            className="w-full min-w-0 bg-transparent py-2 text-base outline-none"
            aria-label={t("Search conversations", "ابحث في المحادثات")}
            placeholder={t("Search by title…", "ابحث باسم المحادثة…")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          style={{ width: "auto", maxWidth: "100%" }}
          aria-label={t("Sort conversations", "ترتيب المحادثات")}
          className="rita-select min-h-11 text-sm"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="recent">{t("Most recent", "الأحدث")}</option>
          <option value="oldest">{t("Oldest first", "الأقدم")}</option>
          <option value="name">{t("Name", "الاسم")}</option>
        </select>
        <div
          className="flex gap-1 rounded-xl border border-[var(--pp-line)] p-1"
          role="group"
          aria-label={t("Display", "طريقة العرض")}
        >
          {(["list", "cards"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-label={mode === "list" ? t("Compact list", "قائمة مدمجة") : t("Cards", "بطاقات")}
              aria-pressed={view === mode}
              className={`grid h-11 w-11 place-items-center rounded-lg ${view === mode ? "bg-black text-white" : "hover:bg-neutral-100"}`}
              onClick={() => {
                setView(mode);
                try {
                  localStorage.setItem(key, mode);
                } catch {
                  /* Optional preference. */
                }
              }}
            >
              {mode === "list" ? <List size={18} /> : <Grid2X2 size={18} />}
            </button>
          ))}
        </div>
      </div>
      <p className="my-4 text-sm text-[var(--pp-muted)]" role="status">
        {props.busy
          ? t("Loading conversations…", "جارٍ تحميل المحادثات…")
          : t(`${visible.length} conversations`, `${visible.length} محادثات`)}
      </p>
      <div
        className={
          view === "cards" ? "grid gap-4 md:grid-cols-2" : "divide-y divide-[var(--pp-line)]"
        }
      >
        {visible.map((conversation) => (
          <article
            key={conversation.id}
            className={view === "cards" ? "rounded-2xl border border-[var(--pp-line)] p-5" : "py-5"}
          >
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-neutral-100">
                <MessageCircle size={19} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  to="/rita-live"
                  search={{ conversation: conversation.id }}
                  className="block rounded text-start font-semibold hover:underline focus-visible:outline-2"
                >
                  <span dir="auto" className="block truncate">
                    {conversation.title}
                  </span>
                </Link>
                <p className="mt-1 text-sm text-[var(--pp-muted)]">
                  {new Intl.DateTimeFormat(ui, { dateStyle: "medium" }).format(
                    new Date(conversation.last_message_at ?? conversation.created_at),
                  )}{" "}
                  ·{" "}
                  {t(
                    `${conversation.message_count} messages`,
                    `${conversation.message_count} رسائل`,
                  )}
                </p>
              </div>
              {conversation.pinned_at && (
                <Pin size={15} aria-label={t("Pinned", "مثبّت")} className="shrink-0" />
              )}
              <ConversationMenu
                title={conversation.title}
                isAdmin={props.isAdmin}
                busy={props.pendingId === conversation.id || saving}
                pinned={Boolean(conversation.pinned_at)}
                onAction={(kind, trigger) => {
                  returnFocus.current = trigger;
                  setError("");
                  if (kind === "rename" || kind === "delete") {
                    setTitle(conversation.title);
                    setAction({ kind, conversation });
                  } else if (kind === "pin") {
                    if (mutationLock.current) return;
                    mutationLock.current = true;
                    setSaving(true);
                    void props
                      .onPin(conversation)
                      .catch((cause) =>
                        setError(cause instanceof Error ? cause.message : "Could not save pin."),
                      )
                      .finally(() => {
                        mutationLock.current = false;
                        setSaving(false);
                      });
                  } else if (kind === "transcript") props.onTranscript(conversation);
                  else props.onExport(conversation, kind);
                }}
              />
              <Link
                to="/rita-live"
                search={{ conversation: conversation.id }}
                aria-label={t(`Continue ${conversation.title}`, `كمّل ${conversation.title}`)}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-neutral-100"
              >
                <ArrowUpRight size={20} aria-hidden="true" />
              </Link>
            </div>
            {props.renderDetails(conversation)}
          </article>
        ))}
      </div>
      {!props.busy && !visible.length && (
        <div className="py-16 text-center">
          <MessageCircle size={32} className="mx-auto mb-4 text-neutral-400" />
          <h2 className="text-xl font-semibold">
            {query
              ? t("No matching conversations", "ما في محادثات بهذا الاسم")
              : t("Your next conversation starts here", "محادثتك الجاية بتبدأ هون")}
          </h2>
          <p className="mt-2 text-sm text-[var(--pp-muted)]">
            {query
              ? t("Try a different title or clear your search.", "جرّب اسم ثاني أو امسح البحث.")
              : t("Start a conversation using the button above.", "ابدأ محادثة من الزر بالأعلى.")}
          </p>
          {query && (
            <button className="rita-btn mt-4" onClick={() => setQuery("")}>
              {t("Clear search", "امسح البحث")}
            </button>
          )}
        </div>
      )}
      {error && !action && (
        <p role="alert" className="my-4 text-red-700">
          {error}
        </p>
      )}
      <Dialog
        open={Boolean(action)}
        onOpenChange={(open) => {
          if (!open && !saving) setAction(null);
        }}
      >
        <DialogContent
          dir={ui === "ar" ? "rtl" : "ltr"}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (returnFocus.current?.isConnected) {
              returnFocus.current.focus();
              return;
            }
            searchInput.current?.focus();
          }}
        >
          <DialogTitle>
            {action?.kind === "delete"
              ? t("Delete conversation?", "تحذف المحادثة؟")
              : t("Rename conversation", "غيّر اسم المحادثة")}
          </DialogTitle>
          <DialogDescription>
            {action?.kind === "delete"
              ? t(
                  `“${action.conversation.title}” and its saved messages will be permanently deleted.`,
                  `رح تنحذف «${action.conversation.title}» ورسائلها المحفوظة نهائيًا.`,
                )
              : t("Choose a name you can find easily later.", "اختار اسم يسهل ترجعله بعدين.")}
          </DialogDescription>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="space-y-4"
          >
            {action?.kind === "rename" && (
              <label className="block text-sm">
                {t("Conversation name", "اسم المحادثة")}
                <input
                  autoFocus
                  required
                  maxLength={120}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-2 min-h-11 w-full rounded-lg border p-3 text-base"
                />
              </label>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                className="rita-btn"
                onClick={() => setAction(null)}
              >
                {t("Cancel", "إلغاء")}
              </button>
              <button
                disabled={saving || (action?.kind === "rename" && !title.trim())}
                className={`rita-btn disabled:opacity-50 ${action?.kind === "delete" ? "bg-red-700 text-white" : "bg-black text-white"}`}
              >
                {saving
                  ? t("Saving…", "جارٍ الحفظ…")
                  : action?.kind === "delete"
                    ? t("Delete", "احذف")
                    : t("Save name", "احفظ الاسم")}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
