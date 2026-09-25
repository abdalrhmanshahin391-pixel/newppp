import assert from "node:assert/strict";
import test from "node:test";
import { canStreamRitaSpeech, playRitaSpeechResponse } from "./rita-speech-stream.client.ts";

test("unsupported browsers use buffered playback", () => {
  const originalMediaSource = Object.getOwnPropertyDescriptor(globalThis, "MediaSource");
  try {
    Reflect.deleteProperty(globalThis, "MediaSource");
    assert.equal(canStreamRitaSpeech(), false);
    Object.defineProperty(globalThis, "MediaSource", {
      configurable: true,
      value: class {
        static isTypeSupported() {
          return false;
        }
      },
    });
    assert.equal(canStreamRitaSpeech(), false);
  } finally {
    if (originalMediaSource) Object.defineProperty(globalThis, "MediaSource", originalMediaSource);
    else Reflect.deleteProperty(globalThis, "MediaSource");
  }
});

test("buffered fallback plays the received file without another request", async () => {
  let plays = 0;
  let source = "";
  const blob = await playRitaSpeechResponse({
    response: new Response(new Uint8Array([1, 2, 3]), {
      headers: { "Content-Type": "audio/mpeg" },
    }),
    element: { play: async () => void (plays += 1) } as unknown as HTMLAudioElement,
    signal: new AbortController().signal,
    stream: false,
    setSource: (url) => {
      source = url;
    },
    onPlaybackBlocked: () => assert.fail("Playback should not be blocked"),
  });
  assert.equal(blob.size, 3);
  assert.equal(plays, 1);
  assert.match(source, /^blob:/);
  URL.revokeObjectURL(source);
});

test("buffered fallback preserves the server audio format", async () => {
  let source = "";
  const blob = await playRitaSpeechResponse({
    response: new Response(new Uint8Array([82, 73, 70, 70]), {
      headers: { "Content-Type": "audio/wav" },
    }),
    element: { play: async () => undefined } as unknown as HTMLAudioElement,
    signal: new AbortController().signal,
    stream: false,
    setSource: (url) => {
      source = url;
    },
    onPlaybackBlocked: () => assert.fail("Playback should not be blocked"),
  });
  assert.equal(blob.type, "audio/wav");
  URL.revokeObjectURL(source);
});

test("streamed audio starts playback before the full reply arrives", async () => {
  const originalMediaSource = Object.getOwnPropertyDescriptor(globalThis, "MediaSource");
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  class FakeSourceBuffer extends EventTarget {
    updating = false;
    buffered = { length: 0 };
    mode = "segments";
    appendBuffer() {
      this.updating = true;
      queueMicrotask(() => {
        this.updating = false;
        this.buffered.length = 1;
        this.dispatchEvent(new Event("updateend"));
      });
    }
  }
  class FakeMediaSource extends EventTarget {
    static isTypeSupported() {
      return true;
    }
    readyState = "closed";
    constructor() {
      super();
      queueMicrotask(() => {
        this.readyState = "open";
        this.dispatchEvent(new Event("sourceopen"));
      });
    }
    addSourceBuffer() {
      return new FakeSourceBuffer();
    }
    endOfStream() {
      this.readyState = "ended";
    }
  }
  Object.defineProperty(globalThis, "MediaSource", {
    configurable: true,
    value: FakeMediaSource,
  });
  URL.createObjectURL = () => "blob:mock-rita";
  URL.revokeObjectURL = () => undefined;

  try {
    assert.equal(canStreamRitaSpeech(), true);
    let releaseSecondChunk = () => {};
    const secondChunk = new Promise<void>((resolve) => {
      releaseSecondChunk = resolve;
    });
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          void secondChunk.then(() => {
            controller.enqueue(new Uint8Array([4, 5]));
            controller.close();
          });
        },
      }),
      { headers: { "Content-Type": "audio/mpeg" } },
    );
    let plays = 0;
    let completed = false;
    const result = playRitaSpeechResponse({
      response,
      element: { play: async () => void (plays += 1) } as unknown as HTMLAudioElement,
      signal: new AbortController().signal,
      stream: true,
      setSource: () => undefined,
      onPlaybackBlocked: () => assert.fail("Playback should not be blocked"),
    }).then((blob) => {
      completed = true;
      return blob;
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(plays, 1);
    assert.equal(completed, false);
    releaseSecondChunk();
    assert.equal((await result).size, 5);
  } finally {
    if (originalMediaSource) Object.defineProperty(globalThis, "MediaSource", originalMediaSource);
    else Reflect.deleteProperty(globalThis, "MediaSource");
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  }
});

test("a stream that cannot open its audio source falls back to the received file", async () => {
  const originalMediaSource = Object.getOwnPropertyDescriptor(globalThis, "MediaSource");
  const originalCreateObjectURL = URL.createObjectURL;
  class NeverOpens extends EventTarget {}
  Object.defineProperty(globalThis, "MediaSource", { configurable: true, value: NeverOpens });
  const sources: string[] = [];
  URL.createObjectURL = () => `blob:rita-${sources.length}`;
  try {
    let plays = 0;
    const blob = await playRitaSpeechResponse({
      response: new Response(new Uint8Array([1, 2, 3]), {
        headers: { "Content-Type": "audio/mpeg" },
      }),
      element: { play: async () => void (plays += 1) } as unknown as HTMLAudioElement,
      signal: new AbortController().signal,
      stream: true,
      setSource: (url) => sources.push(url),
      onPlaybackBlocked: () => assert.fail("Playback should not be blocked"),
    });
    assert.equal(blob.size, 3);
    assert.equal(plays, 1);
    assert.equal(sources.length, 2);
  } finally {
    if (originalMediaSource) Object.defineProperty(globalThis, "MediaSource", originalMediaSource);
    else Reflect.deleteProperty(globalThis, "MediaSource");
    URL.createObjectURL = originalCreateObjectURL;
  }
});
