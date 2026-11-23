import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useUiLanguage } from "@/components/language/useUiLanguage";
import { useShown } from "./ag-hooks";
import "./sticker-shelf.css";

const STICKERS: { src: string; tilt: number; lift: number; alt: [string, string] }[] = [
  {
    src: "/media/home/stickers/cafe.webp",
    tilt: -18,
    lift: 14,
    alt: ["Uzyra's café and bookshop", "مقهى يوزرا ومكتبته"],
  },
  {
    src: "/media/home/stickers/library.webp",
    tilt: -6,
    lift: -8,
    alt: ["Uzyra reading in a tall library", "يوزرا بيقرأ بمكتبة عالية"],
  },
  {
    src: "/media/home/stickers/lighthouse.webp",
    tilt: 6,
    lift: 0,
    alt: ["Uzyra at a lighthouse by the sea", "يوزرا عند منارة على البحر"],
  },
  {
    src: "/media/home/stickers/observatory.webp",
    tilt: 18,
    lift: 18,
    alt: ["Uzyra studying the stars in an observatory", "يوزرا بيدرس النجوم بمرصد"],
  },
];

type Drag = { i: number; x: number; y: number; tilt: number };

/**
 * The end of the home page: one «Ask Uzyra anything» field (it opens a conversation with Uzyra)
 * over four stickers fanned like cards. A sticker lifts a little under the pointer; pressed, it
 * grows, comes to the front and follows the finger, leaning with the drag; let go, it springs
 * back to its place. The first time the row is in view the stickers rise into the fan one after
 * another, each turning from upright to its own angle. Reduced motion keeps only the small lift.
 */
export function StickerShelf() {
  const ar = useUiLanguage() === "ar";
  const lang = ar ? 1 : 0;
  const navigate = useNavigate();
  const [drag, setDrag] = useState<Drag | null>(null);
  const [still, setStill] = useState(false);
  const from = useRef<{ x: number; y: number; lastX: number; lastT: number } | null>(null);
  // The stickers rise into their fan, one after another, the first time the row is in view.
  const { ref: rowRef, shown } = useShown<HTMLDivElement>(0.85);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setStill(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  function down(i: number, event: ReactPointerEvent<HTMLDivElement>) {
    if (still || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    from.current = {
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      lastT: event.timeStamp,
    };
    // Pressed: it straightens a little towards the reader.
    setDrag({ i, x: 0, y: 0, tilt: STICKERS[i].tilt + (STICKERS[i].tilt < 0 ? 2 : -2) });
  }

  function move(i: number, event: ReactPointerEvent<HTMLDivElement>) {
    const start = from.current;
    if (!start || drag?.i !== i) return;
    const dt = Math.max(1, event.timeStamp - start.lastT);
    const speed = (event.clientX - start.lastX) / dt; // px per ms
    start.lastX = event.clientX;
    start.lastT = event.timeStamp;
    const lean = Math.max(-14, Math.min(14, speed * 18));
    setDrag({
      i,
      x: event.clientX - start.x,
      y: event.clientY - start.y,
      tilt: STICKERS[i].tilt * 0.35 + lean,
    });
  }

  function up() {
    from.current = null;
    setDrag(null);
  }

  return (
    <section
      className="uz-shelf"
      dir={ar ? "rtl" : "ltr"}
      aria-label={ar ? "اسأل يوزرا" : "Ask Uzyra"}
    >
      <form
        className="uz-shelf-ask"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          void navigate({ to: "/rita" });
        }}
      >
        <input
          type="text"
          name="ask"
          aria-label={ar ? "اسأل يوزرا أي شي" : "Ask Uzyra anything"}
          placeholder={ar ? "اسأل يوزرا أي شي" : "Ask Uzyra anything"}
          autoComplete="off"
        />
        <button type="submit" aria-label={ar ? "احكي مع يوزرا" : "Talk to Uzyra"}>
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </form>

      <div ref={rowRef} className="uz-shelf-row" dir="ltr" data-shown={shown || undefined}>
        {STICKERS.map((sticker, i) => {
          const held = drag?.i === i;
          return (
            <div
              key={sticker.src}
              className="uz-shelf-item"
              data-held={held}
              style={
                {
                  transform: held ? `translate(${drag.x}px, ${drag.y}px)` : undefined,
                  marginTop: `${sticker.lift}px`,
                  "--n": i,
                  "--tilt": `${sticker.tilt}deg`,
                } as CSSProperties
              }
              onPointerDown={(event) => down(i, event)}
              onPointerMove={(event) => move(i, event)}
              onPointerUp={up}
              onPointerCancel={up}
              onLostPointerCapture={up}
            >
              <img
                src={sticker.src}
                width={520}
                height={650}
                alt={sticker.alt[lang]}
                loading="lazy"
                decoding="async"
                draggable={false}
                style={{ rotate: `${held ? drag.tilt : sticker.tilt}deg` }}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
