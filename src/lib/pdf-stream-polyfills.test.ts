// Safari (before 26) cannot read a stream with `for await`, which pdf.js uses for a page's words:
// preparing a book stopped at page 0 with "undefined is not a function (near '...n of e...')".
import assert from "node:assert/strict";
import test from "node:test";
import { installStreamPolyfills } from "./pdf-stream-polyfills.ts";

/** A copy of this runtime's classes with Safari's gaps, so the real ones stay untouched. */
function safariLike() {
  class SafariStream<T> extends ReadableStream<T> {}
  const proto = SafariStream.prototype as unknown as Record<PropertyKey, unknown>;
  Object.defineProperty(proto, Symbol.asyncIterator, { value: undefined, configurable: true });
  Object.defineProperty(proto, "values", { value: undefined, configurable: true });
  class SafariResponse extends Response {}
  Object.defineProperty(SafariResponse.prototype, "bytes", {
    value: undefined,
    configurable: true,
  });
  class SafariBlob extends Blob {}
  Object.defineProperty(SafariBlob.prototype, "bytes", { value: undefined, configurable: true });
  class SafariPromise<T> extends Promise<T> {}
  Object.defineProperty(SafariPromise, "withResolvers", { value: undefined, configurable: true });
  return {
    ReadableStream: SafariStream,
    Response: SafariResponse,
    Blob: SafariBlob,
    Promise: SafariPromise,
  };
}

function chunks(parts: string[]) {
  return {
    start(controller: ReadableStreamDefaultController<string>) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  };
}

test("without the polyfill, `for await` over a stream fails as on Safari", async () => {
  const scope = safariLike();
  const stream = new scope.ReadableStream(chunks(["a"]));
  await assert.rejects(async () => {
    // @ts-expect-error: this stream is not async iterable, as on Safari
    for await (const part of stream) void part;
  }, TypeError);
});

test("for await reads every part of a stream after the polyfill", async () => {
  const scope = safariLike();
  installStreamPolyfills(scope);
  const stream = new scope.ReadableStream(chunks(["a", "b", "c"]));
  const seen: string[] = [];
  // @ts-expect-error: made iterable by the polyfill
  for await (const part of stream) seen.push(part);
  assert.deepEqual(seen, ["a", "b", "c"]);
  assert.equal(stream.locked, false);
});

test("leaving the loop early cancels the stream", async () => {
  const scope = safariLike();
  installStreamPolyfills(scope);
  let cancelled = false;
  const stream = new scope.ReadableStream<string>({
    pull(controller) {
      controller.enqueue("x");
    },
    cancel() {
      cancelled = true;
    },
  });
  // @ts-expect-error: made iterable by the polyfill
  for await (const part of stream) {
    void part;
    break;
  }
  assert.equal(cancelled, true);
});

test("bytes() and Promise.withResolvers are added where missing", async () => {
  const scope = safariLike();
  installStreamPolyfills(scope);
  const fromResponse = await (
    new scope.Response("hi") as unknown as { bytes(): Promise<Uint8Array> }
  ).bytes();
  assert.deepEqual([...fromResponse], [104, 105]);
  const fromBlob = await (
    new scope.Blob(["ok"]) as unknown as { bytes(): Promise<Uint8Array> }
  ).bytes();
  assert.deepEqual([...fromBlob], [111, 107]);
  const { promise, resolve } = (
    scope.Promise as unknown as {
      withResolvers<T>(): { promise: Promise<T>; resolve: (value: T) => void };
    }
  ).withResolvers<number>();
  resolve(7);
  assert.equal(await promise, 7);
});

test("browsers that already have them keep their own", () => {
  const scope = {
    ReadableStream,
    Response,
    Blob,
    Promise,
  };
  const proto = ReadableStream.prototype as unknown as Record<PropertyKey, unknown>;
  const before = proto[Symbol.asyncIterator];
  installStreamPolyfills(scope);
  assert.equal(proto[Symbol.asyncIterator], before);
});

test("the function can run alone from its own source, as it does in pdf.js' worker", async () => {
  const scope = safariLike();
  new Function("scope", `(${installStreamPolyfills.toString()})(scope);`)(scope);
  const seen: string[] = [];
  // @ts-expect-error: made iterable by the polyfill
  for await (const part of new scope.ReadableStream(chunks(["w"]))) seen.push(part);
  assert.deepEqual(seen, ["w"]);
});
