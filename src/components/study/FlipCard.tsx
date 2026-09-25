import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

/** True when the user explicitly asked the system for reduced motion. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    try {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReduced(mq.matches);
      const apply = (e: MediaQueryListEvent) => setReduced(e.matches);
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    } catch {
      return;
    }
  }, []);
  return reduced;
}

/**
 * 3D flip card with rock-solid mobile (iOS Safari / Android Chrome / WebKit) support.
 * Key mobile fixes:
 * 1. WebkitPerspective and perspective on the outer container.
 * 2. WebkitTransformStyle: "preserve-3d" and transformStyle: "preserve-3d".
 * 3. WebkitBackfaceVisibility: "hidden" and backfaceVisibility: "hidden" on faces.
 * 4. translate3d(0, 0, 0) to force hardware layer rendering.
 * 5. Front face has translate3d(0, 0, 2px) and back has rotateY(180deg) translate3d(0, 0, 2px) to prevent z-fighting on WebKit.
 */
export function FlipCard({
  flipped,
  front,
  back,
  className = "",
  style,
  perspective = 1200,
  duration = 450,
}: {
  flipped: boolean;
  front: ReactNode;
  back: ReactNode;
  className?: string;
  style?: CSSProperties;
  perspective?: number;
  duration?: number;
}) {
  const reduced = useReducedMotion();

  return (
    <div
      className={className}
      style={
        {
          perspective: `${perspective}px`,
          WebkitPerspective: `${perspective}px`,
          position: "relative",
          touchAction: "manipulation",
          userSelect: "none",
          WebkitUserSelect: "none",
          ...style,
        } as CSSProperties
      }
    >
      <div
        style={
          {
            position: "relative",
            height: "100%",
            width: "100%",
            transformStyle: "preserve-3d",
            WebkitTransformStyle: "preserve-3d",
            willChange: "transform",
            transform: flipped
              ? "rotateY(180deg) translate3d(0, 0, 0)"
              : "rotateY(0deg) translate3d(0, 0, 0)",
            WebkitTransform: flipped
              ? "rotateY(180deg) translate3d(0, 0, 0)"
              : "rotateY(0deg) translate3d(0, 0, 0)",
            transition: reduced
              ? "opacity 0.15s ease"
              : `transform ${duration}ms cubic-bezier(0.2, 0.8, 0.2, 1), -webkit-transform ${duration}ms cubic-bezier(0.2, 0.8, 0.2, 1)`,
            WebkitTransition: reduced
              ? "opacity 0.15s ease"
              : `-webkit-transform ${duration}ms cubic-bezier(0.2, 0.8, 0.2, 1)`,
          } as CSSProperties
        }
      >
        <div
          style={
            {
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(0deg) translate3d(0, 0, 2px)",
              WebkitTransform: "rotateY(0deg) translate3d(0, 0, 2px)",
              pointerEvents: flipped ? "none" : "auto",
            } as CSSProperties
          }
        >
          {front}
        </div>
        <div
          style={
            {
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg) translate3d(0, 0, 2px)",
              WebkitTransform: "rotateY(180deg) translate3d(0, 0, 2px)",
              pointerEvents: flipped ? "auto" : "none",
            } as CSSProperties
          }
        >
          {back}
        </div>
      </div>
    </div>
  );
}

export function FlipFace({ children, back = false }: { children: ReactNode; back?: boolean }) {
  return (
    <div
      style={
        {
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          transform: back
            ? "rotateY(180deg) translate3d(0, 0, 2px)"
            : "rotateY(0deg) translate3d(0, 0, 2px)",
          WebkitTransform: back
            ? "rotateY(180deg) translate3d(0, 0, 2px)"
            : "rotateY(0deg) translate3d(0, 0, 2px)",
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
