// «My conversations» list in the home page's look (conversations.css): one head with the count,
// a search pill and two pill switches (order, list or cards), then the conversations grouped by
// time (pinned, today, this week, earlier) as rows or as white cards. The title is the link and
// covers the whole row; the ⋯ menu sits above it.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, AudioLines, Grid2X2, List, Loader2, Plus, Search, X } from "lucide-react";
import { useUiLanguage } from "@/components/language/useUiLanguage";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { RitaCube } from "@/components/rita-study/RitaCube";
import { ConversationMenu } from "./ConversationMenu";
import {
  conversationCount,
  conversationDate,
  conversationTitle,
  conversationWhen,
  messageCount,
  numberLocale,
} from "./conversation-labels";
import type { RitaConversation } from "@/lib/rita-conversation";
import "./conversations.css";

type Props = {
  conversations: RitaConversation[];
  busy: boolean;
  isAdmin: boolean;
  userId: string;
  creating: boolean;
  onNew: () => void;
  onRename: (conversation: RitaConversation, title: string) => Promise<void>;
  onPin: (conversation: RitaConversation) => Promise<void>;
  onDelete: (conversation: RitaConversation) => Promise<void>;
  onExport: (conversation: RitaConversation, format: "md" | "json" | "pdf" | "repair") => void;
  onTranscript: (conversation: RitaConversation) => void;
  pendingId: string;
  renderDetails: (conversation: RitaConversation) => ReactNode;
};

type Sort = "recent" | "oldest" | "name";
type Group = { id: string; label: string; items: RitaConversation[] };

const DAY = 86_400_000;

