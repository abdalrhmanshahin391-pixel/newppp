import { createFileRoute } from "@tanstack/react-router";
import { ProHeader } from "@/components/home/procreate/ProHeader";
import { HeroA } from "@/components/home/hero-lab/HeroA";
import { HeroB } from "@/components/home/hero-lab/HeroB";
import { HeroC } from "@/components/home/hero-lab/HeroC";

export const Route = createFileRoute("/zz-hero")({
  validateSearch: (s: Record<string, unknown>) => ({ c: String(s.c ?? "a") }),
  component: Lab,
});

function Lab() {
  const { c } = Route.useSearch();
  return (
    <div className="rita-cream edith-light edith-premium uz-mono min-h-screen bg-black text-white" style={{ fontFamily: "var(--font-grotesk)" }}>
      <ProHeader tone="light" />
      {c === "a" && <HeroA />}
      {c === "b" && <HeroB />}
      {c === "c" && <HeroC />}
    </div>
  );
}
