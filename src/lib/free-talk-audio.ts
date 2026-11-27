/**
 * The exact length of an MP3 clip, read from its own frames (the whiteboard's spoken explanations
 * are charged by it). Never trusts a length sent by a browser or a worker.
 *
 * Every MPEG audio frame says its bitrate, sample rate and layer, so its size and the number of
 * samples in it are known: the length is the samples of all frames divided by the sample rate. A
 * leading Xing/Info frame (VBR header) carries no sound and is skipped; an ID3v2 tag at the start
 * and an ID3v1 tag at the end are skipped. Returns null when nothing playable is found.
 */

// kbps by [MPEG-1 ? 0 : 1][layer 1..3][index]
const BITRATES: number[][][] = [
  [
    [],
    [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
    [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
    [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  ],
  [
    [],
    [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
    [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
    [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  ],
];

// Hz by version bits (0 = MPEG-2.5, 2 = MPEG-2, 3 = MPEG-1) and index
const SAMPLE_RATES: Record<number, number[]> = {
  0: [11025, 12000, 8000],
  2: [22050, 24000, 16000],
  3: [44100, 48000, 32000],
};

type Frame = { size: number; samples: number; rate: number; mono: boolean; mpeg1: boolean };

function readFrame(bytes: Uint8Array, at: number): Frame | null {
  if (at + 4 > bytes.length) return null;
  const b1 = bytes[at + 1]!;
  const b2 = bytes[at + 2]!;
  if (bytes[at] !== 0xff || (b1 & 0xe0) !== 0xe0) return null;
  const version = (b1 >> 3) & 3; // 1 is reserved
  const layerBits = (b1 >> 1) & 3; // 0 is reserved
  const bitrateIndex = (b2 >> 4) & 15;
  const rateIndex = (b2 >> 2) & 3;
  if (
    version === 1 ||
    layerBits === 0 ||
    bitrateIndex === 0 ||
    bitrateIndex === 15 ||
    rateIndex === 3
  )
    return null;
  const layer = 4 - layerBits; // 1, 2 or 3
  const mpeg1 = version === 3;
  const kbps = BITRATES[mpeg1 ? 0 : 1]![layer]![bitrateIndex]!;
  const rate = SAMPLE_RATES[version]![rateIndex]!;
  const padding = (b2 >> 1) & 1;
  const samples = layer === 1 ? 384 : layer === 2 || mpeg1 ? 1152 : 576;
  const size =
    layer === 1
      ? (Math.floor((12000 * kbps) / rate) + padding) * 4
      : Math.floor(((samples / 8) * kbps * 1000) / rate) + padding;
  if (size < 4) return null;
  const mono = ((bytes[at + 3]! >> 6) & 3) === 3;
  return { size, samples, rate, mono, mpeg1 };
}

/** A Xing/Info header inside the first frame: it carries no audio. */
function isInfoFrame(bytes: Uint8Array, at: number, frame: Frame): boolean {
  const side = frame.mpeg1 ? (frame.mono ? 17 : 32) : frame.mono ? 9 : 17;
  const tag = at + 4 + side;
  if (tag + 4 > bytes.length) return false;
  const word = String.fromCharCode(bytes[tag]!, bytes[tag + 1]!, bytes[tag + 2]!, bytes[tag + 3]!);
  return word === "Xing" || word === "Info";
}

function skipId3v2(bytes: Uint8Array): number {
  if (bytes.length < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return 0;
  const size =
    ((bytes[6]! & 0x7f) << 21) |
    ((bytes[7]! & 0x7f) << 14) |
    ((bytes[8]! & 0x7f) << 7) |
    (bytes[9]! & 0x7f);
  const footer = bytes[5]! & 0x10 ? 10 : 0;
  return 10 + size + footer;
}

/** Milliseconds of sound in an MP3, or null if it holds no readable frames. */
export function mp3DurationMs(bytes: Uint8Array): number | null {
  let end = bytes.length;
  // An ID3v1 tag ("TAG", 128 bytes) at the end is not audio.
  if (
    end >= 128 &&
    bytes[end - 128] === 0x54 &&
    bytes[end - 127] === 0x41 &&
    bytes[end - 126] === 0x47
  )
    end -= 128;
  let at = skipId3v2(bytes);
  let seconds = 0;
  let frames = 0;
  let first = true;
  while (at + 4 <= end) {
    const frame = readFrame(bytes, at);
    if (!frame) {
      // Look for the next frame (some encoders leave a few stray bytes).
      at += 1;
      continue;
    }
    if (at + frame.size > end) {
      // A cut-off last frame still plays the part that is there.
      seconds += ((end - at) / frame.size) * (frame.samples / frame.rate);
      frames += 1;
      break;
    }
    if (!(first && isInfoFrame(bytes, at, frame))) {
      seconds += frame.samples / frame.rate;
      frames += 1;
    }
    first = false;
    at += frame.size;
  }
  if (frames === 0) return null;
  return Math.round(seconds * 1000);
}
