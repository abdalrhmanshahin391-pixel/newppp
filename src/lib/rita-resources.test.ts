import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_PDF_BYTES,
  MAX_RESOURCES,
  NewResourceSchema,
  canAddResource,
  formatBytes,
  hasPdfSignature,
  hostLabel,
  isCompleteOrder,
  isPdfPathFor,
  looksLikeVideo,
  moveResource,
  nextPosition,
  normaliseUrl,
  pdfProblem,
  pdfStoragePath,
  titleFromFileName,
} from "./rita-resources.ts";

test("links need https and add it when the scheme is missing", () => {
  assert.equal(normaliseUrl("https://example.com/a"), "https://example.com/a");
  assert.equal(normaliseUrl("  youtube.com/watch?v=abc "), "https://youtube.com/watch?v=abc");
  assert.equal(normaliseUrl("http://example.com"), null);
  assert.equal(normaliseUrl("javascript:alert(1)"), null);
  assert.equal(normaliseUrl("data:text/html,hi"), null);
  assert.equal(normaliseUrl("https://user:pass@example.com"), null);
  assert.equal(normaliseUrl("localhost"), null);
  assert.equal(normaliseUrl("two words.com"), null);
  assert.equal(normaliseUrl(""), null);
  assert.equal(normaliseUrl(`https://example.com/${"a".repeat(2100)}`), null);
});

test("host label drops www and video hosts are recognised", () => {
  assert.equal(hostLabel("https://www.example.com/page"), "example.com");
  assert.equal(looksLikeVideo("https://www.youtube.com/watch?v=1"), true);
  assert.equal(looksLikeVideo("https://youtu.be/abc"), true);
  assert.equal(looksLikeVideo("https://notyoutube.com/x"), false);
  assert.equal(looksLikeVideo("https://example.com/video"), false);
});

test("pdf checks: type, empty, too big, signature", () => {
  assert.equal(pdfProblem({ name: "a.pdf", size: 1000, type: "application/pdf" }), null);
  assert.equal(pdfProblem({ name: "A.PDF", size: 1000, type: "" }), null);
  assert.ok(pdfProblem({ name: "a.png", size: 1000, type: "image/png" }));
  assert.ok(pdfProblem({ name: "a.pdf", size: 0, type: "application/pdf" }));
  assert.ok(pdfProblem({ name: "a.pdf", size: MAX_PDF_BYTES + 1, type: "application/pdf" }));
  assert.equal(pdfProblem({ name: "a.pdf", size: MAX_PDF_BYTES, type: "application/pdf" }), null);
  assert.equal(hasPdfSignature(new TextEncoder().encode("%PDF-1.7")), true);
  assert.equal(hasPdfSignature(new TextEncoder().encode("<html>")), false);
  assert.equal(hasPdfSignature(new Uint8Array([0x25])), false);
});

test("titles come from file names", () => {
  assert.equal(titleFromFileName("week-3_summary.pdf"), "week 3 summary");
  assert.equal(titleFromFileName("  Notes  .PDF"), "Notes");
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(2048), "2 KB");
  assert.equal(formatBytes(3 * 1024 * 1024), "3.0 MB");
});

test("a stored path must sit under its own lesson", () => {
  const lesson = "11111111-1111-4111-8111-111111111111";
  const other = "22222222-2222-4222-8222-222222222222";
  const file = "33333333-3333-4333-8333-333333333333";
  const path = pdfStoragePath(lesson, file);
  assert.equal(isPdfPathFor(lesson, path), true);
  assert.equal(isPdfPathFor(other, path), false);
  assert.equal(isPdfPathFor(lesson, `lessons/${lesson}/../${file}.pdf`), false);
  assert.equal(isPdfPathFor(lesson, `lessons/${lesson}/${file}.exe`), false);
});

test("new resources validate by kind", () => {
  const link = NewResourceSchema.safeParse({
    kind: "video",
    url: "youtu.be/abc",
    title: "  Helper  ",
    note: "",
  });
  assert.equal(link.success, true);
  if (link.success && link.data.kind !== "pdf") assert.equal(link.data.url, "https://youtu.be/abc");
  assert.equal(
    NewResourceSchema.safeParse({ kind: "link", url: "http://x.com", title: "x" }).success,
    false,
  );
  assert.equal(
    NewResourceSchema.safeParse({ kind: "link", url: "https://x.com", title: "   " }).success,
    false,
  );
  assert.equal(
    NewResourceSchema.safeParse({
      kind: "pdf",
      file_path: "lessons/a/b.pdf",
      file_name: "b.pdf",
      file_size: 100,
      title: "B",
    }).success,
    true,
  );
  assert.equal(
    NewResourceSchema.safeParse({
      kind: "pdf",
      file_path: "p",
      file_name: "b.pdf",
      file_size: MAX_PDF_BYTES + 1,
      title: "B",
    }).success,
    false,
  );
});

test("ordering: move, append, complete order", () => {
  const list = [
    { id: "a", position: 0 },
    { id: "b", position: 1 },
    { id: "c", position: 2 },
  ];
  assert.deepEqual(
    moveResource(list, "b", "up").map((item) => item.id),
    ["b", "a", "c"],
  );
  assert.deepEqual(
    moveResource(list, "b", "up").map((item) => item.position),
    [0, 1, 2],
  );
  assert.equal(moveResource(list, "a", "up"), list);
  assert.equal(moveResource(list, "c", "down"), list);
  assert.equal(moveResource(list, "zzz", "down"), list);
  assert.equal(nextPosition([]), 0);
  assert.equal(nextPosition(list), 3);
  assert.equal(isCompleteOrder(["a", "b"], ["b", "a"]), true);
  assert.equal(isCompleteOrder(["a", "b"], ["a", "a"]), false);
  assert.equal(isCompleteOrder(["a", "b"], ["a"]), false);
  assert.equal(isCompleteOrder(["a", "b"], ["a", "x"]), false);
});

test("a lesson holds at most twelve resources", () => {
  assert.equal(canAddResource(MAX_RESOURCES - 1), true);
  assert.equal(canAddResource(MAX_RESOURCES), false);
});
