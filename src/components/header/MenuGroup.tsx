import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type MutableRefObject,
  type ReactNode,
  type FocusEvent as ReactFocusEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  highlightBox,
  MOTION,
  neighbourMenu,
  nextItem,
  orderByPosition,
  originSide,
  paneSlot,
  panelLeft,
  slideOffset,
  type ItemKey,
} from "./menu-motion";
import "./header-menus.css";

/**
 * The header's menus share one panel under the bar. It opens with a soft fade and scale; going
 * from one menu to the next it moves along the bar and resizes to fit, the old content sliding out
 * and the new sliding in; and a grey highlight glides between the items. Menus keep their own
 * state and content: each one hands its content to MenuPanel, which draws it inside the shared
 * panel (through a portal), so nothing about how a menu works has to change.
 *
 *  - Click opens a menu; with a menu open, pointing at another trigger switches to it.
 *  - `hoverOpen` groups (the navigation) also open when the pointer rests on a trigger and close
 *    when it leaves, unless the trigger was clicked (which keeps it open).
 *  - Keys: ↓/↑ open a menu and move through its items (Home/End too), ←/→ switch menu, Esc closes
 *    and returns focus to the trigger. A press outside, or tabbing away, closes it.
 *  - Reduced motion: only a short fade.
 */

type Entry = {
  id: string;
  getTrigger: () => HTMLElement | null;
  setOpen: (open: boolean) => void;
};

type How = "hover" | "click" | "key";

type GroupApi = {
  active: string | null;
  hoverOpen: boolean;
  stage: HTMLElement | null;
  slot: (id: string) => "active" | "before" | "after";
  register: (entry: Entry) => () => void;
  /** How the open menu was opened (hover menus close on leave; clicked ones stay). */
  how: MutableRefObject<How | null>;
  /** The menu that was open before this render, for panes that arrive mid-switch. */
  previous: MutableRefObject<string | null>;
  focusRequest: MutableRefObject<{ id: string; which: "first" | "last" } | null>;
  reportSize: (id: string, width: number, height: number) => void;
  closeActive: () => void;
};

const GroupContext = createContext<GroupApi | null>(null);

export function useInMenuGroup() {
  return useContext(GroupContext) !== null;
}

const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

/** What counts as an item in a panel: marked ones, and the shared menu rows (.rh-item). */
const ITEM_SEL = "[data-mp-item], .rh-item";
const ITEM = "[data-mp-item]:not([disabled]), .rh-item:not([disabled])";

