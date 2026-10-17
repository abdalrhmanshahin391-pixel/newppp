import type { CSSProperties } from "react";
import { useReveal } from "@/hooks/useReveal";

const ink = { color: "var(--pp-ink)" } as const;
const muted = { color: "var(--pp-muted)" } as const;

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className="flex min-h-[210px] flex-col justify-center gap-2.5 rounded-2xl p-4"
      style={{ background: "#ffffff", border: "1px solid var(--pp-line)" }}
    >
      {children}
    </div>
  );
}

function TalkPanel() {
  return (
    <Panel>
      <span
        dir="rtl"
        lang="ar"
        className="self-end rounded-2xl rounded-br-md px-3.5 py-2 text-[13.5px] font-semibold"
        style={{ background: "var(--pp-ink)", color: "#ffffff" }}
      >
        كيف أحكي بدي ماي بالألماني؟
      </span>
      <span
        dir="rtl"
        lang="ar"
        className="self-start rounded-2xl rounded-bl-md px-3.5 py-2 text-[13.5px] leading-6"
        style={{ background: "var(--pp-grey)", ...ink }}
      >
        بنقول{" "}
        <span
          dir="ltr"
          className="inline-block rounded-md px-1.5 font-bold"
          style={{ background: "var(--pp-accent-soft)" }}
        >
          Ich möchte Wasser
        </span>
      </span>
    </Panel>
  );
}

function WordsPanel() {
  const rows = [
    ["Guten Morgen", "صباح الخير"],
    ["borrow", "يستعير"],
    ["das Haus", "البيت"],
  ];
  return (
    <Panel>
      {rows.map(([term, meaning]) => (
        <div
          key={term}
          className="flex items-center justify-between gap-3 border-b pb-2"
          style={{ borderColor: "var(--pp-line)" }}
        >
          <span className="text-[14px] font-bold" style={ink}>
            {term}
          </span>
          <span dir="rtl" lang="ar" className="text-[13.5px]" style={muted}>
            {meaning}
          </span>
        </div>
      ))}
      <span
        className="mt-1 self-start rounded-lg px-3 py-1.5 text-[12.5px] font-bold"
        style={{
          background: "var(--pp-accent)",
          border: "1.5px solid var(--pp-ink)",
          color: "var(--pp-on-accent)",
        }}
      >
        Turn 3 words into flashcards
      </span>
    </Panel>
  );
}

function StudyPanel() {
  return (
    <Panel>
      <div className="flex items-center gap-3">
        <div
          className="flex h-[88px] w-[66px] shrink-0 flex-col gap-1.5 rounded-md p-2"
          style={{ background: "var(--pp-grey)", border: "1px solid var(--pp-line)" }}
        >
          {[100, 80, 92, 60, 86, 70].map((w, i) => (
            <span
              key={i}
              className="h-[5px] rounded-full"
              style={{ width: `${w}%`, background: "var(--pp-line)" }}
            />
          ))}
        </div>
        <span className="text-[18px] font-bold" style={muted}>
          →
        </span>
        <div className="relative h-[88px] flex-1">
          <span
            className="absolute inset-x-0 top-3 h-[70px] rounded-xl"
            style={{
              background: "var(--pp-accent-soft)",
              border: "1px solid var(--pp-line)",
              transform: "rotate(3deg)",
            }}
          />
          <span
            className="absolute inset-x-0 top-0 flex h-[70px] flex-col justify-center rounded-xl px-3"
            style={{ background: "#ffffff", border: "1.5px solid var(--pp-ink)" }}
          >
            <span className="text-[11px] font-semibold" style={muted}>
              Question
            </span>
            <span className="text-[13px] font-bold leading-tight" style={ink}>
              What does a cell membrane do?
            </span>
          </span>
        </div>
      </div>
    </Panel>
  );
}

const CARDS = [
  {
    title: "Talk it through",
    text: "Speak English or German out loud. Rita answers in Arabic, and any foreign word you tap shows its meaning and how to say it.",
    panel: <TalkPanel />,
  },
  {
    title: "Keep every word",
    text: "The words you ask about collect in your list. Fix or delete them, then turn the list into flashcards in the subject you choose.",
    panel: <WordsPanel />,
  },
  {
    title: "Study your own material",
    text: "Upload lecture notes or PDFs and get flashcards, summaries and practice questions made from what you actually have to learn.",
    panel: <StudyPanel />,
  },
];

export function FeatureTrio() {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <section className="mx-auto w-full max-w-[1180px] px-5 pb-20 md:px-10 md:pb-28">
      <h2
        className="mx-auto max-w-[40rem] text-center text-[34px] font-bold leading-[1.08] md:text-[48px]"
        style={ink}
      >
        Practise out loud, then keep what you learn.
      </h2>
      <div ref={ref} className="mt-12 grid gap-5 md:grid-cols-3">
        {CARDS.map((card, index) => (
          <article
            key={card.title}
            className={`rita-reveal rh-lift rounded-[24px] p-5 ${shown ? "rita-reveal-in" : ""}`}
            style={
              { background: "var(--pp-grey)", transitionDelay: `${index * 90}ms` } as CSSProperties
            }
          >
            {card.panel}
            <h3 className="mt-6 text-[24px] font-bold leading-tight" style={ink}>
              {card.title}
            </h3>
            <p className="mt-2 text-[16px] leading-[1.6]" style={muted}>
              {card.text}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
