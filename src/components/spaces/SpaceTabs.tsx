// The sections of a classroom or group as a row of pills that stays under the top bar while you
// scroll (the open one is the black pill, as on the home page). Arrow keys move between them; on
// phones the row scrolls sideways and keeps the open pill in view. Opening a section while scrolled
// down brings its top back up under the row, so it never opens half-way down.
import { useEffect, useRef, type KeyboardEvent } from "react";
import type { LucideIcon } from "lucide-react";

export type SpaceTab =
  | "overview"
  | "decks"
  | "questions"
  | "members"
  | "news"
  | "chat"
  | "settings";

export const SPACE_TABS: SpaceTab[] = [
  "overview",
  "decks",
  "questions",
  "members",
  "news",
  "chat",
  "settings",
];

/** The top bar's height plus a little air: where the row of pills sticks. */
const STUCK_AT = 64;

export type TabItem = { id: SpaceTab; label: string; icon: LucideIcon; count?: number | null };

export function SpaceTabs({
  tabs,
  current,
  onChange,
}: {
  tabs: TabItem[];
  current: SpaceTab;
  onChange: (tab: SpaceTab) => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  // Where the row sits before it sticks (the row itself reports its stuck position).
  const anchor = useRef<HTMLDivElement>(null);
  const buttons = useRef<Partial<Record<SpaceTab, HTMLButtonElement | null>>>({});

  // Keep the open pill in view inside the sideways-scrolling row (never scrolls the page).
  useEffect(() => {
    const box = list.current;
    const button = buttons.current[current];
    if (!box || !button) return;
    const start = button.offsetLeft - 16;
    const end = button.offsetLeft + button.offsetWidth + 16;
    if (start < box.scrollLeft) box.scrollTo({ left: start, behavior: "smooth" });
    else if (end > box.scrollLeft + box.clientWidth)
      box.scrollTo({ left: end - box.clientWidth, behavior: "smooth" });
  }, [current]);

  function select(id: SpaceTab) {
    onChange(id);
    const mark = anchor.current;
    if (!mark) return;
    // The row has a 12px margin above it.
    const top = mark.getBoundingClientRect().top + window.scrollY + 12 - STUCK_AT;
    if (window.scrollY > top) window.scrollTo({ top });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const at = tabs.findIndex((tab) => tab.id === current);
    let next = -1;
    if (event.key === "ArrowRight") next = (at + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (at - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    event.preventDefault();
    const id = tabs[next]!.id;
    select(id);
    buttons.current[id]?.focus();
  }

  return (
    <>
      <div ref={anchor} aria-hidden="true" />
      <div className="sp-tabs-wrap">
        <div
          ref={list}
          className="sp-tabs"
          role="tablist"
          aria-label="Sections"
          onKeyDown={onKeyDown}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const on = tab.id === current;
            return (
              <button
                key={tab.id}
                id={`sp-tab-${tab.id}`}
                ref={(element) => {
                  buttons.current[tab.id] = element;
                }}
                type="button"
                role="tab"
                className="sp-tab"
                aria-selected={on}
                aria-controls="sp-panel"
                tabIndex={on ? 0 : -1}
                onClick={() => select(tab.id)}
              >
                <Icon size={16} aria-hidden="true" />
                {tab.label}
                {typeof tab.count === "number" && tab.count > 0 && (
                  <span className="sp-tab-n">{tab.count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
