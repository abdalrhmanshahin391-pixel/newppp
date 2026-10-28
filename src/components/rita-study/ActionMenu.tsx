import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  BookOpenText,
  ChevronDown,
  Languages,
  ListTree,
  MessageCircleQuestion,
  Move,
  PanelLeftClose,
  RotateCcw,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";
import { ACTION_INFO, type SelectionKind, type StudyAction } from "@/lib/study/study-actions";
import { MAX_NOTE_CHARS } from "@/lib/study/study-limits";

const ICONS: Record<StudyAction, typeof Sparkles> = {
  explain: MessageCircleQuestion,
  simplify: Sparkles,
  meaning: Volume2,
  explain_back: RotateCcw,
  compare_arabic: Languages,
  word_by_word: ListTree,
  common_mistake: AlertTriangle,
  summarize_section: BookOpenText,
  report: AlertTriangle,
};

const KIND_LABEL: Record<SelectionKind, string> = {
  word: "كلمة",
  phrase: "عبارة",
  sentence: "جملة",
  rule: "قاعدة",
  table_cells: "خلايا من جدول",
  multi_block: "أكثر من جزء",
  arabic_only: "شرح عربي",
  too_long: "تحديد كبير",
  non_text: "",
};

function Row({
  action,
  onPick,
  disabled,
}: {
  action: StudyAction;
  onPick: (action: StudyAction) => void;
  disabled?: boolean;
}) {
  const Icon = ICONS[action];
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => onPick(action)}
      className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-start text-[15px] font-semibold text-[var(--pp-ink)] transition-colors hover:bg-[var(--pp-grey)] focus-visible:bg-[var(--pp-grey)] focus-visible:outline-none disabled:opacity-50"
    >
      <Icon size={18} aria-hidden="true" className="shrink-0 text-[var(--pp-accent-text)]" />
      {ACTION_INFO[action].label}
    </button>
  );
}

/**
 * The menu over the guide. With a selection: the quote, then "Explain" and "Simplify" first and the
 * rest under "More", only what fits the selection. Without one: help with the section in view.
 */
export function ActionMenu({
  quote,
  kind,
  sectionLabel,
  actions,
  hasSelection,
  busy,
  onPick,
  onReport,
  onClear,
  onMoveOrb,
  onPinOrb,
  onResetOrb,
  onClose,
}: {
  quote: string;
  kind: SelectionKind | null;
  sectionLabel: string;
  actions: StudyAction[];
  hasSelection: boolean;
  busy: boolean;
  onPick: (action: StudyAction) => void;
  onReport: (note: string) => void;
  onClear: () => void;
  onMoveOrb: () => void;
  onPinOrb: () => void;
  onResetOrb: () => void;
  onClose: () => void;
}) {
  const [more, setMore] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [note, setNote] = useState("");
  const primary = actions.filter((action) => ACTION_INFO[action].primary);
  const secondary = actions.filter((action) => !ACTION_INFO[action].primary && action !== "report");

  if (reporting) {
    return (
      <form
        className="space-y-2 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          onReport(note.trim());
        }}
      >
        <p className="text-[15px] font-bold">في غلط بهالجزء؟</p>
        <p className="line-clamp-2 text-[13px] text-[var(--pp-muted)]" dir="auto">
          «{quote}»
        </p>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value.slice(0, MAX_NOTE_CHARS))}
          rows={3}
          autoFocus
          placeholder="شو الغلط؟ (اختياري)"
          className="w-full rounded-xl border border-[var(--pp-line)] p-2 text-[16px]"
        />
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="rita-btn rita-btn-primary rita-btn-sm">
            ابعت البلاغ
          </button>
          <button
            type="button"
            onClick={() => setReporting(false)}
            className="rita-btn rita-btn-quiet rita-btn-sm"
          >
            رجوع
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="w-[min(20rem,calc(100vw-2rem))]" role="menu" aria-label="شو بدك نعمل؟">
      {hasSelection ? (
        <div className="flex items-start gap-2 border-b border-[var(--pp-line)] p-3">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[15px] font-semibold" dir="auto">
              «{quote.length > 80 ? `${quote.slice(0, 80)}…` : quote}»
            </p>
            <p className="mt-0.5 text-[12.5px] text-[var(--pp-muted)]">
              {[sectionLabel, kind ? KIND_LABEL[kind] : ""].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClear}
            aria-label="امسح التحديد"
            className="rita-btn rita-btn-quiet rita-btn-sm !h-9 !w-9 !px-0"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <p className="border-b border-[var(--pp-line)] p-3 text-[14px] text-[var(--pp-muted)]">
          حدّد كلمة أو جملة من الدرس، وبعدين اكبس على الدائرة.
        </p>
      )}

      <div className="p-1.5">
        {kind === "too_long" && (
          <p className="px-3 py-2 text-[14px] text-[#6b4100]">
            التحديد كبير. حدّد جزء أصغر، أو بلّغ إذا في غلط.
          </p>
        )}
        {kind === "non_text" && (
          <p className="px-3 py-2 text-[14px] text-[var(--pp-muted)]">حدّد كلام من الدرس.</p>
        )}
        {!hasSelection && sectionLabel && (
          <Row action="summarize_section" onPick={onPick} disabled={busy} />
        )}
        {primary.map((action) => (
          <Row key={action} action={action} onPick={onPick} disabled={busy} />
        ))}
        {secondary.length > 0 && (
          <>
            <button
              type="button"
              aria-expanded={more}
              onClick={() => setMore((value) => !value)}
              className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-start text-[15px] font-semibold text-[var(--pp-muted)] hover:bg-[var(--pp-grey)]"
            >
              <ChevronDown
                size={18}
                aria-hidden="true"
                className={`shrink-0 transition-transform duration-200 ${more ? "rotate-180" : ""}`}
              />
              المزيد
            </button>
            {more &&
              secondary.map((action) => (
                <Row key={action} action={action} onPick={onPick} disabled={busy} />
              ))}
          </>
        )}
        {actions.includes("report") && (
          <button
            type="button"
            onClick={() => setReporting(true)}
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-start text-[14px] text-[var(--pp-muted)] hover:bg-[var(--pp-grey)]"
          >
            <AlertTriangle size={16} aria-hidden="true" className="shrink-0" />
            في غلط بالدرس؟
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1 border-t border-[var(--pp-line)] p-1.5">
        <button
          type="button"
          onClick={onMoveOrb}
          className="rita-btn rita-btn-quiet rita-btn-sm gap-1.5 !h-9"
        >
          <Move size={14} aria-hidden="true" /> انقل الدائرة
        </button>
        <button
          type="button"
          onClick={onPinOrb}
          className="rita-btn rita-btn-quiet rita-btn-sm gap-1.5 !h-9"
        >
          <PanelLeftClose size={14} aria-hidden="true" /> ثبّتها عالطرف
        </button>
        <button
          type="button"
          onClick={onResetOrb}
          className="rita-btn rita-btn-quiet rita-btn-sm gap-1.5 !h-9"
        >
          <ArrowLeftRight size={14} aria-hidden="true" /> رجّعها لمكانها
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rita-btn rita-btn-quiet rita-btn-sm ms-auto !h-9"
        >
          سكّر
        </button>
      </div>
    </div>
  );
}
