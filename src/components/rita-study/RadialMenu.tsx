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
  Languages,
  Move,
  PanelLeftClose,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { RadialItem } from "./radial-items";
import {
  arcPath,
  fitWheel,
  polar,
  sliceAngle,
  sliceAt,
  slicePath,
  WHEEL_TICKS,
} from "./wheel-layout";
import { ReportForm } from "./ReportForm";
import { confirmSound, menuCloseSound, menuOpenSound, optionNote } from "./tech-sound";

export type RadialHandle = {
  /** The finger or pen is held down on the circle and moving: light up the option it is over. */
  hover: (clientX: number, clientY: number) => void;
  /** It was let go: choose the option it is over, if any. */
  release: (clientX: number, clientY: number) => void;
};

type Geometry = { cx: number; cy: number; w: number; h: number; left: number; top: number };

/** The colour of a slice without one of its own (the circle's blue). */
const DEFAULT_COLOR = "156 193 255";

/** Reads the circle's own centre, without the shift the wheel gave it. */
function orbShift(orb: HTMLElement): { x: number; y: number } {
  const [x = "0", y = "0"] = (orb.style.translate || "").split(/\s+/);
  return { x: parseFloat(x) || 0, y: parseFloat(y) || 0 };
}

/**
 * The study wheel: the options are slices of one whole wheel that grows out of the circle, each
 * always in the same place and colour (the same eight in the lessons and the books). Near an edge
 * or a corner the circle slides inwards until the whole wheel fits, and slides back on closing.
 * Tap the circle then a slice, or hold the circle and move towards a slice and let go (only the
 * direction counts, as on a game controller's wheel). Keys: arrows go round, Enter chooses, Esc
 * closes. Every slice plays its note as it lights up.
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
    selectionHint?: string;
    hasSelection: boolean;
    /** "reply": the selection is in Uzyra's own answers (dark red quote card). */
    tone?: "reply";
    hint: string;
    canReport: boolean;
    onLanguage?: () => void;
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
    const shift = orbShift(orb);
    setGeom({
      cx: o.left + o.width / 2 - c.left - shift.x,
      cy: o.top + o.height / 2 - c.top - shift.y,
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

  // The whole wheel, moved inwards when the circle is near an edge (the circle follows it).
  const topReserve = geom && geom.w < 560 ? 180 : 120;
  const fit = geom
    ? fitWheel({ cx: geom.cx, cy: geom.cy, width: geom.w, height: geom.h, top: topReserve })
    : null;
  const visible = items;

  // The circle slides to the wheel's centre while it is open, and back when it closes.
  const shiftX = fit && geom ? fit.cx - geom.cx : 0;
  const shiftY = fit && geom ? fit.cy - geom.cy : 0;
  useEffect(() => {
    const orb = orbRef.current;
    if (!orb) return;
    orb.style.translate = open && (shiftX || shiftY) ? `${shiftX}px ${shiftY}px` : "";
  }, [open, shiftX, shiftY, orbRef]);
  useEffect(() => {
    const orb = orbRef.current;
    return () => {
      if (orb) orb.style.translate = "";
    };
  }, [orbRef]);

  const choose = useCallback(
    (item: RadialItem) => {
      if (item.disabled) return;
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
    [onClose, props.onPick],
  );

  const light = useCallback((index: number) => {
    if (hotRef.current === index) return;
    hotRef.current = index;
    setHot(index);
    if (index >= 0) optionNote(index);
  }, []);

  // Held on the circle: the direction from the wheel's centre picks the slice.
  const sliceUnder = useCallback(
    (x: number, y: number) => {
      if (!geom || !fit) return -1;
      return sliceAt(x - geom.left - fit.cx, y - geom.top - fit.cy, visible.length, fit.r0 * 0.62);
    },
    [geom, fit, visible.length],
  );

  useImperativeHandle(
    ref,
    () => ({
      hover: (x, y) => light(sliceUnder(x, y)),
      release: (x, y) => {
        const index = sliceUnder(x, y);
        hotRef.current = -1;
        setHot(-1);
        const item = index >= 0 ? visible[index] : null;
        if (item) choose(item);
      },
    }),
    [sliceUnder, light, visible, choose],
  );

  useEffect(() => {
    if (shown && props.autoFocus) {
      const first = buttons.current.find((button) => button && !button.disabled);
      (
        first ?? containerRef.current?.querySelector<HTMLButtonElement>(".st-rad-tools button")
      )?.focus();
    }
  }, [shown, props.autoFocus, containerRef]);

  if (!mounted || !geom || !fit) return null;
  const { cx, cy, r0, r1 } = fit;
  const half = r1 + WHEEL_TICKS;
  const size = half * 2;
  const count = visible.length;
  const hotItem = hot >= 0 ? visible[hot] : null;

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      orbRef.current?.focus();
      return;
    }
    const count = visible.length;
    const at = buttons.current.findIndex((node) => node === document.activeElement);
    const go = (to: number, step = 1) => {
      event.preventDefault();
      for (let offset = 0; offset < count; offset += 1) {
        const next = (((to + offset * step) % count) + count) % count;
        const button = buttons.current[next];
        if (!button || button.disabled) continue;
        button.focus();
        light(next);
        break;
      }
    };
    if (event.key === "ArrowRight" || event.key === "ArrowDown") go(at + 1);
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
      go(at < 0 ? count - 1 : at - 1, -1);
    else if (event.key === "Home") go(0);
    else if (event.key === "End") go(count - 1, -1);
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
      className={`st-rad${shown ? " is-shown" : ""}${reporting ? " is-report" : ""}${
        props.tone === "reply" ? " is-reply" : ""
      }`}
      dir="rtl"
      style={{ ["--n" as string]: visible.length }}
      onKeyDown={onKeyDown}
    >
      <div
        className="st-rad-scrim"
        onPointerDown={onClose}
        style={{
          background: `radial-gradient(circle at ${cx}px ${cy}px, rgb(6 12 32 / 0.66) 0, rgb(6 12 32 / 0.46) ${half + 40}px, rgb(6 12 32 / 0) ${half + 260}px)`,
        }}
      />

      <div className="st-rad-top">
        <div className="st-rad-quote">
          {props.hasSelection ? (
            <>
              <p className="st-rad-q" dir="auto">
                «{props.quote.length > 90 ? `${props.quote.slice(0, 90)}…` : props.quote}»
              </p>
              {props.meta ? <p className="st-rad-meta">{props.meta}</p> : null}
              {props.selectionHint ? <p className="st-rad-meta">{props.selectionHint}</p> : null}
            </>
          ) : (
            <p className="st-rad-q is-hint">{props.hint}</p>
          )}
        </div>
        <div className="st-rad-tools" role="toolbar" aria-label="أدوات الدائرة">
          {props.onLanguage && tool("لغة الشرح", Languages, props.onLanguage)}
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

      <div
        className="st-wheel"
        role="menu"
        aria-label="شو بدك نعمل؟"
        style={{
          left: cx - half,
          top: cy - half,
          width: size,
          height: size,
          ["--r0" as string]: `${r0}px`,
          ["--r1" as string]: `${r1}px`,
        }}
      >
        {/* The outer dial: a hairline ring with fine ticks, a long one at each slice's middle. */}
        <svg className="st-wheel-dial" width={size} height={size} aria-hidden="true">
          <circle cx={half} cy={half} r={r1 + 14} className="st-wheel-hair" />
          {Array.from({ length: 120 }, (_, k) => {
            const a = k * 3;
            const major = count > 0 && a % (360 / count) === 0;
            const from = polar(half, half, r1 + 9, a);
            const to = polar(half, half, r1 + (major ? 20 : 14), a);
            return (
              <line
                key={k}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                className={major ? "st-wheel-tick is-major" : "st-wheel-tick"}
              />
            );
          })}
        </svg>

        {visible.map((item, i) => {
          const Icon = item.Icon;
          const middle = sliceAngle(i, count);
          const spot = polar(half, half, (r0 + r1) / 2 + 4, middle);
          return (
            <button
              key={item.id}
              ref={(node) => {
                buttons.current[i] = node;
              }}
              type="button"
              role={item.checked === undefined ? "menuitem" : "menuitemradio"}
              aria-checked={item.checked}
              aria-label={item.label}
              className="st-wedge"
              disabled={item.disabled || props.busy}
              title={
                item.disabled ? (item.disabledReason ?? "حدّد كلمة أو جملة من الدرس") : item.label
              }
              aria-description={item.disabled ? item.disabledReason : undefined}
              data-hot={hot === i ? "" : undefined}
              data-placeholder={item.placeholder ? "" : undefined}
              data-checked={item.checked ? "" : undefined}
              data-tone={item.tone}
              data-service={item.id}
              data-picked={picked === item.id ? "" : undefined}
              tabIndex={i === visible.findIndex((option) => !option.disabled) ? 0 : -1}
              style={{
                clipPath: `path("${slicePath(half, half, r0, r1, i, count)}")`,
                ["--c" as string]: item.color ?? DEFAULT_COLOR,
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
              <span className="st-wedge-in" style={{ left: spot.x, top: spot.y }}>
                <span className="st-wedge-icon">
                  {item.glyph ? (
                    <span className="st-rad-glyph" aria-hidden="true">
                      {item.glyph}
                    </span>
                  ) : (
                    <Icon size={20} aria-hidden="true" />
                  )}
                  {item.checked && (
                    <span className="st-rad-tick" aria-hidden="true">
                      <Check size={10} strokeWidth={3} />
                    </span>
                  )}
                </span>
                <span className="st-wedge-label">{item.label}</span>
              </span>
            </button>
          );
        })}

        {/* Seams between the slices, the rims, each slice's own light, and the pointer. */}
        <svg className="st-wheel-lines" width={size} height={size} aria-hidden="true">
          <circle cx={half} cy={half} r={r1} className="st-wheel-edge" />
          <circle cx={half} cy={half} r={r0} className="st-wheel-edge is-inner" />
          {visible.map((item, i) => {
            const edge = sliceAngle(i, count) - 180 / count;
            const a = polar(half, half, r0, edge);
            const b = polar(half, half, r1, edge);
            return (
              <line key={`s${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="st-wheel-seam" />
            );
          })}
          {visible.map((item, i) => {
            const middle = sliceAngle(i, count);
            const spread = 180 / count - 3;
            return (
              <path
                key={`r${i}`}
                d={arcPath(half, half, r1 - 2, middle - spread, middle + spread)}
                className="st-wheel-rim"
                data-hot={hot === i ? "" : undefined}
                data-off={item.disabled ? "" : undefined}
                style={{ ["--c" as string]: item.color ?? DEFAULT_COLOR, ["--i" as string]: i }}
              />
            );
          })}
          {hotItem && (
            <path
              d={arcPath(half, half, r0 + 5, -18, 18)}
              className="st-wheel-pointer"
              style={{
                ["--c" as string]: hotItem.color ?? DEFAULT_COLOR,
                transform: `rotate(${sliceAngle(hot, count)}deg)`,
                transformOrigin: `${half}px ${half}px`,
              }}
            />
          )}
          <circle cx={half} cy={half} r={r0 - 8} className="st-wheel-orbit" />
        </svg>

        {/* The name of the slice under the finger (or why it is dimmed), above the wheel. */}
        <p
          className="st-wheel-name"
          data-shown={hotItem ? "" : undefined}
          data-off={hotItem?.disabled ? "" : undefined}
          style={{ ["--c" as string]: hotItem?.color ?? DEFAULT_COLOR }}
          aria-hidden="true"
        >
          <span className="st-wheel-dot" />
          {hotItem
            ? hotItem.disabled
              ? (hotItem.disabledReason ?? hotItem.label)
              : hotItem.label
            : ""}
        </p>
      </div>
    </div>
  );
});
