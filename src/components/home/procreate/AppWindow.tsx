import { Link } from "@tanstack/react-router";
import { useReveal } from "@/hooks/useReveal";
import "./book-window.css";

export function AppWindow() {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <section aria-labelledby="window-heading" className="mx-auto w-full max-w-[1180px] px-5 pb-16 md:px-10 md:pb-24">
      <h2 id="window-heading" className="rh-h2 text-center">Learn a language, one page at a time.</h2>
      <div ref={ref} className={`library-showcase${shown ? " library-showcase-in" : ""}`}>
        <div className="library-showcase-scroll" role="region" aria-label="Preview of the Uzyra library bookshelves" tabIndex={0}>
          <img src="/library-shelves-preview.webp" width={1190} height={806} loading="lazy" decoding="async"
            alt="Two shelves in the Uzyra library: Trending this week and New arrivals. Books include Pride and Prejudice, Frankenstein, and Jane Eyre, with author names and reading levels." />
        </div>
      </div>
      <div className="library-showcase-action"><Link to="/books">Open the library →</Link></div>
    </section>
  );
}
