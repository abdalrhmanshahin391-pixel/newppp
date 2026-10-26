const TOPICS: { label: string; rot: number }[] = [
  { label: "Greetings", rot: -2 },
  { label: "Ordering food", rot: 1.5 },
  { label: "Travel", rot: -1 },
  { label: "Daily routine", rot: 2 },
  { label: "Grammar", rot: -1.5 },
  { label: "Pronunciation", rot: 1 },
  { label: "der · die · das", rot: -2 },
  { label: "Numbers and dates", rot: 1.5 },
  { label: "Job interviews", rot: -1 },
  { label: "Exam practice", rot: 2 },
  { label: "Small talk", rot: -1.5 },
];

/** Things to talk about, as stickers: ink outline, a little tilt, nothing moving. */
export function TopicsStrip() {
  return (
    <section aria-label="Things you can practise" className="px-5 pb-16 pt-6 md:pb-24">
      <ul className="mx-auto flex max-w-[980px] flex-wrap justify-center gap-x-3 gap-y-3">
        {TOPICS.map((topic) => (
          <li
            key={topic.label}
            className="rounded-full px-5 py-2 text-[15px] font-bold"
            style={{
              background: "var(--uz-paper, #ffffff)",
              border: "1.5px solid var(--pp-ink)",
              color: "var(--pp-ink)",
              transform: `rotate(${topic.rot}deg)`,
            }}
          >
            {topic.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
