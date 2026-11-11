// Encodes WebP in a worker, for browsers whose canvas cannot (Safari makes PNG instead). Used
// only while an admin prepares a book; the WebAssembly encoder is loaded on first use.
//
// The encoder is loaded straight from its files (the faster SIMD build where the browser has
// SIMD), not through "@jsquash/webp/encode": that one checks SIMD with a library whose code the
// site's build cannot read.
// Both builds are imported up front: a worker is one file (no split parts), and each is only the
// small loader; the WebAssembly itself is fetched when the encoder starts.
import { defaultOptions } from "@jsquash/webp/meta.js";
import plainFactory from "@jsquash/webp/codec/enc/webp_enc.js";
import simdFactory from "@jsquash/webp/codec/enc/webp_enc_simd.js";
// Their WebAssembly files, by address: the loaders' own guess is wrong in the dev server.
import plainWasm from "@jsquash/webp/codec/enc/webp_enc.wasm?url";
import simdWasm from "@jsquash/webp/codec/enc/webp_enc_simd.wasm?url";

type Job = { id: number; width: number; height: number; data: ArrayBuffer; quality: number };
type Encoder = {
  encode: (
    data: Uint8ClampedArray,
    width: number,
    height: number,
    options: typeof defaultOptions,
  ) => Uint8Array | null;
};

// The smallest WebAssembly module that uses a SIMD instruction (as wasm-feature-detect checks).
const SIMD_PROBE = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15,
  253, 98, 11,
]);

let encoder: Promise<Encoder> | null = null;
function loadEncoder(): Promise<Encoder> {
  encoder ??= (async () => {
    const simd = WebAssembly.validate(SIMD_PROBE);
    const factory = simd ? simdFactory : plainFactory;
    const wasm = simd ? simdWasm : plainWasm;
    return (await factory({ noInitialRun: true, locateFile: () => wasm })) as unknown as Encoder;
  })();
  return encoder;
}

self.onmessage = async (event: MessageEvent<Job>) => {
  const { id, width, height, data, quality } = event.data;
  try {
    const module = await loadEncoder();
    const result = module.encode(new Uint8ClampedArray(data), width, height, {
      ...defaultOptions,
      quality: Math.round(quality * 100),
    });
    if (!result) throw new Error("Encoding error.");
    const out = result.buffer as ArrayBuffer;
    (self as unknown as Worker).postMessage({ id, out }, [out]);
  } catch (error) {
    encoder = null;
    (self as unknown as Worker).postMessage({ id, error: String(error) });
  }
};