export function MenuGroup({
  as = "div",
  active,
  align = "end",
  hoverOpen = false,
  className = "",
  label,
  children,
}: {
  as?: "div" | "nav";
  /** The id of the open menu in this group, or null. The parent owns this state. */
  active: string | null;
  /** Which edge of the panel hangs from the trigger's edge. */
  align?: "start" | "end";
  hoverOpen?: boolean;
  className?: string;
  label?: string;
  children: ReactNode;
}) {
  const root = useRef<HTMLElement | null>(null);
  const surface = useRef<HTMLDivElement>(null);
  const highlight = useRef<HTMLDivElement>(null);
  const entries = useRef(new Map<string, Entry>());
  const how = useRef<How | null>(null);
  const previous = useRef<string | null>(null);
  const focusRequest = useRef<{ id: string; which: "first" | "last" } | null>(null);
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const [sizes, setSizes] = useState<Record<string, { w: number; h: number }>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [x, setX] = useState(0);
  const [rtl, setRtl] = useState(false);
  const [motion, setMotion] = useState(false);
  const frames = useRef<number[]>([]);
  useEffect(() => () => frames.current.forEach((frame) => cancelAnimationFrame(frame)), []);
  const lastActive = useRef<string | null>(null);
  if (active) lastActive.current = active;
  const shown = active ?? lastActive.current;

  const register = useCallback((entry: Entry) => {
    entries.current.set(entry.id, entry);
    return () => {
      if (entries.current.get(entry.id) === entry) entries.current.delete(entry.id);
    };
  }, []);

  const reportSize = useCallback((id: string, width: number, height: number) => {
    setSizes((current) => {
      const now = current[id];
      return now && now.w === width && now.h === height
        ? current
        : { ...current, [id]: { w: width, h: height } };
    });
  }, []);

  const closeActive = useCallback(() => {
    if (active) entries.current.get(active)?.setOpen(false);
  }, [active]);

  const ids = useCallback(() => {
    const list: { id: string; left: number }[] = [];
    for (const entry of entries.current.values()) {
      const trigger = entry.getTrigger();
      if (trigger) list.push({ id: entry.id, left: trigger.getBoundingClientRect().left });
    }
    return orderByPosition(list);
  }, []);

  // Changes of menu: what moved, and where the panel hangs.
  useLayoutEffect(() => {
    const was = previous.current;
    if (active) {
      setOrder(ids());
      setRtl(root.current ? getComputedStyle(root.current).direction === "rtl" : false);
    }
    if (was === null && active !== null) {
      // Opening from shut: appear in place, then let later moves glide.
      setMotion(false);
      frames.current.forEach((frame) => cancelAnimationFrame(frame));
      const first = requestAnimationFrame(() => {
        frames.current.push(requestAnimationFrame(() => setMotion(true)));
      });
      frames.current = [first];
      previous.current = active;
      resetHighlight();
      return;
    }
    if (active !== was) resetHighlight();
    previous.current = active;
    // Runs when the open menu changes; `ids` and the highlight reset only read refs and the DOM.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const size = shown ? sizes[shown] : undefined;
  useLayoutEffect(() => {
    if (!shown || !size) return;
    const place = () => {
      const trigger = entries.current.get(shown)?.getTrigger();
      const group = root.current;
      if (!trigger || !group) return;
      const t = trigger.getBoundingClientRect();
      const g = group.getBoundingClientRect();
      setX(
        panelLeft({
          align,
          rtl,
          trigger: { left: t.left, top: t.top, width: t.width, height: t.height },
          group: { left: g.left, top: g.top, width: g.width, height: g.height },
          panelWidth: size.w,
          viewportWidth: document.documentElement.clientWidth,
        }),
      );
    };
    place();
    if (!active) return;
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [shown, size, align, rtl, active]);

  // ---- The highlight.
  const hl = useRef<{ item: Element | null; visible: boolean; timer: number }>({
    item: null,
    visible: false,
    timer: 0,
  });
  function resetHighlight() {
    const el = highlight.current;
    window.clearTimeout(hl.current.timer);
    hl.current.item = null;
    hl.current.visible = false;
    if (el) {
      el.style.transition = "none";
      el.style.opacity = "0";
    }
  }
  function pointAt(item: Element | null) {
    const el = highlight.current;
    const box = surface.current;
    if (!el || !box) return;
    if (item === hl.current.item) return;
    hl.current.item = item;
    window.clearTimeout(hl.current.timer);
    if (!item) {
      hl.current.timer = window.setTimeout(() => {
        el.style.transition = `opacity ${MOTION.leaveFade}ms ease`;
        el.style.opacity = "0";
        hl.current.visible = false;
      }, MOTION.leave);
      return;
    }
    const s = box.getBoundingClientRect();
    const i = item.getBoundingClientRect();
    const scale = box.offsetWidth > 0 ? s.width / box.offsetWidth : 1;
    const b = highlightBox(
      { left: i.left, top: i.top, width: i.width, height: i.height },
      { left: s.left, top: s.top, width: s.width, height: s.height },
      scale,
    );
    const set = () => {
      el.style.left = `${b.left}px`;
      el.style.top = `${b.top}px`;
      el.style.width = `${b.width}px`;
      el.style.height = `${b.height}px`;
    };
    if (hl.current.visible) {
      el.style.transition = `left ${MOTION.glide}ms ${MOTION.easeOut}, top ${MOTION.glide}ms ${MOTION.easeOut}, width ${MOTION.glide}ms ${MOTION.easeOut}, height ${MOTION.glide}ms ${MOTION.easeOut}, opacity ${MOTION.glideFade}ms ease`;
      el.style.opacity = "1";
      set();
    } else {
      el.style.transition = "none";
      set();
      void el.getBoundingClientRect();
      el.style.transition = `opacity ${MOTION.glideFade}ms ease`;
      el.style.opacity = "1";
    }
    hl.current.visible = true;
  }

  // Native listeners: a menu's content reaches the panel through a portal, and React would
  // deliver its events through the menu's own parents instead of through the panel.
  useEffect(() => {
    const box = surface.current;
    if (!box) return;
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      pointAt((event.target as Element).closest?.(ITEM_SEL) ?? null);
    };
    const leave = () => pointAt(null);
    const focus = (event: FocusEvent) => {
      const item = (event.target as Element).closest?.(ITEM_SEL) ?? null;
      if (item && item.matches(":focus-visible")) pointAt(item);
    };
    box.addEventListener("pointermove", move);
    box.addEventListener("pointerleave", leave);
    box.addEventListener("focusin", focus);
    return () => {
      box.removeEventListener("pointermove", move);
      box.removeEventListener("pointerleave", leave);
      box.removeEventListener("focusin", focus);
    };
  }, []);

  // ---- Closing and keys.
  useEffect(() => {
    if (!active) {
      how.current = null;
      return;
    }
    const close = () => entries.current.get(active)?.setOpen(false);
    const away = (event: MouseEvent | TouchEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const trigger = entries.current.get(active)?.getTrigger();
      const inside = root.current?.contains(document.activeElement);
      close();
      if (inside) trigger?.focus();
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("touchstart", away, { passive: true });
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("touchstart", away);
      document.removeEventListener("keydown", escape);
    };
  }, [active]);

  const focusItem = (which: "first" | "last" | number) => {
    const pane = root.current?.querySelector<HTMLElement>(`[data-mp-pane][data-active="true"]`);
    const items = pane ? Array.from(pane.querySelectorAll<HTMLElement>(ITEM)) : [];
    if (items.length === 0) return;
    const at = typeof which === "number" ? which : which === "first" ? 0 : items.length - 1;
    items[at]?.focus();
  };

  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (!active || isEditable(event.target)) return;
    const key = event.key;
    if (key === "ArrowLeft" || key === "ArrowRight") {
      const next = neighbourMenu(ids(), active, key);
      if (!next) return;
      event.preventDefault();
      focusRequest.current = null;
      const entry = entries.current.get(next);
      entry?.setOpen(true);
      entry?.getTrigger()?.focus();
      return;
    }
    if (key === "ArrowDown" || key === "ArrowUp" || key === "Home" || key === "End") {
      const pane = root.current?.querySelector<HTMLElement>(`[data-mp-pane][data-active="true"]`);
      const items = pane ? Array.from(pane.querySelectorAll<HTMLElement>(ITEM)) : [];
      if (items.length === 0) return;
      event.preventDefault();
      const current = items.indexOf(document.activeElement as HTMLElement);
      const to = nextItem(current, items.length, key as ItemKey);
      if (to >= 0) items[to].focus();
    }
  };

  const onBlur = (event: ReactFocusEvent) => {
    const to = event.relatedTarget as Node | null;
    // Tabbing away closes it. (A press inside the panel can report no related element, so that
    // case is left to the outside-press rule above.)
    if (active && to && root.current && !root.current.contains(to)) closeActive();
  };

  const onPointerLeave = (event: ReactPointerEvent) => {
    if (event.pointerType === "mouse" && hoverOpen && how.current === "hover") closeActive();
  };

  const slot = useCallback(
    (id: string) => {
      const index = order.indexOf(id);
      const activeIndex = order.indexOf(shown ?? "");
      return index < 0 || activeIndex < 0 ? "active" : paneSlot(index, activeIndex);
    },
    [order, shown],
  );

  const api = useMemo<GroupApi>(
    () => ({
      active,
      hoverOpen,
      stage,
      slot,
      register,
      how,
      previous,
      focusRequest,
      reportSize,
      closeActive,
    }),
    [active, hoverOpen, stage, slot, register, reportSize, closeActive],
  );

  // Menus ask to have their first or last item focused once their pane is there.
  useEffect(() => {
    if (!active) return;
    const request = focusRequest.current;
    if (request && request.id === active) {
      focusRequest.current = null;
      requestAnimationFrame(() => focusItem(request.which));
    }
  }, [active]);

  const style = {
    "--mp-x": `${x}px`,
    "--mp-w": size ? `${size.w}px` : "0px",
    "--mp-h": size ? `${size.h}px` : "0px",
  } as CSSProperties;

  return (
    <GroupContext.Provider value={api}>
      {createElement(
        as,
        {
          ref: root,
          className: `uz-mp-group ${className}`,
          "aria-label": label,
          onKeyDown,
          onBlur,
          onPointerLeave,
        },
        children,
        <div
          className="uz-mp-host"
          data-state={active ? "open" : "closed"}
          data-motion={motion ? "on" : "off"}
          data-origin={originSide(align, rtl)}
          style={style}
        >
          <div ref={surface} className="uz-mp-surface">
            <span className="uz-mp-bridge" aria-hidden="true" />
            <div className="uz-mp-box">
              <div ref={highlight} className="uz-mp-hl" aria-hidden="true" />
              <div ref={setStage} className="uz-mp-stage" />
            </div>
          </div>
        </div>,
      )}
    </GroupContext.Provider>
  );
}

/** The trigger's behaviour: click, hover, and the keys that open a menu. */
export function useMenuTrigger({
  id,
  open,
  onOpenChange,
}: {
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const group = useContext(GroupContext);
  const trigger = useRef<HTMLElement | null>(null);
  const setOpen = useRef(onOpenChange);
  setOpen.current = onOpenChange;
  const register = group?.register;

  useEffect(() => {
    if (!register) return;
    return register({
      id,
      getTrigger: () => trigger.current,
      setOpen: (value) => setOpen.current(value),
    });
  }, [register, id]);

  const onClick = () => {
    if (!group) {
      onOpenChange(!open);
      return;
    }
    if (open) {
      // Opened by pointing, then clicked: keep it open. Clicked again: close it.
      if (group.how.current === "hover") group.how.current = "click";
      else onOpenChange(false);
      return;
    }
    group.how.current = "click";
    onOpenChange(true);
  };

  const onPointerEnter = (event: ReactPointerEvent) => {
    if (!group || event.pointerType !== "mouse" || group.active === id) return;
    if (group.active !== null) {
      onOpenChange(true);
    } else if (group.hoverOpen) {
      group.how.current = "hover";
      onOpenChange(true);
    }
  };

  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (!group) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      group.focusRequest.current = { id, which: event.key === "ArrowDown" ? "first" : "last" };
      if (open) {
        const pane = (event.currentTarget as HTMLElement)
          .closest(".uz-mp-group")
          ?.querySelector<HTMLElement>(`[data-mp-pane="${id}"]`);
        const items = pane ? Array.from(pane.querySelectorAll<HTMLElement>(ITEM)) : [];
        group.focusRequest.current = null;
        (event.key === "ArrowDown" ? items[0] : items[items.length - 1])?.focus();
      } else {
        group.how.current = "key";
        onOpenChange(true);
      }
    }
  };

  return {
    ref: (el: HTMLElement | null) => {
      trigger.current = el;
    },
    onClick,
    onPointerEnter,
    onKeyDown,
  };
}

