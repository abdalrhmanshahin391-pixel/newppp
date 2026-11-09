import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { LibraryPage } from "@/components/books/LibraryPage";
import { filtersFromSearch, searchFromFilters, type BookFilters } from "@/lib/books";

type LibrarySearch = {
  q?: string;
  cat?: string;
  level?: string;
  lang?: string;
  len?: string;
  sort?: string;
  /** An admin's preview of the library at another moment (ISO time). */
  preview?: string;
};

export const Route = createFileRoute("/books")({
  validateSearch: (search: Record<string, unknown>): LibrarySearch => {
    const out: LibrarySearch = searchFromFilters(filtersFromSearch(search));
    const preview = typeof search.preview === "string" ? search.preview : "";
    if (preview && !Number.isNaN(Date.parse(preview))) out.preview = preview;
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
  const filters = filtersFromSearch(search);
  const preview = search.preview;
  const onFilters = useCallback(
    (next: BookFilters) =>
      void navigate({
        to: "/books",
        search: { ...searchFromFilters(next), ...(preview ? { preview } : {}) } as LibrarySearch,
        replace: true,
      }),
    [navigate, preview],
  );
  return <LibraryPage filters={filters} onFilters={onFilters} preview={preview} />;
}
