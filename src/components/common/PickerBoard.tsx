import { useMemo, useState, type ReactNode } from "react";
import { BookOpen, Check, ChevronDown, Flag, Loader2, Plus, Search, Trash2 } from "lucide-react";

/**
 * The shared "Archive questions" picker: a searchable subject list where each
 * subject opens into tickable sub-subjects. Every study mode uses this so the
 * whole app feels like one product.
 */
export type PickerItem = {
  id: string;
  name: string;
  count?: number;
  countLabel?: string;
  flags?: number;
  sample?: boolean;
  /** Can't be used by the current mode — shown dimmed and not tickable. */
  disabled?: boolean;
  /** Small line under the name, e.g. "12 playable here · 5 not for this lab". */
  note?: string;
};

export type PickerGroup = {
  id: string;
  name: string;
  color?: string;
  sample?: boolean;
  /** Shared read-only example — no adding, renaming or deleting. */
  locked?: boolean;
  count?: number;
  flags?: number;
  items: PickerItem[];
  /** Little "ready to play everywhere" style badge. */
  badge?: string;
  /** Readiness strip: one tiny bar per lab. */
  bars?: { label: string; value: number; total: number; color: string }[];
};

export function PickerBoard({
  accent,
  groups,
  selected,
  onToggle,
  loading = false,
  itemNoun = "sub-subject",
  unitNoun = "items",
  searchPlaceholder = "Search subjects…",
  onNewGroup,
  onNewItem,
  onAddContent,
  onAddToGroup,
  addLabel = "Add",
  emptyItemLabel = "Add your first list",
  newItemLabel,
  onDeleteGroup,
  onDeleteItem,
  emptyHint = "No subjects yet — create your first one.",
  chips,
  onSelectAll,
  onClearGroup,
  framed = true,
}: {
  accent: string;
  groups: PickerGroup[];
  selected: string[];
  onToggle: (id: string) => void;
  loading?: boolean;
  itemNoun?: string;
  unitNoun?: string;
  searchPlaceholder?: string;
  onNewGroup?: () => void;
  onNewItem?: (group: PickerGroup) => void;
  onAddContent?: (item: PickerItem, group: PickerGroup) => void;
  /** Add straight from the subject header — no need to open it first. */
  onAddToGroup?: (group: PickerGroup) => void;
  addLabel?: string;
  emptyItemLabel?: string;
  /** Label for the small "add a sub-subject" button in a subject header. */
  newItemLabel?: string;
  onDeleteGroup?: (group: PickerGroup) => void;
  onDeleteItem?: (item: PickerItem, group: PickerGroup) => void;
  emptyHint?: string;
  /** Extra filter buttons shown under the search row. */
  chips?: ReactNode;
  onSelectAll?: (group: PickerGroup) => void;
  onClearGroup?: (group: PickerGroup) => void;
  /** Draw the outer ink frame. Off when the page already sits on a board. */
  framed?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const list = useMemo(() => {
    if (!q) return groups;
    return groups
      .map((g) => {
        if (g.name.toLowerCase().includes(q)) return g;
        const items = g.items.filter((t) => t.name.toLowerCase().includes(q));
        return items.length ? { ...g, items } : null;
      })
      .filter(Boolean) as PickerGroup[];
  }, [groups, q]);

  return (
    <div className={framed ? "rounded-[24px] border-2 border-[#121117] bg-card p-3 sm:p-5" : ""}>
      <div
        data-tour="subject-shelf-header"
        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 pb-3"
      >
        <div className="flex min-w-0 items-center gap-2 rounded-lg border-2 border-[#121117] bg-white px-4 py-3">
          <Search size={17} className="shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-transparent text-[16px] font-medium text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        {onNewGroup && (
          <button
            onClick={onNewGroup}
            className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-lg border-2 border-[#121117] px-5 text-[15px] font-semibold text-white transition hover:bg-[#2260e4]"
            style={{ background: "#2b6df0" }}
          >
            <Plus size={15} /> New
          </button>
        )}
      </div>

      {chips && <div className="flex flex-wrap items-center gap-2 pb-3">{chips}</div>}

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-[#6a697c]">
          <Loader2 className="animate-spin" size={16} /> Loading…
        </div>
      ) : list.length === 0 ? (
        <p className="py-8 text-center text-[14px] font-bold text-[#6a697c]">
          {q ? "Nothing matches that." : emptyHint}
        </p>
      ) : (
        <div className="max-h-[64vh] space-y-3 overflow-y-auto pr-1">
          {list.map((g) => {
            const isOpen = open === g.id || (!!q && g.items.length > 0);
            const picked = g.items.filter((t) => selected.includes(t.id)).length;
            return (
              <section
                key={g.id}
                className="overflow-hidden rounded-2xl border-2 border-[#121117] bg-card"
              >
                <header
                  className="flex min-h-20 cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-cream"
                  onClick={() => setOpen(open === g.id ? null : g.id)}
                >
                  <BookOpen size={20} className="shrink-0 text-[#4b4a5c]" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 break-words text-[18px] font-bold leading-snug text-foreground">
                      {g.name}
                    </div>
                    <div className="mt-0.5 text-[13.5px] font-medium text-[#4b4a5c]">
                      {picked} of {g.items.length} {itemNoun}
                      {g.items.length === 1 ? "" : "s"} selected
                      {typeof g.count === "number" && (
                        <>
                          {" "}
                          · {g.count} {unitNoun}
                        </>
                      )}
                    </div>
                    {!!g.bars?.length && (
                      <div className="mt-1.5 flex items-center gap-2">
                        {g.bars.map((b) => (
                          <span
                            key={b.label}
                            className="flex items-center gap-1"
                            title={`${b.value} of ${b.total} ready for ${b.label}`}
                          >
                            <span className="block h-1.5 w-9 overflow-hidden rounded-full bg-cream-deep">
                              <span
                                className="block h-full rounded-full"
                                style={{
                                  width: `${b.total ? Math.round((b.value / b.total) * 100) : 0}%`,
                                  background: b.color,
                                }}
                              />
                            </span>
                            <span className="text-[12px] font-bold tracking-wide text-[#4b4a5c]">
                              {b.label}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {g.badge && (
                    <span className="hidden shrink-0 rounded-full bg-[#e8f5e9] px-2.5 py-0.5 text-[12px] font-bold text-[#2e7d32] sm:inline">
                      {g.badge}
                    </span>
                  )}
                  {!!g.flags && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#fdecef] px-2 py-0.5 text-[12.5px] font-bold text-[#b3213f]">
                      <Flag size={11} /> {g.flags}
                    </span>
                  )}
                  {onNewItem && !g.locked && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNewItem(g);
                      }}
                      className="inline-flex min-h-11 shrink-0 touch-manipulation items-center gap-1.5 rounded-lg border-2 border-[#121117] bg-card px-3 text-[13.5px] font-semibold text-foreground transition hover:bg-[#e7eefd] active:scale-[0.98]"
                    >
                      <Plus size={12} /> {newItemLabel ?? itemNoun}
                    </button>
                  )}
                  {onAddToGroup && !g.locked && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddToGroup(g);
                      }}
                      className="inline-flex min-h-11 shrink-0 touch-manipulation items-center gap-1.5 rounded-lg px-3 text-[13.5px] font-semibold text-white transition hover:brightness-110 active:scale-[0.98]"
                      style={{ background: "#2b6df0" }}
                    >
                      <Plus size={12} /> {addLabel}
                    </button>
                  )}

                  {g.sample && (
                    <span className="shrink-0 rounded-full bg-[#e8f5e9] px-2 py-0.5 text-[12px] font-bold text-[#2e7d32]">
                      sample
                    </span>
                  )}
                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-[#6a697c] transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </header>

                {isOpen && (
                  <div className="space-y-2 border-t border-border bg-cream-deep/35 p-3">
                    {g.items.length === 0 &&
                      ((onNewItem || onAddToGroup) && !g.locked ? (
                        <button
                          onClick={() => (onNewItem ? onNewItem(g) : onAddToGroup?.(g))}
                          className="m-2 inline-flex h-11 w-[calc(100%-1rem)] items-center justify-center gap-2 rounded-2xl border border-dashed border-[#121117] text-[13px] font-extrabold text-[#6a697c] hover:bg-[#ffffff]"
                        >
                          <Plus size={14} /> {emptyItemLabel}
                        </button>
                      ) : (
                        <p className="px-3 py-3 text-[12.5px] font-semibold italic text-[#6a697c]">
                          Nothing inside yet.
                        </p>
                      ))}

                    {g.items.map((t, ti) => {
                      const on = selected.includes(t.id);
                      const pick = () => {
                        if (!t.disabled) onToggle(t.id);
                      };
                      return (
                        <div
                          key={t.id}
                          role="button"
                          tabIndex={0}
                          aria-disabled={t.disabled || undefined}
                          onClick={pick}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") pick();
                          }}
                          className={`flex min-h-[72px] items-center gap-2.5 rounded-2xl border border-border bg-card py-2 pl-4 pr-2 transition-colors duration-150 ${
                            t.disabled ? "opacity-55" : "cursor-pointer hover:border-[#121117]"
                          } ${on ? "border-[#121117] bg-[#e7eefd]" : ""}`}
                        >
                          <span className="w-6 shrink-0 text-[12.5px] font-bold tabular-nums text-[#4b4a5c]">
                            {String(ti + 1).padStart(2, "0")}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              pick();
                            }}
                            aria-pressed={on}
                            aria-label={`Select ${t.name}`}
                            disabled={t.disabled}
                            className="-ml-1 grid h-11 w-11 shrink-0 touch-manipulation place-items-center"
                          >
                            <span
                              className="grid h-6 w-6 place-items-center rounded-md border-2 border-[#121117] transition-colors duration-150"
                              style={{ background: on ? "#2b6df0" : "#ffffff" }}
                            >
                              {on && <Check size={14} className="text-white" strokeWidth={3.5} />}
                            </span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              pick();
                            }}
                            className="min-w-0 flex-1 text-left"
                          >
                            <span className="line-clamp-2 break-words text-[16px] font-bold leading-snug text-foreground">
                              {t.name}
                            </span>
                            <span className="mt-0.5 block text-[13.5px] font-medium text-[#4b4a5c]">
                              {t.countLabel ?? `${t.count ?? 0} ${unitNoun}`}
                              {!!t.flags && (
                                <span className="text-[#b3213f]"> · {t.flags} flagged</span>
                              )}
                            </span>
                            {t.note && (
                              <span className="mt-1 block text-[13px] font-medium text-[#4b4a5c]">
                                {t.note}
                              </span>
                            )}
                          </button>
                          {onAddContent && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onAddContent(t, g);
                              }}
                              className="inline-flex min-h-11 shrink-0 touch-manipulation items-center gap-1.5 rounded-lg border-2 border-[#121117] bg-white px-3 text-[13.5px] font-semibold text-[#121117] transition hover:bg-[#e7eefd] active:scale-[0.98]"
                            >
                              <Plus size={12} /> {addLabel}
                            </button>
                          )}
                          {onDeleteItem && !t.sample && !g.locked && (
                            <button
                              onClick={() => onDeleteItem(t, g)}
                              aria-label={`Delete ${t.name}`}
                              className="grid h-11 w-11 shrink-0 touch-manipulation place-items-center rounded-lg text-[#4b4a5c] transition hover:bg-[#fdecef] hover:text-[#b3213f]"
                            >
                              <Trash2 size={17} />
                            </button>
                          )}
                        </div>
                      );
                    })}

                    <div className="mt-1 flex items-center gap-2 px-2 py-1">
                      {onNewItem && !g.locked && (
                        <button
                          onClick={() => onNewItem(g)}
                          className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold text-[#4b4a5c] hover:text-[#121117]"
                        >
                          <Plus size={13} /> {itemNoun}
                        </button>
                      )}
                      {onSelectAll && g.items.some((t) => !t.disabled) && (
                        <button
                          onClick={() => onSelectAll(g)}
                          className="min-h-11 text-[14px] font-semibold text-[#4b4a5c] hover:text-[#121117]"
                        >
                          Select all
                        </button>
                      )}
                      {onClearGroup && g.items.some((t) => selected.includes(t.id)) && (
                        <button
                          onClick={() => onClearGroup(g)}
                          className="min-h-11 text-[14px] font-semibold text-[#4b4a5c] hover:text-[#121117]"
                        >
                          Clear
                        </button>
                      )}
                      {onDeleteGroup && !g.sample && !g.locked && (
                        <button
                          onClick={() => onDeleteGroup(g)}
                          className="ml-auto min-h-11 text-[13.5px] font-semibold text-[#4b4a5c] hover:text-[#b3213f]"
                        >
                          Delete subject
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
