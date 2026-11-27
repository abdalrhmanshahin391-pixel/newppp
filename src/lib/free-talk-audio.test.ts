import test from "node:test";
import assert from "node:assert/strict";
import { mp3DurationMs } from "./free-talk-audio.ts";

/** MPEG-1 Layer III, 44.1 kHz, 96 kbps (what the whiteboard's voice asks Cartesia for). */
function frame(padding: 0 | 1, fill = 0x55, mono = false): number[] {
  const size = Math.floor((144 * 96000) / 44100) + padding; // 313 or 314
  const bytes = new Array<number>(size).fill(fill);
  bytes[0] = 0xff;
  bytes[1] = 0xfb; // MPEG-1, Layer III, no CRC
  bytes[2] = (7 << 4) | (0 << 2) | (padding << 1); // 96 kbps, 44.1 kHz
  bytes[3] = mono ? 0xc0 : 0x44;
  return bytes;
}

const ms = (frames: number) => Math.round(((frames * 1152) / 44100) * 1000);

test("counts every frame: 100 frames of 1152 samples at 44.1 kHz", () => {
  const audio = new Uint8Array(
    Array.from({ length: 100 }, (_, i) => frame(i % 3 === 0 ? 1 : 0)).flat(),
  );
  assert.equal(mp3DurationMs(audio), ms(100));
  assert.equal(mp3DurationMs(audio), 2612);
});

test("a 30-second clip is 30 seconds", () => {
  const frames = Math.round((30 * 44100) / 1152); // 1148
  const audio = new Uint8Array(Array.from({ length: frames }, () => frame(0)).flat());
  const length = mp3DurationMs(audio)!;
  assert.ok(Math.abs(length - 30000) < 30, String(length));
});

test("skips an ID3v2 tag at the start and an ID3v1 tag at the end", () => {
  const id3 = [0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 20, ...new Array(20).fill(0xff)];
  const tail = [0x54, 0x41, 0x47, ...new Array(125).fill(0xff)];
  const audio = new Uint8Array([
    ...id3,
    ...Array.from({ length: 10 }, () => frame(0)).flat(),
    ...tail,
  ]);
  assert.equal(mp3DurationMs(audio), ms(10));
});

test("a leading Xing/Info frame carries no sound", () => {
  const info = frame(0, 0);
  const tag = 4 + 32; // stereo MPEG-1 side information
  ["I", "n", "f", "o"].forEach((c, i) => (info[tag + i] = c.charCodeAt(0)));
  const audio = new Uint8Array([...info, ...Array.from({ length: 50 }, () => frame(0)).flat()]);
  assert.equal(mp3DurationMs(audio), ms(50));
  // Mono files keep the tag closer to the header.
  const monoInfo = frame(0, 0, true);
  ["X", "i", "n", "g"].forEach((c, i) => (monoInfo[4 + 17 + i] = c.charCodeAt(0)));
  const mono = new Uint8Array([
    ...monoInfo,
    ...Array.from({ length: 5 }, () => frame(0, 0x55, true)).flat(),
  ]);
  assert.equal(mp3DurationMs(mono), ms(5));
});

test("MPEG-2 Layer III frames hold 576 samples", () => {
  // MPEG-2, Layer III, 22.05 kHz, 64 kbps: 72 * 64000 / 22050 = 208 bytes.
  const one = new Array<number>(208).fill(0x11);
  one[0] = 0xff;
  one[1] = 0xf3;
  one[2] = 8 << 4;
  one[3] = 0x44;
  const audio = new Uint8Array(Array.from({ length: 40 }, () => one).flat());
  assert.equal(mp3DurationMs(audio), Math.round(((40 * 576) / 22050) * 1000));
});

test("a cut-off last frame counts only the part that is there", () => {
  const whole = Array.from({ length: 4 }, () => frame(0)).flat();
  const audio = new Uint8Array([...whole, ...frame(0).slice(0, 156)]);
  const length = mp3DurationMs(audio)!;
  assert.ok(length > ms(4) && length < ms(5), String(length));
});

test("nothing playable gives null", () => {
  assert.equal(mp3DurationMs(new Uint8Array(0)), null);
  assert.equal(mp3DurationMs(new Uint8Array(500).fill(0x20)), null);
  assert.equal(mp3DurationMs(new TextEncoder().encode("<html>error</html>")), null);
});
