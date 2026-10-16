import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";

const ink = { color: "var(--pp-ink)" } as const;
const muted = { color: "var(--pp-muted)" } as const;

const QUESTIONS: { q: string; a: React.ReactNode }[] = [
  {
    q: "Is it free?",
    a: (
      <>
        You can start free, with no card. Paid plans add more study and AI allowance; see{" "}
        <Link to="/pricing" className="underline underline-offset-4">
          Pricing
        </Link>
        .
      </>
    ),
  },
  {
    q: "Which languages does Rita teach?",
    a: "English and German. She explains in Arabic (Jordanian by default), and switches to the language you ask for.",
  },
  {
    q: "Do I need to install anything?",
    a: "No. Rita runs in your browser. Allow the microphone when it asks, and press start.",
  },
  {
    q: "What happens to the words I ask about?",
    a: "They are added to a list on your device. You choose which to keep, fix or delete, and nothing goes into a flashcard subject until you confirm.",
  },
  {
    q: "Can I study my own notes and PDFs?",
    a: "Yes. Add lecture notes or PDFs and EdithLab builds flashcards, summaries and practice questions from them.",
  },
  {
    q: "What if it is not for me?",
    a: (
      <>
        Read the{" "}
        <Link to="/refund-policy" className="underline underline-offset-4">
          refund policy
        </Link>{" "}
        before you buy, or talk to the team through the{" "}
        <Link to="/support" className="underline underline-offset-4">
          help center
        </Link>
        .
      </>
    ),
  },
];

export function HomeFaq() {
  return (
    <section className="mx-auto w-full max-w-[860px] px-5 pb-20 md:px-8 md:pb-28">
      <h2 className="text-[34px] font-bold leading-[1.08] md:text-[44px]" style={ink}>
        Questions, answered.
      </h2>
      <div className="mt-8 border-t" style={{ borderColor: "var(--pp-line)" }}>
        {QUESTIONS.map((item) => (
          <details
            key={item.q}
            className="rh-faq border-b py-1"
            style={{ borderColor: "var(--pp-line)" }}
          >
            <summary
              className="flex min-h-[56px] items-center justify-between gap-6 py-3 text-[18px] font-bold"
              style={ink}
            >
              {item.q}
              <Plus className="rh-plus shrink-0" size={22} aria-hidden="true" />
            </summary>
            <p className="max-w-[40rem] pb-5 text-[16.5px] leading-[1.65]" style={muted}>
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
