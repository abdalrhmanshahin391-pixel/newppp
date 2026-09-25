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
    <div className="rounded-3xl border border-border bg-card p-3 shadow-sm sm:p-5">
      <div data-tour="subject-shelf-header" className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 pb-3">
        <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-cream px-4 py-3">
          <Search size={17} className="shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-transparent text-[15px] font-bold text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        {onNewGroup && (
          <button
            onClick={onNewGroup}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-2xl px-5 text-[14px] font-extrabold text-primary-foreground transition hover:brightness-110"
            style={{ background: accent }}
          >
            <Plus size={15} /> New
          </button>
        )}
      </div>

      {chips && <div className="flex flex-wrap items-center gap-2 pb-3">{chips}</div>}

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-[#6b645b]">
          <Loader2 className="animate-spin" size={16} /> Loading…
        </div>
      ) : list.length === 0 ? (
        <p className="py-8 text-center text-[14px] font-bold text-[#a89e90]">
          {q ? "Nothing matches that." : emptyHint}
        </p>
      ) : (
        <div className="max-h-[64vh] space-y-3 overflow-y-auto pr-1">
          {list.map((g) => {
            const isOpen = open === g.id || (!!q && g.items.length > 0);
            const picked = g.items.filter((t) => selected.includes(t.id)).length;
            return (
              <section key={g.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                <header
                  className="flex min-h-20 cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-cream"
                  onClick={() => setOpen(open === g.id ? null : g.id)}
                >
                  <span
                    className="h-13 w-1.5 shrink-0 rounded-full"
                    style={{ background: g.color ?? accent }}
                  />
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cream text-muted-foreground">
                    <BookOpen size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[18px] font-black text-foreground">{g.name}</div>
                    <div className="mt-0.5 text-[13px] font-semibold text-muted-foreground">
                      {picked} of {g.items.length} {itemNoun}
                      {g.items.length === 1 ? "" : "s"} selected
                      {typeof g.count === "number" && <> · {g.count} {unitNoun}</>}
                    </div>
                    {!!g.bars?.length && (
                      <div className="mt-1.5 flex items-center gap-2">
                        {g.bars.map((b) => (
                          <span key={b.label} className="flex items-center gap-1" title={`${b.value} of ${b.total} ready for ${b.label}`}>
                            <span className="block h-1.5 w-9 overflow-hidden rounded-full bg-cream-deep">
                              <span
                                className="block h-full rounded-full"
                                style={{
                                  width: `${b.total ? Math.round((b.value / b.total) * 100) : 0}%`,
                                  background: b.color,
                                }}
                              />
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                              {b.label}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {g.badge && (
                    <span className="hidden shrink-0 rounded-full bg-[#eaf4e2] px-2.5 py-0.5 text-[10.5px] font-black text-[#4b7a33] sm:inline">
                      {g.badge}
                    </span>
                  )}
                  {!!g.flags && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#fbdcdc] px-2 py-0.5 text-[11.5px] font-black text-[#8f2323]">
                      <Flag size={11} /> {g.flags}
                    </span>
                  )}
                  {onNewItem && !g.locked && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNewItem(g);
                      }}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-black/10 bg-card px-3 py-1.5 text-[11.5px] font-extrabold text-foreground transition hover:bg-cream"
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
                      className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[11.5px] font-extrabold text-white transition hover:brightness-110"
                      style={{ background: accent }}
                    >
                      <Plus size={12} /> {addLabel}
                    </button>
                  )}

                  {g.sample && (
                    <span className="shrink-0 rounded-full bg-[#eaf4e2] px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-[#4b7a33]">
                      sample
                    </span>
                  )}
                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-[#a89e90] transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </header>

                {isOpen && (
                  <div className="space-y-2 border-t border-border bg-cream-deep/35 p-3">
                    {g.items.length === 0 &&
                      ((onNewItem || onAddToGroup) && !g.locked ? (
                        <button
                          onClick={() => (onNewItem ? onNewItem(g) : onAddToGroup?.(g))}
                          className="m-2 inline-flex h-11 w-[calc(100%-1rem)] items-center justify-center gap-2 rounded-2xl border border-dashed border-black/15 text-[13px] font-extrabold text-[#6b645b] hover:bg-[#faf6ee]"
                        >
                          <Plus size={14} /> {emptyItemLabel}
                        </button>
                      ) : (
                        <p className="px-3 py-3 text-[12.5px] font-semibold italic text-[#a89e90]">
                          Nothing inside yet.
                        </p>
                      ))}

                    {g.items.map((t, ti) => {
                      const on = selected.includes(t.id);
                      const pick = () => { if (!t.disabled) onToggle(t.id); };
                      return (
                        <div
                          key={t.id}
                          role="button"
                          tabIndex={0}
                          aria-disabled={t.disabled || undefined}
                          onClick={pick}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") pick(); }}
                          className={`flex min-h-20 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition-all duration-150 ${
                            t.disabled
                              ? "opacity-55"
                              : "hover:-translate-y-0.5 hover:shadow-sm"
                          }`}
                        >
                          <span className="w-7 shrink-0 text-[12px] font-black tabular-nums text-muted-foreground">
                            {String(ti + 1).padStart(2, "0")}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); pick(); }}
                            aria-pressed={on}
                            disabled={t.disabled}
                            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 transition-colors duration-150"
                            style={{
                              borderColor: on ? accent : "#d9d2c6",
                              background: on ? accent : "transparent",
                            }}
                          >
                            {on && <Check size={15} className="text-primary-foreground" strokeWidth={3.5} />}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); pick(); }} className="min-w-0 flex-1 text-left">
                            <span className="block truncate text-[16px] font-extrabold text-foreground">
                              {t.name}
                            </span>
                            <span className="mt-1 block text-[13px] font-semibold text-muted-foreground">
                              {t.countLabel ?? `${t.count ?? 0} ${unitNoun}`}
                              {!!t.flags && <span className="text-[#b13636]"> · {t.flags} flagged</span>}
                            </span>
                            {t.note && (
                              <span className="mt-1 block text-[12px] font-bold text-[#b0a696]">{t.note}</span>
                            )}
                          </button>
                          {onAddContent && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onAddContent(t, g); }}
                              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#f3ece0] px-3 py-1.5 text-[11.5px] font-extrabold text-[#5a4a2e] transition hover:bg-[#e9dfcd]"
                            >
                              <Plus size={12} /> {addLabel}
                            </button>
                          )}
                          {onDeleteItem && !t.sample && !g.locked && (
                            <button
                              onClick={() => onDeleteItem(t, g)}
                              aria-label={`Delete ${t.name}`}
                              className="shrink-0 text-[#c6bfb4] transition hover:text-[#b13636]"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      );
                    })}

                    <div className="mt-1 flex items-center gap-2 px-2 py-1">
                      {onNewItem && !g.locked && (
                        <button
                          onClick={() => onNewItem(g)}
                          className="inline-flex items-center gap-1.5 text-[12.5px] font-extrabold text-[#6b645b] hover:text-[#23201d]"
                        >
                          <Plus size={13} /> {itemNoun}
                        </button>
                      )}
                      {onSelectAll && g.items.some((t) => !t.disabled) && (
                        <button
                          onClick={() => onSelectAll(g)}
                          className="text-[12.5px] font-extrabold text-[#6b645b] hover:text-[#23201d]"
                        >
                          Select all
                        </button>
                      )}
                      {onClearGroup && g.items.some((t) => selected.includes(t.id)) && (
                        <button
                          onClick={() => onClearGroup(g)}
                          className="text-[12.5px] font-extrabold text-[#6b645b] hover:text-[#23201d]"
                        >
                          Clear
                        </button>
                      )}
                      {onDeleteGroup && !g.sample && !g.locked && (
                        <button
                          onClick={() => onDeleteGroup(g)}
                          className="ml-auto text-[11.5px] font-bold text-[#b8b0a4] hover:text-[#b13636]"
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
