export const DATA_FILE: string;
export const MIGRATION_FILE: string;
export function coverPathOf(slug: string): string;
export function buildStarterBooksSql(data: {
  categories: { key: string; name_ar: string; name_en: string; color: string; icon: string }[];
  books: {
    slug: string;
    title: string;
    alt_title: string;
    author: string;
    year: number | null;
    pages: number | null;
    level: string;
    category: string;
    status: string;
    description: string;
  }[];
}): string;