export function ConversationLibrary(props: Props) {
  const ui = useUiLanguage();
  const t = (en: string, ar: string) => (ui === "ar" ? ar : en);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [view, setView] = useState<"list" | "cards">("list");
  const [action, setAction] = useState<{
    kind: "rename" | "delete";
    conversation: RitaConversation;
  } | null>(null);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const mutationLock = useRef(false);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const cubeLevels = useRef({ input: 0, output: 0 });
  const [error, setError] = useState("");
  const key = `uzyra-conversations-view:${props.userId}`;
  useEffect(() => {
    try {
      setView(localStorage.getItem(key) === "cards" ? "cards" : "list");
    } catch {
      /* Optional preference. */
    }
  }, [key]);

  const nameOf = (conversation: RitaConversation) => conversationTitle(conversation, ui);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(ui);
    return props.conversations
      .filter((c) => conversationTitle(c, ui).toLocaleLowerCase(ui).includes(needle))
      .sort((a, b) => {
        const pinned = Number(Boolean(b.pinned_at)) - Number(Boolean(a.pinned_at));
        if (pinned) return pinned;
        if (sort === "name")
          return conversationTitle(a, ui).localeCompare(conversationTitle(b, ui), ui);
        const delta = conversationWhen(b) - conversationWhen(a);
        return (sort === "oldest" ? -delta : delta) || a.id.localeCompare(b.id);
      });
  }, [props.conversations, query, sort, ui]);

  // Pinned first; by time only when the newest come first (the other orders are one run).
  const groups = useMemo<Group[]>(() => {
    const pinned: Group = { id: "pinned", label: t("Pinned", "مثبّتة"), items: [] };
    const today: Group = { id: "today", label: t("Today", "اليوم"), items: [] };
    const week: Group = { id: "week", label: t("This week", "هالأسبوع"), items: [] };
    const earlier: Group = { id: "earlier", label: t("Earlier", "قبل هيك"), items: [] };
    const all: Group = { id: "all", label: t("All conversations", "كل المحادثات"), items: [] };
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const startOfDay = midnight.getTime();
    for (const conversation of visible) {
      if (conversation.pinned_at) pinned.items.push(conversation);
      else if (sort !== "recent") all.items.push(conversation);
      else {
        const when = conversationWhen(conversation);
        if (when >= startOfDay) today.items.push(conversation);
        else if (when >= startOfDay - 6 * DAY) week.items.push(conversation);
        else earlier.items.push(conversation);
      }
    }
    const list = [pinned, today, week, earlier, all].filter((group) => group.items.length);
    // A single unnamed run needs no heading.
    if (list.length === 1 && list[0].id === "all") list[0].label = "";
    return list;
    // t follows ui, which is in the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, sort, ui]);

  function chooseView(mode: "list" | "cards") {
    setView(mode);
    try {
      localStorage.setItem(key, mode);
    } catch {
      /* Optional preference. */
    }
  }

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

  const total = props.conversations.length;
  const loading = props.busy && !total;
  const SORTS: { id: Sort; label: string }[] = [
    { id: "recent", label: t("Recent", "الأحدث") },
    { id: "oldest", label: t("Oldest", "الأقدم") },
    { id: "name", label: t("A–Z", "الاسم") },
  ];

  return (
    <section className="cv-section" aria-labelledby="cv-mine" dir={ui === "ar" ? "rtl" : "ltr"}>
      <div className="cv-head">
        <div className="cv-head-title">
          <h2 id="cv-mine" className="cv-h2">
            {t("Your conversations", "محادثاتك")}
          </h2>
          {total > 0 && <span className="cv-n">{total.toLocaleString(numberLocale(ui))}</span>}
        </div>
        {total > 0 && (
          <div className="cv-tools">
            <label className="cv-search">
              <Search size={17} aria-hidden="true" />
              <input
                ref={searchInput}
                type="search"
                aria-label={t("Search conversations", "ابحث في المحادثات")}
                placeholder={t("Search by title", "ابحث باسم المحادثة")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  type="button"
                  className="cv-icon-btn cv-search-clear"
                  aria-label={t("Clear search", "امسح البحث")}
                  onClick={() => {
                    setQuery("");
                    searchInput.current?.focus();
                  }}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </label>
            <div className="cv-seg" role="group" aria-label={t("Order", "الترتيب")}>
              {SORTS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={sort === item.id}
                  onClick={() => setSort(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div
              className="cv-seg cv-seg-icons"
              role="group"
              aria-label={t("Display", "طريقة العرض")}
            >
              {(["list", "cards"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-label={mode === "list" ? t("List", "قائمة") : t("Cards", "بطاقات")}
                  aria-pressed={view === mode}
                  onClick={() => chooseView(mode)}
                >
                  {mode === "list" ? (
                    <List size={18} aria-hidden="true" />
                  ) : (
                    <Grid2X2 size={17} aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="sr-only" role="status">
        {loading
          ? t("Loading conversations…", "جارٍ تحميل المحادثات…")
          : conversationCount(visible.length, ui)}
      </p>

      {loading && (
        <div className="cv-groups" aria-hidden="true">
          <div className={view === "cards" ? "cv-grid" : "cv-list"}>
            {[0, 1, 2, 3].map((n) => (
              <div key={n} className="cv-bone-row">
                <span className="cv-bone cv-bone-mark" />
                <div>
                  <span className="cv-bone cv-bone-title" />
                  <span className="cv-bone cv-bone-line" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && groups.length > 0 && (
        <div className="cv-groups">
          {groups.map((group) => (
            <div key={group.id} role="group" aria-label={group.label || undefined}>
              {group.label && (
                <h3 className="cv-group-title">
                  {group.label}
                  <span className="cv-n">
                    {group.items.length.toLocaleString(numberLocale(ui))}
                  </span>
                </h3>
              )}
              <div className={view === "cards" ? "cv-grid" : "cv-list"}>
                {group.items.map((conversation) => {
                  const name = nameOf(conversation);
                  const empty = conversation.message_count === 0;
                  return (
                    <article
                      key={conversation.id}
                      className="cv-item"
                      data-empty={empty ? "true" : undefined}
                    >
                      <span className="cv-mark" aria-hidden="true">
                        <AudioLines size={view === "cards" ? 20 : 18} strokeWidth={1.8} />
                      </span>
                      <Link
                        to="/rita-live"
                        search={{ conversation: conversation.id }}
                        className="cv-open"
                      >
                        <span className="cv-title" dir="auto">
                          {name}
                        </span>
                        <span className="cv-meta">
                          <span>{conversationDate(conversation, ui, group.id === "today")}</span>
                          <span className="cv-dot" aria-hidden="true" />
                          {empty ? (
                            <span className="cv-chip">{t("Not started", "ما بلّشت")}</span>
                          ) : (
                            <span>{messageCount(conversation.message_count, ui)}</span>
                          )}
                        </span>
                      </Link>
                      <div className="cv-actions">
                        <ConversationMenu
                          title={name}
                          isAdmin={props.isAdmin}
                          busy={props.pendingId === conversation.id || saving}
                          pinned={Boolean(conversation.pinned_at)}
                          triggerClassName="cv-icon-btn"
                          contentClassName="cv cv-menu"
                          onAction={(kind, trigger) => {
                            returnFocus.current = trigger;
                            setError("");
                            if (kind === "rename" || kind === "delete") {
                              setTitle(name);
                              setAction({ kind, conversation });
                            } else if (kind === "pin") {
                              if (mutationLock.current) return;
                              mutationLock.current = true;
                              setSaving(true);
                              void props
                                .onPin(conversation)
                                .catch((cause) =>
                                  setError(
                                    cause instanceof Error
                                      ? cause.message
                                      : t("Could not save the pin.", "ما زبط التثبيت."),
                                  ),
                                )
                                .finally(() => {
                                  mutationLock.current = false;
                                  setSaving(false);
                                });
                            } else if (kind === "transcript") props.onTranscript(conversation);
                            else props.onExport(conversation, kind);
                          }}
                        />
                        <span className="cv-go" aria-hidden="true">
                          <ArrowUpRight size={17} />
                        </span>
                      </div>
                      <div className="cv-details">{props.renderDetails(conversation)}</div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {!props.busy && !total && (
        <div className="cv-empty">
          <span className="cv-empty-cube" aria-hidden="true">
            <RitaCube levelsRef={cubeLevels} mode="idle" label="" />
          </span>
          <h3 className="cv-empty-title">
            {t("Your first conversation starts here", "محادثتك الأولى بتبدأ هون")}
          </h3>
          <p className="cv-empty-text">
            {t(
              "Talk with Uzyra about anything. Every conversation is saved here, ready to continue.",
              "احكي مع يوزرا عن أي إشي. كل محادثة بتنحفظ هون وبتقدر تكمّلها وقت ما بدك.",
            )}
          </p>
          <button
            type="button"
            className="cv-btn cv-btn-dark"
            onClick={props.onNew}
            disabled={props.creating}
          >
            {props.creating ? (
              <Loader2 size={18} className="cv-spin" aria-hidden="true" />
            ) : (
              <Plus size={18} aria-hidden="true" />
            )}
            {t("Start a conversation", "ابدأ محادثة")}
          </button>
        </div>
      )}

      {!props.busy && total > 0 && !visible.length && (
        <div className="cv-empty cv-empty-sm">
          <h3 className="cv-empty-title">
            {t("No conversation with that name", "ما في محادثة بهالاسم")}
          </h3>
          <p className="cv-empty-text">
            {t("Try another word, or clear the search.", "جرّب كلمة ثانية، أو امسح البحث.")}
          </p>
          <button type="button" className="cv-btn cv-btn-light" onClick={() => setQuery("")}>
            {t("Clear search", "امسح البحث")}
          </button>
        </div>
      )}

      {error && !action && (
        <p role="alert" className="cv-note">
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
          className="cv cv-dialog"
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
          <DialogTitle className="cv-dialog-title">
            {action?.kind === "delete"
              ? t("Delete conversation?", "تحذف المحادثة؟")
              : t("Rename conversation", "غيّر اسم المحادثة")}
          </DialogTitle>
          <DialogDescription className="cv-dialog-text">
            {action?.kind === "delete"
              ? t(
                  `“${nameOf(action.conversation)}” and its saved messages will be permanently deleted.`,
                  `رح تنحذف «${nameOf(action.conversation)}» ورسائلها المحفوظة نهائيًا.`,
                )
              : t("Choose a name you can find easily later.", "اختار اسم يسهل ترجعله بعدين.")}
          </DialogDescription>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {action?.kind === "rename" && (
              <label className="cv-label">
                {t("Conversation name", "اسم المحادثة")}
                <input
                  autoFocus
                  required
                  maxLength={120}
                  dir="auto"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="cv-input"
                />
              </label>
            )}
            {error && (
              <p role="alert" className="cv-note">
                {error}
              </p>
            )}
            <div className="cv-dialog-actions">
              <button
                type="button"
                disabled={saving}
                className="cv-btn cv-btn-light"
                onClick={() => setAction(null)}
              >
                {t("Cancel", "إلغاء")}
              </button>
              <button
                disabled={saving || (action?.kind === "rename" && !title.trim())}
                className={`cv-btn ${action?.kind === "delete" ? "cv-btn-danger" : "cv-btn-dark"}`}
              >
                {saving && <Loader2 size={17} className="cv-spin" aria-hidden="true" />}
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
    </section>
  );
}
