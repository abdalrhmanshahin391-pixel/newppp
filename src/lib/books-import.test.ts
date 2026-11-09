import assert from "node:assert/strict";
import test from "node:test";
import {
  detectDelimiter,
  guessMapping,
  importMessage,
  parseCsv,
  rowsFromTable,
} from "./books-import.ts";

test("CSV: quotes, doubled quotes, line breaks inside quotes, CRLF and a BOM", () => {
  const text =
    '﻿title,author,description\r\n"Pride, and Prejudice",Jane Austen,"She said ""no"".\nThen yes."\r\n\r\nDracula,Bram Stoker,\n';
  assert.deepEqual(parseCsv(text), [
    ["title", "author", "description"],
    ["Pride, and Prejudice", "Jane Austen", 'She said "no".\nThen yes.'],
    ["Dracula", "Bram Stoker", ""],
  ]);
});

test("CSV: the separator is detected (comma, semicolon, tab)", () => {
  assert.equal(detectDelimiter("a;b;c\n1;2;3"), ";");
  assert.equal(detectDelimiter("a\tb\n1\t2"), "\t");
  assert.equal(detectDelimiter("a,b\n1,2"), ",");
  assert.equal(detectDelimiter("one column"), ",");
  assert.deepEqual(parseCsv("العنوان;الكاتب\nكتاب;كاتب"), [
    ["العنوان", "الكاتب"],
    ["كتاب", "كاتب"],
  ]);
});

test("columns are matched in English and Arabic, each column once", () => {
  assert.deepEqual(guessMapping(["Book Title", "Author", "ISBN-13", "Pages", "Genre", "notes"]), {
    title: 0,
    author: 1,
    isbn: 2,
    pages: 3,
    category: 4,
  });
  assert.deepEqual(guessMapping(["العنوان", "المؤلف", "سنة النشر", "المستوى", "اللغة", "الوصف"]), {
    title: 0,
    author: 1,
    year: 2,
    level: 3,
    language: 4,
    description: 5,
  });
});

test("rows keep only mapped, non-empty cells", () => {
  const table = [
    ["title", "author", "x"],
    [" Dracula ", "Bram Stoker", "ignored"],
    ["Emma", "", "ignored"],
  ];
  assert.deepEqual(rowsFromTable(table, { title: 0, author: 1 }), [
    { title: "Dracula", author: "Bram Stoker" },
    { title: "Emma" },
  ]);
});

test("the database's reasons read as words", () => {
  assert.equal(importMessage("isbn_invalid"), "شكل الـ ISBN غلط");
  assert.equal(importMessage("new_tag:classic"), "وسم جديد رح ينضاف: classic");
  assert.equal(importMessage("something_else"), "something_else");
});
