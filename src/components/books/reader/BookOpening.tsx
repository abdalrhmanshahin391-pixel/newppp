// What a book shows while it opens: the reader's own layout (the top bar, Uzyra's column beside an
// empty page), with Uzyra's cube thinking in its usual place and one line saying what is
// happening. When the book is ready the reader takes its place with the cube where it already was,
// so opening feels like one screen settling rather than a loading screen and then another page.
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { BookRitaColumn } from "./BookRitaColumn";
import { readSplit, useWide } from "./reader-layout";
import "./book-reader.css";

export function BookOpening({ title, status }: { title: string; status: string }) {
  const wide = useWide(900);
  const [split] = useState(() => readSplit() ?? { rita: 40, book: 60 });
  const column = (
    <div className="flex h-full min-h-0 flex-col bg-white" dir="rtl">
      <BookRitaColumn answers={[]} onRetry={() => undefined} hint={status} thinking />
    </div>
  );
  return (
    <div
      className="edith-premium flex h-[100dvh] flex-col bg-white text-[var(--pp-ink)]"
      dir="rtl"
      aria-busy="true"
    >
      <header className="st-top">
        <Link to="/books" className="st-top-btn" aria-label="رجوع للمكتبة">
          <ArrowRight size={15} aria-hidden="true" />
          <span className="hidden sm:inline">المكتبة</span>
        </Link>
        <p className="bkr-title" dir="auto">
          {title}
        </p>
      </header>
      <div className="st-work relative flex min-h-0 flex-1 flex-col">
        {wide ? (
          <div className="st-split flex min-h-0 flex-1" dir="ltr">
            <div className="min-h-0" style={{ flexBasis: `${split.rita}%` }}>
              {column}
            </div>
            <div className="st-divider" aria-hidden="true">
              <span className="st-grip" />
            </div>
            <div className="bkr-pane min-h-0 flex-1" style={{ flexBasis: `${split.book}%` }}>
              <div className="bkr-opening-page" aria-hidden="true" />
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1">{column}</div>
        )}
      </div>
    </div>
  );
}
