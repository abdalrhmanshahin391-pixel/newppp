import { SiteHeader } from "@/components/SiteHeader";

export function LegalPage({ title, content }: { title: string; content: string }) {
  return (
    <div className="rita-cream min-h-screen">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[860px] px-6 py-16 md:px-10 md:py-24">
        <h1 className="font-display text-[clamp(2.4rem,6vw,4.8rem)] font-black leading-[1.02]">{title}</h1>
        <div className="rita-ink-soft mt-10 whitespace-pre-wrap text-[15px] leading-7 md:text-[16px]">{content}</div>
      </main>
    </div>
  );
}