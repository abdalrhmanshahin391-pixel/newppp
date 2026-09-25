import { Link } from "@tanstack/react-router";
import toolkitArt from "@/assets/home-toolkit-restored.webp.asset.json";
import plansArt from "@/assets/home-plans-restored.webp.asset.json";
import classroomArt from "@/assets/classroom-study-group.jpg.asset.json";
import flashcardsArt from "@/assets/rita-flashcards-feature.webp.asset.json";
import { EditableImage } from "@/components/site/EditableImage";

type ProductCardProps = {
  imageKey: string;
  label: string;
  title: string;
  note: string;
  image: string;
  imageAlt: string;
  side: "left" | "right";
  learnLabel: string;
  buyLabel: string;
};

function ProductCard({ imageKey, label, title, note, image, imageAlt, side, learnLabel, buyLabel }: ProductCardProps) {
  const left = side === "left";

  return (
    <article className="relative min-h-[690px] overflow-hidden rounded-[28px] border border-white/10 bg-[#121212] px-6 pt-12 text-center md:min-h-[760px] md:rounded-[34px] md:px-10 md:pt-14">
      <p className="text-[20px] font-bold text-white md:text-[22px]">RitaJet <span className="rita-accent font-normal">{label}</span></p>
      <h2 className="mt-6 text-[36px] font-bold leading-[1.05] text-white md:text-[44px]">{title}</h2>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Link to="/pricing" className="rita-btn rita-btn-secondary">{learnLabel}</Link>
        <Link to="/pricing" className="rita-btn rita-btn-primary">{buyLabel}</Link>
      </div>
      <p className="mt-5 text-[15px] font-normal text-white/48 md:text-[17px]">{note}</p>

      <div
        className={`absolute bottom-[-4%] w-[118%] md:w-[114%] ${
          left ? "right-[9%] md:right-[12%]" : "left-[9%] md:left-[12%]"
        }`}
        style={{ top: "44%" }}
      >
        <div
          className="relative h-full rounded-[28px] p-[7px] md:rounded-[34px] md:p-[9px]"
          style={{
            background: "linear-gradient(145deg,#9ca2a8 0%,#444a50 8%,#1b1e21 28%,#111315 72%,#555b61 94%,#a8adb2 100%)",
            boxShadow: "0 1px 0 rgba(255,255,255,.22) inset, 0 18px 44px -32px rgba(43,39,33,.35)",
            transform: left ? "perspective(1400px) rotateY(4deg)" : "perspective(1400px) rotateY(-4deg)",
          }}
        >
          <div className="relative h-full w-full overflow-hidden rounded-[23px] bg-black md:rounded-[28px]">
            {/* The tablet deliberately runs off the card, so the picture is
                fitted to the part of the screen that stays visible. */}
            <div
              className="absolute inset-y-0 w-[77%]"
              style={left ? { right: 0 } : { left: 0 }}
            >
              <EditableImage
                imageKey={imageKey}
                fallback={image}
                alt={imageAlt}
                width={1920}
                height={1072}
                loading="lazy"
                fetchPriority="low"
                className="h-full w-full object-cover"
              />
            </div>

            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ background: "linear-gradient(118deg,rgba(255,255,255,.12),transparent 32%,transparent 72%,rgba(255,255,255,.05))" }}
            />
            <span aria-hidden className="absolute left-1/2 top-[5px] h-[5px] w-[5px] -translate-x-1/2 rounded-full bg-white/15" />
          </div>
        </div>
      </div>
    </article>
  );
}

