import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { LibraryPage } from "@/components/books/LibraryPage";
import { searchFromState, stateFromSearch, type BrowseState } from "@/lib/books";

type LibrarySearch = {
  q?: string;
  cat?: string;
  level?: string;
  lang?: string;
  len?: string;
  tag?: string;
  sort?: string;
  view?: string;
  page?: number;
  size?: number;
  /** An admin's preview of the library at another moment (ISO time), and its picks order. */
  preview?: string;
  seed?: string;
};

export const Route = createFileRoute("/books")({
  validateSearch: (search: Record<string, unknown>): LibrarySearch => {
    const out: LibrarySearch = searchFromState(stateFromSearch(search));
    const preview = typeof search.preview === "string" ? search.preview : "";
    if (preview && !Number.isNaN(Date.parse(preview))) {
      out.preview = preview;
      const seed = typeof search.seed === "string" ? search.seed : "";
      if (/^[a-z0-9]{1,16}$/i.test(seed)) out.seed = seed;
    }
    return out;
  },
  head: () => ({
    meta: [
      { title: "Library — Uzyra" },
      {
        name: "description",
        content:
          "Real books for language learners, sorted by subject and level: romance, science, adventure, mystery and more.",
      },
    ],
  }),
  component: BooksRoute,
});

function BooksRoute() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const state = stateFromSearch(search);
  const { preview, seed } = search;
  const onState = useCallback(
    (next: BrowseState) =>
      void navigate({
        to: "/books",
        search: {
          ...searchFromState(next),
          ...(preview ? { preview } : {}),
          ...(preview && seed ? { seed } : {}),
        } as LibrarySearch,
      }),
    [navigate, preview, seed],
  );
  return <LibraryPage state={state} onState={onState} preview={preview} previewSeed={seed} />;
}
