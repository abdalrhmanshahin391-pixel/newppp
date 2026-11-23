import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useUiLanguage } from "@/components/language/useUiLanguage";
import { Typed } from "./ag-motion";
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
      className="home-library uz-lib"
    >
      {/* Arabic is not typed letter by letter: split letters would lose their joined shapes. */}
      {ar ? (
        <h2 id="window-heading" className="uz-lib-title">
          تعلّم لغة، صفحة بعد صفحة.
        </h2>
      ) : (
        <Typed
          id="window-heading"
          className="uz-lib-title"
          text="Learn a language, one page at a time."
        />
      )}
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