function CommunityCard() {
  return (
    <article className="relative order-2 flex min-h-[700px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#121212] px-7 pt-10 md:order-1 md:min-h-[790px] md:rounded-[34px] md:px-9 md:pt-12">
      <p className="text-[19px] font-bold text-white md:text-[21px]">
        RitaJet <span className="rita-accent font-normal">Classrooms</span>
      </p>
      <h2 className="mt-4 text-[34px] font-bold leading-[1.06] text-white md:text-[40px]">
        Study in your
        <br />
        own classroom.
      </h2>
      <p className="mt-4 max-w-[19rem] text-[15px] leading-relaxed text-white/48 md:text-[16.5px]">
        Open a private room for your class, invite your group with one code, and
        share decks, summaries and progress in one place.
      </p>
      <div className="relative z-10 mt-6">
        <Link to="/spaces" className="rita-btn rita-btn-primary">Open spaces</Link>
      </div>

      <div className="relative mt-8 min-h-[240px] flex-1 overflow-hidden">
        <div className="absolute inset-x-0 top-0 mx-auto w-[70%] min-w-[190px] max-w-[236px]">
          <div
            className="relative aspect-[9/18] rounded-[40px] p-[8px] md:rounded-[46px]"
            style={{
              background: "linear-gradient(145deg,#9ca2a8 0%,#3f4449 10%,#17191c 30%,#111315 72%,#4d5257 94%,#a8adb2 100%)",
              boxShadow: "0 1px 0 rgba(255,255,255,.22) inset",
            }}
          >
            <div className="relative h-full w-full overflow-hidden rounded-[33px] bg-black md:rounded-[39px]">
              <EditableImage
                imageKey="home.feature.community"
                fallback={classroomArt.url}
                alt="A group of students studying together with shared RitaJet flashcards"
                width={1024}
                height={1536}
                loading="lazy"
                className="h-full w-full object-cover object-center"
              />
              <span aria-hidden className="absolute left-1/2 top-2 z-10 h-[20px] w-[68px] -translate-x-1/2 rounded-full bg-black" />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function FlashcardsFeatureCard() {
  return (
    <article className="relative order-1 min-h-[520px] overflow-hidden rounded-[28px] border border-white/10 bg-[#121212] md:order-2 md:min-h-[700px] md:rounded-[34px]">
      <EditableImage
        imageKey="home.feature.flashcards"
        fallback={flashcardsArt.url}
        alt="A student reviewing a RitaJet medical flashcard on an iPad"
        width={1536}
        height={1024}
        loading="eager"
        fetchPriority="auto"
        className="absolute inset-0 h-full w-full object-cover object-[62%_center] md:object-center"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg,transparent 30%,rgba(18,16,14,0.35) 62%,rgba(18,16,14,0.88) 100%)",
        }}
      />
      <div className="rita-onart absolute inset-x-0 bottom-0 z-10 p-7 md:p-11">
        <p className="text-[12.5px] font-bold uppercase tracking-[0.18em] text-white/75">Flashcards</p>
        <h2 className="mt-3 max-w-[26rem] text-[32px] font-bold leading-[1.06] text-white md:text-[44px]">
          Turn every topic into something you remember.
        </h2>
        <div className="mt-6">
          <Link to="/study" className="rita-btn rita-btn-primary">Start reviewing</Link>
        </div>
      </div>
    </article>
  );
}


export function ProductShowcase() {
  return (
    <section className="mx-auto w-full max-w-[1240px] space-y-5 px-5 pb-24 md:px-8">
      <div className="grid gap-5 md:grid-cols-2">
        <ProductCard
          imageKey="home.product.plans"
          label="Plans"
          title="Study without limits."
          note="Flexible plans for every study rhythm."
          image={plansArt.url}
          imageAlt="RitaJet study plans displayed across a focused night-time study workspace"
          side="left"
          learnLabel="See plan details"
          buyLabel="Buy a plan"
        />
        <ProductCard
          imageKey="home.product.toolkit"
          label="Toolkit"
          title="Everything in one place."
          note="Flashcards, summaries and questions."
          image={toolkitArt.url}
          imageAlt="A student reviewing colorful flashcards with the RitaJet toolkit on an iPad"
          side="right"
          learnLabel="Explore the toolkit"
          buyLabel="Buy the toolkit"
        />
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.78fr)]">
        <CommunityCard />
        <FlashcardsFeatureCard />
      </div>
    </section>
  );
}