import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { clampOrb, type OrbPosition } from "./orb-position";

export type OrbState = "idle" | "armed" | "busy";

const SIZE = 56;
/** Holding still on the circle this long starts "slide to an option" (see RadialMenu). */
const HOLD_MS = 320;
const CELL = 7;

/**
 * Zeros and ones falling slowly behind the character, in the site's blues on deep navy. A small
 * canvas at about 12 frames a second; it stops when the tab is hidden and stands still (drawn once)
 * with reduced motion.
 */
function BinaryRain() {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const el = canvas.current;
    const g = el?.getContext("2d");
    if (!el || !g) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = SIZE * dpr;
    el.height = SIZE * dpr;
    g.scale(dpr, dpr);
    const columns = Math.ceil(SIZE / CELL);
    const rows = Math.ceil(SIZE / CELL) + 1;
    // Each column: its own offset and speed, and a fixed pattern of digits.
    const cols = Array.from({ length: columns }, (_, i) => ({
      y: ((i * 37) % 23) * 1.3,
      speed: 0.35 + ((i * 13) % 7) / 14,
      digits: Array.from({ length: rows + 4 }, (_, j) => ((i * 7 + j * 3) % 5 < 2 ? "1" : "0")),
    }));
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let last = 0;
    const draw = () => {
      g.fillStyle = "#0b1638";
      g.fillRect(0, 0, SIZE, SIZE);
      g.font = `700 ${CELL}px ui-monospace, Menlo, monospace`;
      g.textAlign = "center";
      cols.forEach((col, i) => {
        for (let j = 0; j < rows; j += 1) {
          const y = ((j * CELL + col.y) % (rows * CELL)) - CELL / 2;
          const head = j === Math.floor(col.y / CELL) % rows;
          g.fillStyle = head ? "#9cc1ff" : j % 3 === 0 ? "#2b6df0" : "#1d4fb8";
          g.globalAlpha = head ? 0.95 : 0.55;
          g.fillText(col.digits[(j + i) % col.digits.length], i * CELL + CELL / 2, y + CELL);
        }
      });
      g.globalAlpha = 1;
    };
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (document.hidden || now - last < 80) return;
      last = now;
      for (const col of cols) col.y += col.speed * 2;
      draw();
    };
    draw();
    if (!still) frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return <canvas ref={canvas} className="st-orb-rain" aria-hidden="true" />;
}
const DRAG_START_PX = 6;

/**
 * The Uzyra circle over the study area: the Uzyra character (waving, or thinking while Rita works)
 * in front of falling zeros and ones. Tap it to open the menu; drag it anywhere, over Rita
 * or over the guide (it never follows the pointer on its own). Its place is kept as a share of the
 * area, so it stays in the same spot when the window or the divider changes. Arrow keys move it
 * while "move" mode is on (no dragging needed).
 */
export const FloatingOrb = forwardRef<
  HTMLButtonElement,
  {
    state: OrbState;
    position: OrbPosition;
    onMove: (position: OrbPosition) => void;
    /** A tap (or Enter / Space: `viaKey`). */
    onPress: (viaKey: boolean) => void;
    /** Held still, then sliding: the menu lights up the option under the pointer. */
    onHoldStart?: () => void;
    onHoldMove?: (clientX: number, clientY: number) => void;
    onHoldEnd?: (clientX: number, clientY: number) => void;
    /** The round menu is open. */
    open?: boolean;
    moving: boolean;
    onStopMoving: () => void;
    label: string;
    /** "reply": the selection is in Rita's own answers; the circle takes their dark red. */
    tone?: "reply";
  }
