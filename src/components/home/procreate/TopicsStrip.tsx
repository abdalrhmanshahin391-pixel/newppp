const TOPICS = [
  "Greetings",
  "Ordering food",
  "Travel",
  "Daily routine",
  "Grammar",
  "Pronunciation",
  "der · die · das",
  "Numbers and dates",
  "Job interviews",
  "Exam practice",
  "Small talk",
  "Flashcards",
];

function Chips() {
  return (
    <>
      {TOPICS.map((topic) => (
        <span
          key={topic}
          className="me-3 inline-block whitespace-nowrap rounded-full px-5 py-2 text-[15px] font-semibold"
          style={{
            background: "#ffffff",
            border: "1px solid var(--pp-line)",
            color: "var(--pp-ink)",
          }}
        >
          {topic}
        </span>
      ))}
    </>
  );
}

/** A slow strip of things to talk about. It pauses on hover and is still when motion is reduced. */
export function TopicsStrip() {
  return (
    <section aria-label="Things you can practise" className="pb-16 md:pb-24">
      <div className="rh-marquee rh-fade-edges overflow-hidden">
        <div className="rh-marquee-track">
          <div className="flex">
            <Chips />
          </div>
          <div className="rh-marquee-copy flex" aria-hidden="true">
            <Chips />
          </div>
        </div>
      </div>
    </section>
  );
}
