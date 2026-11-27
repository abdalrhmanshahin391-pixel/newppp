// The two ways to start, side by side: a classroom (ink card, a room of seats that fills on hover)
// and a study group (grey card, a few people who make room on hover). The whole card is the button.
import type { CSSProperties, ReactElement } from "react";
import { GraduationCap, Plus, Users } from "lucide-react";
import type { SpaceKind } from "@/lib/spaces";

const TAKEN = new Set([1, 3, 4, 8, 9, 12, 15, 16, 19, 22, 24, 26]);
const YOU = 17;

function ClassroomArt() {
  const seats: ReactElement[] = [];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 7; col += 1) {
      const i = row * 7 + col;
      seats.push(
        <rect
          key={i}
          className={`sp-seat${TAKEN.has(i) ? " is-taken" : ""}${i === YOU ? " is-you" : ""}`}
          style={{ "--i": i } as CSSProperties}
          x={18 + col * 30}
          y={46 + row * 25}
          width="21"
          height="14"
          rx="4"
        />,
      );
    }
  }
  return (
    <svg className="sp-make-art" viewBox="0 0 240 150" aria-hidden="true">
      <rect className="sp-board" x="52" y="6" width="136" height="22" rx="7" />
      <rect className="sp-board-line" x="66" y="14" width="54" height="3" rx="1.5" />
      <rect className="sp-board-line" x="66" y="20" width="34" height="3" rx="1.5" />
      {seats}
    </svg>
  );
}

function GroupArt() {
  return (
    <svg className="sp-make-art" viewBox="0 0 240 150" aria-hidden="true">
      <g className="sp-person sp-person-a">
        <circle cx="70" cy="78" r="32" />
        <text x="70" y="85">
          S
        </text>
      </g>
      <g className="sp-person sp-person-b">
        <circle cx="116" cy="78" r="32" />
        <text x="116" y="85">
          O
        </text>
      </g>
      <g className="sp-person sp-person-c">
        <circle cx="162" cy="78" r="32" />
        <text x="162" y="85">
          L
        </text>
      </g>
      <g className="sp-person-add">
        <circle cx="212" cy="78" r="20" />
        <path d="M212 70v16M204 78h16" />
      </g>
    </svg>
  );
}

export function MakeCards({ onMake }: { onMake: (kind: SpaceKind) => void }) {
  return (
    <section className="sp-make-row" aria-label="Start a classroom or a study group">
      <article className="sp-make sp-make-dark">
        <ClassroomArt />
        <div className="sp-make-copy">
          <p className="sp-make-kind">
            <GraduationCap size={15} aria-hidden="true" />
            Classroom
          </p>
          <h2 className="sp-make-title">Run a whole course.</h2>
          <p className="sp-make-text">
            One shared library in folders, members with roles, and news that reaches everyone.
          </p>
        </div>
        <button
          type="button"
          className="sp-btn sp-btn-white sp-make-cta"
          onClick={() => onMake("classroom")}
        >
          <Plus size={16} aria-hidden="true" />
          New classroom
        </button>
      </article>

      <article className="sp-make sp-make-soft">
        <GroupArt />
        <div className="sp-make-copy">
          <p className="sp-make-kind">
            <Users size={15} aria-hidden="true" />
            Study group
          </p>
          <h2 className="sp-make-title">Study with a few friends.</h2>
          <p className="sp-make-text">
            Everyone adds decks and posts news. Turn the chat on if you want to talk.
          </p>
        </div>
        <button
          type="button"
          className="sp-btn sp-btn-dark sp-make-cta"
          onClick={() => onMake("group")}
        >
          <Plus size={16} aria-hidden="true" />
          New study group
        </button>
      </article>
    </section>
  );
}