>(function FloatingOrb(
  {
    state,
    position,
    onMove,
    onPress,
    onHoldStart,
    onHoldMove,
    onHoldEnd,
    open,
    moving,
    onStopMoving,
    label,
    tone,
  },
  ref,
) {
  const drag = useRef<{
    x: number;
    y: number;
    moved: boolean;
    holding: boolean;
    id: number;
  } | null>(null);
  const holdTimer = useRef<number | undefined>(undefined);
  const button = useRef<HTMLButtonElement | null>(null);
  const [pressed, setPressed] = useState(false);
  const [dragging, setDragging] = useState(false);

  const box = () => button.current?.parentElement?.getBoundingClientRect() ?? null;

  const place = useCallback(
    (clientX: number, clientY: number) => {
      const rect = box();
      if (!rect) return;
      onMove(
        clampOrb(
          {
            x: (clientX - rect.left - SIZE / 2) / Math.max(rect.width - SIZE, 1),
            y: (clientY - rect.top - SIZE / 2) / Math.max(rect.height - SIZE, 1),
          },
          { width: rect.width, height: rect.height, size: SIZE },
        ),
      );
    },
    [onMove],
  );

  useEffect(() => {
    if (moving) button.current?.focus();
  }, [moving]);

  return (
    <button
      ref={(node) => {
        button.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      type="button"
      aria-label={label}
      aria-keyshortcuts={moving ? "ArrowUp ArrowDown ArrowLeft ArrowRight Escape" : undefined}
      data-state={state}
      data-tone={tone}
      data-open={open || undefined}
      data-dragging={dragging || undefined}
      className="st-orb"
      style={{
        left: `calc((100% - ${SIZE}px) * ${position.x})`,
        top: `calc((100% - ${SIZE}px) * ${position.y})`,
        transform: dragging ? "scale(1.08)" : pressed ? "scale(0.94)" : undefined,
      }}
      onPointerDown={(event) => {
        // Keep the learner's selection in the guide: the orb never takes it away on a desktop.
        event.preventDefault();
        setPressed(true);
        // Capture now: the circle may be dragged across the guide's frame, which would swallow moves.
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          /* not a live pointer; moves still arrive while it is over the circle */
        }
        drag.current = {
          x: event.clientX,
          y: event.clientY,
          moved: false,
          holding: false,
          id: event.pointerId,
        };
        window.clearTimeout(holdTimer.current);
        if (onHoldStart) {
          holdTimer.current = window.setTimeout(() => {
            const held = drag.current;
            if (!held || held.moved) return;
            held.holding = true;
            onHoldStart();
          }, HOLD_MS);
        }
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (!current || current.id !== event.pointerId) return;
        if (current.holding) {
          onHoldMove?.(event.clientX, event.clientY);
          return;
        }
        if (
          !current.moved &&
          Math.hypot(event.clientX - current.x, event.clientY - current.y) < DRAG_START_PX
        )
          return;
        if (!current.moved) {
          current.moved = true;
          window.clearTimeout(holdTimer.current);
          setDragging(true);
        }
        place(event.clientX, event.clientY);
      }}
      onPointerUp={(event) => {
        const current = drag.current;
        drag.current = null;
        window.clearTimeout(holdTimer.current);
        setPressed(false);
        setDragging(false);
        try {
          event.currentTarget.releasePointerCapture?.(event.pointerId);
        } catch {
          /* the pointer is already gone */
        }
        if (current?.holding) {
          onHoldEnd?.(event.clientX, event.clientY);
          return;
        }
        if (current?.moved) return;
        onPress(false);
      }}
      onPointerCancel={() => {
        drag.current = null;
        window.clearTimeout(holdTimer.current);
        setPressed(false);
        setDragging(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (moving) onStopMoving();
          else onPress(true);
          return;
        }
        if (!moving) return;
        const rect = box();
        if (!rect) return;
        const step = (event.shiftKey ? 96 : 24) / Math.max(rect.width - SIZE, 1);
        const stepY = (event.shiftKey ? 96 : 24) / Math.max(rect.height - SIZE, 1);
        const moves: Record<string, [number, number]> = {
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0],
          ArrowUp: [0, -stepY],
          ArrowDown: [0, stepY],
        };
        if (event.key === "Escape") {
          event.preventDefault();
          onStopMoving();
          return;
        }
        const move = moves[event.key];
        if (!move) return;
        event.preventDefault();
        onMove(
          clampOrb(
            { x: position.x + move[0], y: position.y + move[1] },
            { width: rect.width, height: rect.height, size: SIZE },
          ),
        );
      }}
    >
      <BinaryRain />
      <img
        src={state === "busy" ? "/brand-uzyra-think.png" : "/brand-uzyra-wave.png"}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="st-orb-char"
      />
      {state === "armed" && <span className="st-orb-dot" aria-hidden="true" />}
    </button>
  );
});
