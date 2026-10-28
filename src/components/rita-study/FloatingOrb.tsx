import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { clampOrb, type OrbPosition } from "./orb-position";

export type OrbState = "idle" | "armed" | "busy";

const SIZE = 56;
const DRAG_START_PX = 6;

/**
 * The small circle over the guide. Tap it to open the menu; drag it anywhere inside the guide pane
 * (it never follows the pointer on its own and never jumps over the text). Its place is kept as a
 * share of the pane, so it stays in the same spot when the pane is resized. Arrow keys move it while
 * "move" mode is on (no dragging needed).
 */
export const FloatingOrb = forwardRef<
  HTMLButtonElement,
  {
    state: OrbState;
    position: OrbPosition;
    onMove: (position: OrbPosition) => void;
    onPress: () => void;
    moving: boolean;
    onStopMoving: () => void;
    label: string;
  }
>(function FloatingOrb({ state, position, onMove, onPress, moving, onStopMoving, label }, ref) {
  const drag = useRef<{ x: number; y: number; moved: boolean; id: number } | null>(null);
  const button = useRef<HTMLButtonElement | null>(null);
  const [pressed, setPressed] = useState(false);

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
      className="st-orb"
      style={{
        left: `calc((100% - ${SIZE}px) * ${position.x})`,
        top: `calc((100% - ${SIZE}px) * ${position.y})`,
        transform: pressed ? "scale(0.94)" : undefined,
      }}
      onPointerDown={(event) => {
        // Keep the learner's selection in the guide: the orb never takes it away on a desktop.
        event.preventDefault();
        setPressed(true);
        drag.current = { x: event.clientX, y: event.clientY, moved: false, id: event.pointerId };
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (!current || current.id !== event.pointerId) return;
        if (
          !current.moved &&
          Math.hypot(event.clientX - current.x, event.clientY - current.y) < DRAG_START_PX
        )
          return;
        if (!current.moved) {
          current.moved = true;
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        place(event.clientX, event.clientY);
      }}
      onPointerUp={(event) => {
        const current = drag.current;
        drag.current = null;
        setPressed(false);
        if (current?.moved) {
          event.currentTarget.releasePointerCapture?.(event.pointerId);
          return;
        }
        onPress();
      }}
      onPointerCancel={() => {
        drag.current = null;
        setPressed(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (moving) onStopMoving();
          else onPress();
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
      {state === "busy" ? (
        <Loader2 size={22} className="st-orb-spin" aria-hidden="true" />
      ) : (
        <Sparkles size={22} aria-hidden="true" />
      )}
      {state === "armed" && <span className="st-orb-dot" aria-hidden="true" />}
    </button>
  );
});
