import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  Check,
  Eraser,
  Ellipsis,
  Move,
  PanelLeftClose,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { layoutRadial, nearestSlot } from "./radial-layout";
import type { RadialItem } from "./radial-items";
import { ReportForm } from "./ReportForm";
import { confirmSound, menuCloseSound, menuOpenSound, optionNote } from "./tech-sound";

export type RadialHandle = {
  /** The finger or pen is held down on the circle and moving: light up the option it is over. */
  hover: (clientX: number, clientY: number) => void;
  /** It was let go: choose the option it is over, if any. */
  release: (clientX: number, clientY: number) => void;
};

type Geometry = { cx: number; cy: number; w: number; h: number; left: number; top: number };

const MORE: RadialItem = { id: "__more", label: "المزيد", Icon: Ellipsis };

/**
 * The round menu: the options open out around the circle like petals, joined to it by thin wires,
 * each playing a note as you pass over it. Tap the circle then an option, or hold the circle, slide
 * to an option and let go. Keys: arrows move between options, Enter chooses, Esc closes. It picks
 * the part of the ring that stays on screen, and moves extra options to a second page.
 */
export const RadialMenu = forwardRef<
  RadialHandle,
  {
    open: boolean;
    containerRef: RefObject<HTMLElement | null>;
    orbRef: RefObject<HTMLButtonElement | null>;
    /** Changes whenever the circle moves, so the ring follows it. */
    orbKey: string;
    items: RadialItem[];
    quote: string;
    meta: string;
    hasSelection: boolean;
    hint: string;
    canReport: boolean;
    busy: boolean;
    sound: boolean;
    autoFocus: boolean;
    onToggleSound: () => void;
    onPick: (id: string) => void;
    onReport: (note: string) => void;
    onClear: () => void;
    onMoveOrb: () => void;
    onPinOrb: () => void;
    onResetOrb: () => void;
    onClose: () => void;
  }
