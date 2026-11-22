import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useUiLanguage } from "@/components/language/useUiLanguage";
import "./book-window.css";

const LibraryShelves = lazy(() => import("./LibraryShelves"));

export function AppWindow() {
  const ar = useUiLanguage() === "ar";
  const section = useRef<HTMLElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (!window.IntersectionObserver) {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "800px" },
    );
    observer.observe(section.current!);
    return () => observer.disconnect();
  }, []);
  return (
    <section
      ref={section}
      dir={ar ? "rtl" : "ltr"}
      aria-labelledby="window-heading"
      className="home-library mx-auto w-full max-w-[1180px] px-5 pb-16 md:px-10 md:pb-24"
    >
      <h2 id="window-heading" className="rh-h2 text-center">
        {ar ? "تعلّم لغة، صفحة بعد صفحة." : "Learn a language, one page at a time."}
      </h2>
      <div className="library-preview-slot">
        {near && (
          <Suspense fallback={null}>
            <LibraryShelves />
          </Suspense>
        )}
      </div>
      <div className="library-showcase-action">
        <Link to="/books">{ar ? "افتح المكتبة" : "Open the library"}</Link>
      </div>
    </section>
  );
}
