import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { BookObject, UzyraIcon } from "@/components/books/BookObject";
import { useUiLanguage } from "@/components/language/useUiLanguage";
import "./book-window.css";

// Sample shelves from the starter library, shown without fetching the live catalogue.
const books = [
  { title: "A Christmas Carol", author: "Charles Dickens", level: "B2", cover_url: "/book-covers/a-christmas-carol.webp" },
  { title: "The Art of War", author: "Sun Tzu", level: "C1", cover_url: "/book-covers/the-art-of-war.webp" },
  { title: "The Hound of the Baskervilles", author: "Arthur Conan Doyle", level: "B2", cover_url: "/book-covers/the-hound-of-the-baskervilles.webp" },
  { title: "Pride and Prejudice", author: "Jane Austen", level: "C1", cover_url: "/book-covers/pride-and-prejudice.webp" },
  { title: "Frankenstein", author: "Mary Shelley", level: "C1", cover_url: "/book-covers/frankenstein.webp" },
  { title: "Alice's Adventures in Wonderland", author: "Lewis Carroll", level: "B2", cover_url: "/book-covers/alices-adventures-in-wonderland.webp" },
  { title: "The Picture of Dorian Gray", author: "Oscar Wilde", level: "C1", cover_url: "/book-covers/the-picture-of-dorian-gray.webp" },
  { title: "Tao Te Ching", author: "Laozi", level: "C1", cover_url: "/book-covers/tao-te-ching.webp" },
  { title: "The Strange Case of Dr. Jekyll and Mr. Hyde", author: "Robert Louis Stevenson", level: "B2", cover_url: "/book-covers/jekyll-and-hyde.webp" },
  { title: "Meditations", author: "Marcus Aurelius", level: "C1", cover_url: "/book-covers/meditations.webp" },
  { title: "Jane Eyre", author: "Charlotte Bront\u00eb", level: "C1", cover_url: "/book-covers/jane-eyre.webp" },
  { title: "The Adventures of Sherlock Holmes", author: "Arthur Conan Doyle", level: "B2", cover_url: "/book-covers/the-adventures-of-sherlock-holmes.webp" },
] as const;
const shelves = [
  { en: "Trending this week", ar: "الرائج هذا الأسبوع", picks: [0,1,2,3,4,5,6] },
  { en: "New arrivals", ar: "وصل حديثًا", picks: [6,7,8,9,10,11,3] },
];

export function AppWindow() {
  const ar = useUiLanguage() === "ar";
  const stage = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  // Tilt follows scroll: 0 when the window sits in the middle of the screen. Only transform is written.
  useEffect(() => {
    const el = stage.current;
    const win = frame.current;
    if (!el || !win) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      const top = el.getBoundingClientRect().top;
      const start = vh * 0.95;
      const end = vh * 0.25;
      const p = Math.max(0, Math.min(1, (start - top) / (start - end)));
      const eased = 1 - Math.pow(1 - p, 3);
      const wide = window.innerWidth >= 768;
      const tilt = motion.matches ? 0 : (wide ? 24 : 0) * (1 - eased);
      const scale = motion.matches ? 1 : (wide ? 0.9 : 0.96) + (wide ? 0.1 : 0.04) * eased;
      win.style.transform = `rotateX(${tilt.toFixed(2)}deg) scale(${scale.toFixed(3)})`;

    };
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(update);
    };
    // Measure only while the preview is near the viewport.
    const track = (near: boolean) => {
      if (near) {
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        onScroll();
      } else {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
        if (raf) window.cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    const observer = typeof IntersectionObserver === "undefined" ? null :
      new IntersectionObserver(([entry]) => track(entry.isIntersecting), { rootMargin: "160px" });
    if (observer) observer.observe(el);
    else track(true);
    motion.addEventListener("change", onScroll);
    return () => {
      motion.removeEventListener("change", onScroll);
      observer?.disconnect();
      track(false);
    };
  }, []);


  return <section dir={ar ? "rtl" : "ltr"} aria-labelledby="window-heading" className="home-library mx-auto w-full max-w-[1180px] px-5 pb-16 md:px-10 md:pb-24">
    <h2 id="window-heading" className="rh-h2 text-center">{ar ? "تعلّم لغة، صفحة بعد صفحة." : "Learn a language, one page at a time."}</h2>
    <div ref={stage} className="library-stage">
      <div ref={frame} className="library-screen">
        <header className="library-bar"><strong>Uzyra</strong><span>{ar ? "معاينة المكتبة" : "Library preview"}</span></header>
        <div className="library-shelves">
          {shelves.map(shelf => <section key={shelf.en} className="bk-shelf">
            <div className="bk-shelf-head"><span className="bk-shelf-icon"><UzyraIcon /></span>
              <h3 className="bk-shelf-title">{ar ? shelf.ar : shelf.en}</h3>
              <Link className="bk-shelf-all" to="/books">{ar ? "عرض الكل" : "See all"}</Link>
            </div>
            <div className="bk-row" role="region" aria-label={ar ? shelf.ar : shelf.en} tabIndex={0}>
              {shelf.picks.map(i => <div key={books[i].cover_url} className="bk-item">
                <BookObject book={books[i]} />
                <span className="bk-item-title" dir="auto">{books[i].title}</span>
                <span className="bk-item-author" dir="auto">{books[i].author}</span>
              </div>)}
            </div>
            <div className="bk-board" aria-hidden="true" />
          </section>)}
        </div>
      </div>
    </div>
    <div className="library-showcase-action"><Link to="/books">{ar ? "افتح المكتبة" : "Open the library"}</Link></div>
  </section>;
}
