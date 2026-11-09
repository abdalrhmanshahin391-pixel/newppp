// Importing book details from a CSV file (phase 1: metadata only — covers and PDFs are linked by
// hand later, never guessed from file names). Pure: reading the file, matching its columns to the
// book fields, and building the rows sent to the books_import database function (which checks
// every row again, finds duplicates, and does a dry run first).

export const IMPORT_FIELDS = [
  "title",
  "alt_title",
  "author",
  "isbn",
  "year",
  "pages",
  "level",
  "language",
  "category",
  "tags",
  "description",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

export const IMPORT_FIELD_LABELS: Record<ImportField, { ar: string; en: string }> = {
  title: { ar: "العنوان", en: "Title" },
  alt_title: { ar: "عنوان بديل", en: "Alternate title" },
  author: { ar: "الكاتب", en: "Author" },
  isbn: { ar: "ISBN", en: "ISBN" },
  year: { ar: "سنة النشر", en: "Year" },
  pages: { ar: "الصفحات", en: "Pages" },
  level: { ar: "المستوى", en: "Level" },
  language: { ar: "اللغة", en: "Language" },
  category: { ar: "التصنيف", en: "Category" },
  tags: { ar: "الوسوم", en: "Tags" },
  description: { ar: "الوصف", en: "Description" },
};

/** Header names (lower case, no spaces or punctuation) each field is recognised by. */
const SYNONYMS: Record<ImportField, string[]> = {
  title: ["title", "booktitle", "name", "العنوان", "عنوان", "اسمالكتاب", "الكتاب"],
  alt_title: [
    "alttitle",
    "alternatetitle",
    "originaltitle",
    "subtitle",
    "عنوانبديل",
    "العنوانالبديل",
    "العنوانالاصلي",
  ],
  author: ["author", "authors", "writer", "by", "الكاتب", "المؤلف", "كاتب", "مؤلف"],
  isbn: ["isbn", "isbn13", "isbn10"],
  year: ["year", "publishedyear", "publicationyear", "سنةالنشر", "السنة", "سنة"],
  pages: ["pages", "pagecount", "numberofpages", "الصفحات", "عددالصفحات", "صفحات"],
  level: ["level", "cefr", "المستوى", "مستوى"],
  language: ["language", "lang", "اللغة", "لغة", "لغةالكتاب"],
  category: ["category", "genre", "shelf", "التصنيف", "تصنيف", "الفئة"],
  tags: ["tags", "keywords", "الوسوم", "وسوم", "كلماتمفتاحية"],
  description: ["description", "summary", "about", "الوصف", "وصف", "نبذة", "ملخص"],
};

const headerKey = (text: string) =>
  text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/[^\p{L}\p{N}]+/gu, "");

/** Which separator the file uses: the one that splits the first line into the most columns. */
export function detectDelimiter(text: string): "," | ";" | "\t" {
  const firstLine = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
  const counts = ([",", ";", "\t"] as const).map((d) => [d, firstLine.split(d).length] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 1 ? counts[0][0] : ",";
}

/**
 * Reads CSV text (RFC 4180: quoted fields, doubled quotes, line breaks inside quotes, CRLF, a
 * leading BOM). Empty lines are dropped. Returns rows of cells.
 */
export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"' && cell === "") quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export type ImportMapping = Partial<Record<ImportField, number>>;

/** Guesses which column holds each field from the header row (each column used once). */
export function guessMapping(headers: string[]): ImportMapping {
  const mapping: ImportMapping = {};
  const used = new Set<number>();
  for (const field of IMPORT_FIELDS) {
    const index = headers.findIndex(
      (header, i) => !used.has(i) && SYNONYMS[field].includes(headerKey(header)),
    );
    if (index >= 0) {
      mapping[field] = index;
      used.add(index);
    }
  }
  return mapping;
}

export type ImportRow = Partial<Record<ImportField, string>>;

/** The data rows (header left out) as objects for books_import; cells are trimmed. */
export function rowsFromTable(table: string[][], mapping: ImportMapping): ImportRow[] {
  return table.slice(1).map((cells) => {
    const row: ImportRow = {};
    for (const field of IMPORT_FIELDS) {
      const index = mapping[field];
      if (index === undefined) continue;
      const value = (cells[index] ?? "").trim();
      if (value) row[field] = value;
    }
    return row;
  });
}

export const MAX_IMPORT_ROWS = 2000;

/** Words for the reasons the database gives for a row. */
export const IMPORT_MESSAGES: Record<string, string> = {
  title_missing: "العنوان فاضي",
  title_too_long: "العنوان أطول من 200 حرف",
  alt_title_too_long: "العنوان البديل أطول من 200 حرف",
  author_too_long: "اسم الكاتب أطول من 160 حرف",
  description_too_long: "الوصف أطول من 1200 حرف",
  level_invalid: "المستوى لازم يكون A1 … C2",
  language_invalid: "رمز اللغة غلط (مثل en أو de)",
  year_invalid: "السنة مش رقم صحيح",
  pages_invalid: "الصفحات لازم تكون بين 1 و 5000",
  isbn_invalid: "شكل الـ ISBN غلط",
  isbn_taken: "الـ ISBN لكتاب ثاني",
  category_unknown: "التصنيف مش موجود (أضفه أولاً)",
  tag_too_long: "وسم أطول من 40 حرف",
  duplicate_in_file: "مكرر بنفس الملف",
  row_not_object: "صف غير مقروء",
  no_category: "بدون تصنيف (ما بينشر قبل ما تحطه)",
};

export function importMessage(code: string): string {
  if (code.startsWith("new_tag:")) return `وسم جديد رح ينضاف: ${code.slice(8)}`;
  return IMPORT_MESSAGES[code] ?? code;
}
