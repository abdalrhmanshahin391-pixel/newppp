// The top of an inner page in the home page's language: the home hero's field of marks behind it,
// «[cube] page name» above a headline whose words come in one after another (Arabic words are never
// split into letters), and one muted line under it. Used by /learn and /games; the cards under it
// keep their own look.
import { useRef, type CSSProperties } from "react";
import { RitaCube } from "@/components/rita-study/RitaCube";
import { useShown } from "@/components/home/procreate/ag-hooks";
import { useDotField } from "./useDotField";
import "./page-hero.css";

export function PageHero({ kicker, title, lead }: { kicker: string; title: string; lead: string }) {
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const levels = useRef({ input: 0, output: 0 });
  const { ref, shown } = useShown<HTMLHeadingElement>(0.85);
  useDotField(section, canvas);
  const words = title.split(/\s+/).filter(Boolean);
  return (
    <section ref={section} className="ph-hero">
      <canvas ref={canvas} className="ph-field" aria-hidden="true" />
      <div className="ph-in">
        <p className="ph-kicker">
          <span className="ph-cube" aria-hidden="true">
            <RitaCube levelsRef={levels} mode="idle" label="" />
          </span>
          {kicker}
        </p>
        <h1 ref={ref} className="ph-title" data-shown={shown ? "on" : undefined}>
          <span className="ph-sr">{title}</span>
          <span aria-hidden="true">
            {words.map((word, i) => (
              <span key={i} className="ph-word" style={{ "--i": i } as CSSProperties}>
                {word}
                {i < words.length - 1 ? " " : ""}
              </span>
            ))}
            <span className="ph-caret" style={{ "--i": words.length } as CSSProperties} />
          </span>
        </h1>
        <p className="ph-lead">{lead}</p>
      </div>
    </section>
  );
}
