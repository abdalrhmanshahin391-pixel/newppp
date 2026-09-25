import { Link } from "@tanstack/react-router";
import { EditableImage } from "@/components/site/EditableImage";
import { useReveal } from "@/hooks/useReveal";
import memoryArt from "@/assets/card-memory.jpg.asset.json";
import examsArt from "@/assets/card-exams.jpg.asset.json";
import todoArt from "@/assets/card-todo.jpg.asset.json";

type Card = {
  imageKey: string;
  image: string;
  alt: string;
  to: string;
  lead: string;
  strong: string;
  tail?: string;
};

const CARDS: Card[] = [
  {
    imageKey: "home.card.memory",
    image: memoryArt.url,
    alt: "Two memory cards waiting to be paired",
    to: "/study/match",
    lead: "Pair up the facts that won't stick and play",
    strong: "match, speed or recall.",
  },
  {
    imageKey: "home.card.exams",
    image: examsArt.url,
    alt: "A clean month calendar with one exam day marked",
    to: "/study/exams",
    lead: "Drop every exam onto a clean month calendar and always see",
    strong: "what is next.",
  },
  {
    imageKey: "home.card.todo",
    image: todoArt.url,
    alt: "A checklist notepad with green ticks",
    to: "/study/todo",
    lead: "Plan the day, tick things off and keep your",
    strong: "study streak alive.",
  },
];

/** Three tall picture cards with a short caption, revealed on scroll. */
export function FeatureTriptych() {
  const { ref, shown } = useReveal<HTMLDivElement>();

  return (
    <section className="py-28 md:py-40">
      <div className="mx-auto w-full max-w-[1240px] px-5 md:px-8">
        <div className="mx-auto max-w-[920px] text-center">
          <p className="rita-accent text-[12px] font-black uppercase tracking-[0.18em]">
            Three ways to stay ahead
          </p>
          <h2 className="mt-6 text-[42px] font-bold leading-[1.04] text-white md:text-[68px]">
            Your memory, schedule and next move — <span className="rita-accent">working together.</span>
          </h2>
          <p className="mx-auto mt-7 max-w-[680px] text-[18px] leading-[1.6] text-white/55 md:text-[21px]">
            RitaJet turns a busy semester into three clear habits: remember what matters,
            know what is coming and finish one useful task at a time.
          </p>
        </div>
        <div ref={ref} className="mt-16 grid gap-8 md:mt-24 md:grid-cols-3 md:gap-7">
          {CARDS.map((c, i) => (
            <Link
              key={c.imageKey}
              to={c.to}
              className={`rita-reveal group block ${shown ? "rita-reveal-in" : ""}`}
              style={{ transitionDelay: `${i * 90}ms` }}
            >
              <div className="overflow-hidden rounded-[26px] bg-[#121212] md:rounded-[30px]">
                <EditableImage
                  imageKey={c.imageKey}
                  fallback={c.image}
                  alt={c.alt}
                  width={1024}
                  height={1280}
                  loading="lazy"
                  className="aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </div>
              <p className="mt-6 text-[19px] font-normal leading-[1.48] text-white/55 md:text-[21px]">
                {c.lead} <span className="rita-accent font-bold">{c.strong}</span>
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

