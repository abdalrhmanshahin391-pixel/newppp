import type { CSSProperties } from "react";
import { VoiceOrb } from "@/components/rita-live/VoiceOrb";
import { TAP_WORDS, type TapState } from "./useTapWord";

export type ChipSpot = { left?: string; right?: string; top: string; rot: number };

/** The orb with its tappable words. The stage owns the size; the caller owns the layout. */
export function TapStage({
  tap,
  spots,
  orbClass,
  rings,
}: {
  tap: TapState;
  spots: ChipSpot[];
  orbClass: string;
  rings?: number[];
}) {
  return (
    <>
      {rings && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {rings.map((size) => (
            <span
              key={size}
              className="absolute left-1/2 top-1/2 rounded-full"
              style={{
                width: size,
                height: size,
                transform: "translate(-50%,-50%)",
                border: "1px solid rgb(255 255 255 / 0.12)",
              }}
            />
          ))}
        </div>
      )}
      <VoiceOrb
        levelsRef={tap.levels}
        mode={tap.speaking ? "speaking" : "idle"}
        label="Rita's voice"
        className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${orbClass}`}
      />
      {TAP_WORDS.map((item, index) => {
        const { rot, ...at } = spots[index];
        return (
          <button
            key={item.term}
            type="button"
            aria-pressed={tap.active === index}
            aria-label={`${item.term}, ${item.lang}. Tap for the meaning.`}
            onClick={() => tap.pick(index)}
            className={`rh-chip absolute ${tap.active === index ? "rh-chip-on" : ""}`}
            style={{ ...at, "--rot": `${rot}deg` } as CSSProperties}
          >
            {item.term}
            {!tap.touched && index === 0 && <span aria-hidden="true" className="rh-ping" />}
          </button>
        );
      })}
    </>
  );
}

/** The answer Rita gives for a tapped word. One quiet line of text until something is tapped. */
export function TapAnswer({ tap, className = "" }: { tap: TapState; className?: string }) {
  const { word, active } = tap;
  return (
    <div className={className} aria-live="polite">
      {word ? (
        <div
          key={active}
          className="rh-pop flex flex-col gap-3 rounded-2xl px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
          style={{ background: "#0b0b0b", border: "1px solid rgb(255 255 255 / 0.28)" }}
        >
          <div className="min-w-0">
            <p className="text-[22px] font-semibold leading-tight text-white">{word.term}</p>
            <p className="text-[13px]" style={{ color: "var(--pp-muted)" }}>
              {word.lang}
            </p>
          </div>
          <div dir="rtl" lang="ar" className="min-w-0">
            <p className="text-[24px] font-semibold leading-tight text-white">{word.meaning}</p>
            <p className="text-[14px]" style={{ color: "var(--pp-muted)" }}>
              النطق: {word.say}
            </p>
          </div>
          <button
            type="button"
            disabled={tap.isAdded}
            onClick={() => tap.add(active as number)}
            className="rita-btn rita-btn-primary rita-btn-sm shrink-0"
            style={tap.isAdded ? { opacity: 0.6 } : undefined}
          >
            {tap.isAdded ? "Added to My words" : "Add to My words"}
          </button>
        </div>
      ) : (
        <p className="text-[15px]" style={{ color: "var(--pp-muted)" }}>
          Tap a word. That is how Rita teaches.
        </p>
      )}
    </div>
  );
}
