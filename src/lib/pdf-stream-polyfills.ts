// What pdf.js needs and some browsers (Safari above all) do not have. Installed on the page by
// pdf-page-render.ts as soon as it loads, and in pdf.js' own worker through its wrapper.
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * What pdf.js v6 uses that its legacy build does not patch, and Safari lacks: reading a stream
 * with `for await` (page words: getTextContent; every Safari before 26), `Response`/`Blob`
 * `.bytes()` (fonts and maps; before Safari 18) and `Promise.withResolvers` (before 17.4).
 * Without the first, preparing a book stops at page 0 with "undefined is not a function
 * (near '...n of e...')" and a book's words cannot be selected. The worker gets the same code
 * (pdf-page-render.ts sends this function's own source to it), so it must stay plain and
 * self-contained: no imports, no outside names.
 */
export function installStreamPolyfills(scope: any) {
  const RS = scope.ReadableStream;
  if (RS?.prototype && typeof RS.prototype[Symbol.asyncIterator] !== "function") {
    const values = function (this: any, options?: { preventCancel?: boolean }) {
      const reader = this.getReader();
      const preventCancel = Boolean(options?.preventCancel);
      return {
        next() {
          return reader.read().then((result: any) => {
            if (result.done) reader.releaseLock();
            return result;
          });
        },
        return(value?: unknown) {
          const done = { done: true, value };
          if (preventCancel) {
            reader.releaseLock();
            return Promise.resolve(done);
          }
          return reader.cancel(value).then(
            () => {
              reader.releaseLock();
              return done;
            },
            () => done,
          );
        },
        [Symbol.asyncIterator]() {
          return this;
        },
      };
    };
    Object.defineProperty(RS.prototype, Symbol.asyncIterator, {
      value: values,
      writable: true,
      configurable: true,
    });
    if (typeof RS.prototype.values !== "function")
      Object.defineProperty(RS.prototype, "values", {
        value: values,
        writable: true,
        configurable: true,
      });
  }
  for (const Ctor of [scope.Response, scope.Blob]) {
    if (Ctor?.prototype && typeof Ctor.prototype.bytes !== "function")
      Object.defineProperty(Ctor.prototype, "bytes", {
        value: function (this: any) {
          return this.arrayBuffer().then((buffer: ArrayBuffer) => new Uint8Array(buffer));
        },
        writable: true,
        configurable: true,
      });
  }
  const P = scope.Promise;
  if (P && typeof P.withResolvers !== "function")
    Object.defineProperty(P, "withResolvers", {
      value: function () {
        let resolve: unknown;
        let reject: unknown;
        const promise = new P((yes: unknown, no: unknown) => {
          resolve = yes;
          reject = no;
        });
        return { promise, resolve, reject };
      },
      writable: true,
      configurable: true,
    });
}