/** Keeps something drawn for a while after it is told to go, so it can finish its exit. */
function useLingering(open: boolean, ms: number) {
  const [mounted, setMounted] = useState(open);
  useLayoutEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const timer = window.setTimeout(() => setMounted(false), ms);
    return () => window.clearTimeout(timer);
  }, [open, ms]);
  return open || mounted;
}

/**
 * A menu's content. In a group it is drawn inside the shared panel; on its own (a phone sheet, a
 * page without a group) it is a plain card under its trigger, as before.
 */
export function MenuPanel({
  id,
  open,
  panelId,
  width,
  label,
  fallbackClassName,
  children,
}: {
  id: string;
  open: boolean;
  panelId: string;
  /** The content's width in the shared panel (px). */
  width: number;
  label?: string;
  fallbackClassName: string;
  children: ReactNode;
}) {
  const group = useContext(GroupContext);
  if (!group) {
    return open ? (
      <div id={panelId} className={fallbackClassName} aria-label={label}>
        {children}
      </div>
    ) : null;
  }
  return (
    <GroupPane id={id} open={open} panelId={panelId} width={width} label={label} group={group}>
      {children}
    </GroupPane>
  );
}

function GroupPane({
  id,
  open,
  panelId,
  width,
  label,
  group,
  children,
}: {
  id: string;
  open: boolean;
  panelId: string;
  width: number;
  label?: string;
  group: GroupApi;
  children: ReactNode;
}) {
  const present = useLingering(open, MOTION.slide + 60);
  // A pane that arrives while another menu is open starts off to one side and slides in.
  const [armed, setArmed] = useState(true);
  const previous = group.previous;
  const pane = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const before = previous.current;
    if (before !== null && before !== id) {
      setArmed(false);
      const frame = requestAnimationFrame(() => setArmed(true));
      return () => cancelAnimationFrame(frame);
    }
    setArmed(true);
  }, [open, id, previous]);

  const { reportSize } = group;
  useLayoutEffect(() => {
    const el = pane.current;
    if (!el || !present) return;
    const measure = () => reportSize(id, el.offsetWidth, el.offsetHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [present, id, reportSize]);

  if (!present || !group.stage) return null;

  const activeNow = open && armed;
  let slotName: "active" | "before" | "after";
  if (open) {
    if (armed) {
      slotName = "active";
    } else {
      // Arriving from the side opposite to where the old pane is leaving to.
      const before = group.previous.current;
      slotName = before && group.slot(before) === "before" ? "after" : "before";
    }
  } else {
    slotName = group.active ? group.slot(id) : "active";
  }
  const offset = slideOffset(slotName);

  return createPortal(
    <div
      ref={pane}
      id={panelId}
      role="group"
      aria-label={label}
      data-mp-pane={id}
      data-slot={slotName}
      data-active={activeNow ? "true" : undefined}
      className="uz-mp-pane"
      inert={!activeNow}
      style={
        {
          width,
          translate: `${offset}px 0`,
          opacity: activeNow ? 1 : 0,
          "--mp-slide": `${MOTION.slide}ms`,
        } as CSSProperties
      }
    >
      {children}
    </div>,
    group.stage,
  );
}