>(function RadialMenu(props, ref) {
  const { open, containerRef, orbRef, orbKey, items, onClose } = props;
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  const [geom, setGeom] = useState<Geometry | null>(null);
  const [page, setPage] = useState(0);
  const [hot, setHot] = useState(-1);
  const [picked, setPicked] = useState("");
  const [reporting, setReporting] = useState(false);
  const [still, setStill] = useState(false);
  const hotRef = useRef(-1);
  const wasOpen = useRef(false);
  const closeTimer = useRef<number | undefined>(undefined);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // Opening mounts it, then the next frame lets the petals grow; closing shrinks them back first.
  useEffect(() => {
    if (open) {
      window.clearTimeout(closeTimer.current);
      setMounted(true);
      setPage(0);
      setHot(-1);
      hotRef.current = -1;
      setPicked("");
      setReporting(false);
      let second = 0;
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => setShown(true));
      });
      if (!wasOpen.current) menuOpenSound();
      wasOpen.current = true;
      return () => {
        cancelAnimationFrame(first);
        cancelAnimationFrame(second);
      };
    }
    if (wasOpen.current) menuCloseSound();
    wasOpen.current = false;
    setShown(false);
    closeTimer.current = window.setTimeout(() => setMounted(false), still ? 0 : 420);
    return () => window.clearTimeout(closeTimer.current);
  }, [open, still]);

  const measure = useCallback(() => {
    const container = containerRef.current;
    const orb = orbRef.current;
    if (!container || !orb) return;
    const c = container.getBoundingClientRect();
    const o = orb.getBoundingClientRect();
    setGeom({
      cx: o.left + o.width / 2 - c.left,
      cy: o.top + o.height / 2 - c.top,
      w: c.width,
      h: c.height,
      left: c.left,
      top: c.top,
    });
  }, [containerRef, orbRef]);

  useLayoutEffect(() => {
    if (!mounted) return;
    measure();
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [mounted, orbKey, measure, containerRef]);

  // Which options fit around the ring; the rest wait on a second page behind "more".
  const topReserve = geom && geom.w < 560 ? 150 : 96;
  const base = geom
    ? layoutRadial({
        cx: geom.cx,
        cy: geom.cy,
        width: geom.w,
        height: geom.h,
        count: items.length,
        topReserve,
      })
    : null;
  const paged = Boolean(base && items.length > base.capacity);
  const per = paged && base ? Math.max(1, base.capacity - 1) : items.length;
  const pages = Math.max(1, Math.ceil(items.length / Math.max(per, 1)));
  const visible = useMemo(
    () => (paged ? [...items.slice(page * per, (page + 1) * per), MORE] : items),
    [paged, items, page, per],
  );
  const layout =
    geom && paged
      ? layoutRadial({
          cx: geom.cx,
          cy: geom.cy,
          width: geom.w,
          height: geom.h,
          count: visible.length,
          topReserve,
        })
      : base;

  const choose = useCallback(
    (item: RadialItem) => {
      if (item.disabled) return;
      if (item.id === MORE.id) {
        optionNote(4);
        setPage((value) => (value + 1) % pages);
        return;
      }
      confirmSound();
      if (item.placeholder) {
        toast("هاد خيار تجريبي، بتعبيه لما تقرر شو بدك فيه.");
        onClose();
        return;
      }
      setPicked(item.id);
      props.onPick(item.id);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pages, onClose, props.onPick],
  );

  const light = useCallback((index: number) => {
    if (hotRef.current === index) return;
    hotRef.current = index;
    setHot(index);
    if (index >= 0) optionNote(index);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      hover: (x, y) => {
        if (!geom || !layout) return;
        light(nearestSlot(layout.slots, x - geom.left - geom.cx, y - geom.top - geom.cy));
      },
      release: (x, y) => {
        if (!geom || !layout) return;
        const index = nearestSlot(layout.slots, x - geom.left - geom.cx, y - geom.top - geom.cy);
        hotRef.current = -1;
        setHot(-1);
        const item = index >= 0 ? visible[index] : null;
        if (item) choose(item);
      },
    }),
    [geom, layout, light, visible, choose],
  );

  useEffect(() => {
    if (shown && props.autoFocus) buttons.current[0]?.focus();
  }, [shown, props.autoFocus]);

  if (!mounted || !geom || !layout) return null;
  const { cx, cy, w, h } = geom;
  const radius = layout.radius;

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      orbRef.current?.focus();
      return;
    }
    const count = visible.length;
    const at = buttons.current.findIndex((node) => node === document.activeElement);
    const go = (to: number) => {
      event.preventDefault();
      const next = (to + count) % count;
      buttons.current[next]?.focus();
      light(next);
    };
    if (event.key === "ArrowRight" || event.key === "ArrowDown") go(at + 1);
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") go(at < 0 ? count - 1 : at - 1);
    else if (event.key === "Home") go(0);
    else if (event.key === "End") go(count - 1);
  };

  const tool = (
    label: string,
    Icon: typeof X,
    onClick: () => void,
    extra?: { pressed?: boolean },
  ) => (
    <button
      type="button"
      className="st-rad-tool"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={extra?.pressed}
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  );

  return (
    <div
      className={`st-rad${shown ? " is-shown" : ""}${reporting ? " is-report" : ""}`}
      dir="rtl"
      style={{ ["--n" as string]: visible.length }}
      onKeyDown={onKeyDown}
    >
      <div
        className="st-rad-scrim"
        onPointerDown={onClose}
        style={{
          background: `radial-gradient(circle at ${cx}px ${cy}px, rgb(8 16 40 / 0.62) 0, rgb(8 16 40 / 0.4) ${radius + 70}px, rgb(8 16 40 / 0) ${radius + 200}px)`,
        }}
      />
      <svg className="st-rad-lines" width={w} height={h} aria-hidden="true">
        <circle cx={cx} cy={cy} r={radius} className="st-rad-orbit" />
        {layout.slots.slice(0, visible.length).map((slot, i) => (
          <line
            key={`s${i}`}
            className="st-rad-spoke"
            x1={cx}
            y1={cy}
            x2={cx + slot.x}
            y2={cy + slot.y}
            pathLength={1}
            style={{ ["--i" as string]: i }}
          />
        ))}
        {!still &&
          shown &&
          layout.slots.slice(0, visible.length).map((slot, i) => (
            <circle key={`b${i}`} r="2.2" className="st-rad-bit" cx={cx} cy={cy}>
              <animateMotion
                dur="2.2s"
                begin={`${0.5 + i * 0.23}s`}
                repeatCount="indefinite"
                path={`M0,0 L${slot.x},${slot.y}`}
              />
            </circle>
          ))}
      </svg>

      <div className="st-rad-top">
        <div className="st-rad-quote">
          {props.hasSelection ? (
            <>
              <p className="st-rad-q" dir="auto">
                «{props.quote.length > 90 ? `${props.quote.slice(0, 90)}…` : props.quote}»
              </p>
              {props.meta ? <p className="st-rad-meta">{props.meta}</p> : null}
            </>
          ) : (
            <p className="st-rad-q is-hint">{props.hint}</p>
          )}
        </div>
        <div className="st-rad-tools" role="toolbar" aria-label="أدوات الدائرة">
          {props.hasSelection && tool("امسح التحديد", Eraser, props.onClear)}
          {props.hasSelection &&
            props.canReport &&
            tool("في غلط بالدرس؟", AlertTriangle, () => setReporting(true))}
          {tool("انقل الدائرة", Move, props.onMoveOrb)}
          {tool("ثبّتها عالطرف", PanelLeftClose, props.onPinOrb)}
          {tool("رجّعها لمكانها", ArrowLeftRight, props.onResetOrb)}
          {tool(
            props.sound ? "الصوت شغّال" : "الصوت مطفّي",
            props.sound ? Volume2 : VolumeX,
            props.onToggleSound,
            { pressed: props.sound },
          )}
          {tool("سكّر", X, onClose)}
        </div>
      </div>

      {reporting && (
        <div className="st-rad-report">
          <ReportForm
            quote={props.quote}
            busy={props.busy}
            onSend={props.onReport}
            onBack={() => setReporting(false)}
          />
        </div>
      )}

      <div className="st-rad-ring" role="menu" aria-label="شو بدك نعمل؟">
        {visible.map((item, i) => {
          const slot = layout.slots[i];
          if (!slot) return null;
          const Icon = item.Icon;
          return (
            <button
              key={`${page}-${item.id}`}
              ref={(node) => {
                buttons.current[i] = node;
              }}
              type="button"
              role={item.checked === undefined ? "menuitem" : "menuitemradio"}
              aria-checked={item.checked}
              className="st-rad-item"
              disabled={item.disabled || props.busy}
              data-hot={hot === i ? "" : undefined}
              data-placeholder={item.placeholder ? "" : undefined}
              data-checked={item.checked ? "" : undefined}
              data-picked={picked === item.id ? "" : undefined}
              tabIndex={i === 0 ? 0 : -1}
              style={{
                left: cx,
                top: cy,
                ["--x" as string]: `${slot.x.toFixed(1)}px`,
                ["--y" as string]: `${slot.y.toFixed(1)}px`,
                ["--i" as string]: i,
              }}
              onPointerEnter={(event) => {
                if (event.pointerType !== "touch") light(i);
              }}
              onPointerLeave={(event) => {
                if (event.pointerType !== "touch" && hotRef.current === i) light(-1);
              }}
              onFocus={() => light(i)}
              onBlur={() => {
                if (hotRef.current === i) light(-1);
              }}
              onClick={() => choose(item)}
            >
              <span className="st-rad-disc">
                {item.glyph ? (
                  <span className="st-rad-glyph" aria-hidden="true">
                    {item.glyph}
                  </span>
                ) : (
                  <Icon size={22} aria-hidden="true" />
                )}
                {item.checked && (
                  <span className="st-rad-tick" aria-hidden="true">
                    <Check size={11} strokeWidth={3} />
                  </span>
                )}
              </span>
              <span className="st-rad-label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
});
