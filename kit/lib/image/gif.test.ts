import { describe, expect, it } from 'vitest';
import { encodeGif } from './gif.ts';

const BLACK = 0x000000;
const WHITE = 0xffffff;
const RED = 0xff0000;
const GREEN = 0x00ff00;

/** What the test's decoder reads out of a GIF: its size, frames (colours as 0xRRGGBB), delays and loop count. */
type Decoded = { width: number; height: number; palette: number[]; frames: { pixels: number[]; delay: number }[]; loops: number | null };

/** A cursor over a GIF's bytes, for the test's decoder. */
type Reader = { bytes: Uint8Array; at: number };

const byteAt = ({ bytes }: Reader, at: number): number => bytes[at] ?? 0;
const wordAt = (reader: Reader, at: number): number => byteAt(reader, at) + byteAt(reader, at + 1) * 256;
const textAt = ({ bytes }: Reader, from: number, length: number): string => String.fromCharCode(...bytes.slice(from, from + length));

/** The data sub-blocks at the cursor, joined; the cursor ends past the 0 that closes them. */
function readSubBlocks(reader: Reader): number[] {
  const data: number[] = [];
  for (let size = byteAt(reader, reader.at); size > 0; size = byteAt(reader, reader.at)) {
    data.push(...reader.bytes.slice(reader.at + 1, reader.at + 1 + size));
    reader.at += 1 + size;
  }
  reader.at += 1;
  return data;
}

/** The global colour table the screen descriptor announces, as 0xRRGGBB; the cursor ends past it. */
function readPalette(reader: Reader): number[] {
  const screen = byteAt(reader, 10);
  const palette: number[] = [];
  reader.at = 13;
  if ((screen & 0x80) === 0) return palette;
  for (let index = 0; index < 2 ** ((screen & 7) + 1); index += 1) {
    palette.push((byteAt(reader, reader.at) << 16) | (byteAt(reader, reader.at + 1) << 8) | byteAt(reader, reader.at + 2));
    reader.at += 3;
  }
  return palette;
}

/** The extension at the cursor: the delay a graphic control sets, or the loop count the NETSCAPE block sets. */
function readExtension(reader: Reader): { delay: number | null; loops: number | null } {
  const label = byteAt(reader, reader.at + 1);
  reader.at += 2;
  if (label === 0xf9) {
    const delay = wordAt(reader, reader.at + 2);
    readSubBlocks(reader);
    return { delay, loops: null };
  }
  const data = readSubBlocks(reader);
  const looping = label === 0xff && String.fromCharCode(...data.slice(0, 11)) === 'NETSCAPE2.0' && data[11] === 1;
  return { delay: null, loops: looping ? (data[12] ?? 0) + (data[13] ?? 0) * 256 : null };
}

/** The image at the cursor, its colours looked up in `palette`, held for `delay`. */
function readImage(reader: Reader, palette: number[], count: number, delay: number): Decoded['frames'][number] {
  if (byteAt(reader, reader.at + 9) & 0xc0) throw new Error('local table and interlace are not read here');
  const minCode = byteAt(reader, reader.at + 10);
  reader.at += 11;
  const indices = lzwDecode(minCode, readSubBlocks(reader), count);
  return { pixels: indices.map((index) => palette[index] ?? -1), delay };
}

/** A GIF decoder written for the test, from the format's own rules, not from the encoder's. */
function decode(bytes: Uint8Array): Decoded {
  const reader: Reader = { bytes, at: 0 };
  if (textAt(reader, 0, 6) !== 'GIF89a') throw new Error('not a GIF89a');
  const width = wordAt(reader, 6);
  const height = wordAt(reader, 8);
  const palette = readPalette(reader);
  const frames: Decoded['frames'] = [];
  let loops: number | null = null;
  let delay = 0;
  while (byteAt(reader, reader.at) !== 0x3b) {
    const introducer = byteAt(reader, reader.at);
    if (introducer === 0x21) {
      const extension = readExtension(reader);
      delay = extension.delay ?? delay;
      loops = extension.loops ?? loops;
    } else if (introducer === 0x2c) {
      frames.push(readImage(reader, palette, width * height, delay));
    } else {
      throw new Error(`unknown block ${introducer} at ${reader.at}`);
    }
  }
  return { width, height, palette, frames, loops };
}

/** The LZW decoder's table, the size of its codes and the string it read last. */
type Lzw = { table: number[][]; size: number; previous: number[] | null };

/** The table of a fresh start: one string per colour, then the clear and end codes. */
function lzwReset(minCode: number): Lzw {
  const table: number[][] = Array.from({ length: 1 << minCode }, (_value, index) => [index]);
  table.push([], []);
  return { table, size: minCode + 1, previous: null };
}

/** The string `code` stands for; a code not yet in the table stands for the last string and its own first pixel. */
function stringOf(state: Lzw, code: number): number[] {
  const entry = state.table[code];
  if (entry !== undefined) return entry;
  if (state.previous === null) throw new Error('a code before any string');
  return [...state.previous, state.previous[0] ?? 0];
}

/** Reads one code that is neither clear nor end: the pixels it stands for, with the table grown after it. */
function lzwStep(state: Lzw, code: number): number[] {
  const entry = stringOf(state, code);
  if (state.previous !== null) state.table.push([...state.previous, entry[0] ?? 0]);
  state.previous = entry;
  if (state.table.length === 1 << state.size && state.size < 12) state.size += 1;
  return entry;
}

/** The GIF flavour of LZW, read LSB first, with codes growing from `minCode + 1` bits up to 12. */
function lzwDecode(minCode: number, data: number[], count: number): number[] {
  const clear = 1 << minCode;
  let state = lzwReset(minCode);
  let buffer = 0;
  let held = 0;
  const out: number[] = [];
  for (const byte of data) {
    buffer |= byte << held;
    held += 8;
    while (held >= state.size) {
      const code = buffer & ((1 << state.size) - 1);
      buffer >>>= state.size;
      held -= state.size;
      if (code === clear + 1) return out.slice(0, count);
      if (code === clear) state = lzwReset(minCode);
      else out.push(...lzwStep(state, code));
    }
  }
  throw new Error('no end code');
}

const hex = (bytes: Uint8Array): string => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(' ');

describe('encodeGif', () => {
  it('encodes a 4x2 image to known bytes', () => {
    // Worked by hand: two colours, so a 2-entry table and 2-bit codes that start at 3 bits; the
    // indices 0 1 0 1 1 0 1 0 give clear, 0, 1, 6, 7, 7, end, packed LSB first into 44 7c 57.
    const image = new Uint32Array([BLACK, WHITE, BLACK, WHITE, WHITE, BLACK, WHITE, BLACK]);
    const bytes = encodeGif({ width: 4, height: 2, frames: [{ pixels: image, delay: 300 }] });
    expect(hex(bytes)).toBe(
      [
        '47 49 46 38 39 61', // GIF89a
        '04 00 02 00 f0 00 00', // 4x2, a global table of 2 colours, background 0, no aspect
        '00 00 00 ff ff ff', // the table: black, white
        '21 ff 0b 4e 45 54 53 43 41 50 45 32 2e 30 03 01 00 00 00', // NETSCAPE2.0, loop forever
        '21 f9 04 04 2c 01 00 00', // graphic control: kept, 300 hundredths, no transparency
        '2c 00 00 00 00 04 00 02 00 00', // image at 0,0, 4x2, no local table
        '02 03 44 7c 57 00', // codes of 2 bits, one block of 3 bytes
        '3b', // trailer
      ].join(' '),
    );
  });

  it('reads back every pixel of a two-frame image, its delays and its looping extension', () => {
    const width = 7;
    const height = 5;
    const first = new Uint32Array(width * height).fill(BLACK);
    const second = new Uint32Array(width * height).fill(BLACK);
    for (let at = 0; at < width * height; at += 1) {
      first[at] = at % 3 === 0 ? RED : at % 4 === 0 ? WHITE : BLACK;
      second[at] = at % 5 === 0 ? GREEN : at % 2 === 0 ? WHITE : BLACK;
    }
    const decoded = decode(encodeGif({ width, height, frames: [{ pixels: first, delay: 300 }, { pixels: second, delay: 300 }] }));
    expect(decoded.width).toBe(width);
    expect(decoded.height).toBe(height);
    expect(decoded.frames.map((frame) => frame.delay)).toEqual([300, 300]);
    expect(decoded.frames[0]?.pixels).toEqual(Array.from(first));
    expect(decoded.frames[1]?.pixels).toEqual(Array.from(second));
    expect(decoded.loops).toBe(0);
  });

  it('reads back an image long enough to fill and reset the code table', () => {
    // 4 colours in a pseudo-random order: no string repeats for long, so the table reaches 4096.
    const width = 200;
    const height = 120;
    const colours = [BLACK, WHITE, RED, GREEN];
    let seed = 12345;
    const pixels = new Uint32Array(width * height).map(() => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return colours[(seed >>> 16) % 4] ?? BLACK;
    });
    const decoded = decode(encodeGif({ width, height, frames: [{ pixels, delay: 7 }] }));
    expect(decoded.frames[0]?.pixels).toEqual(Array.from(pixels));
    expect(decoded.frames[0]?.delay).toBe(7);
  });

  it('keeps one global table of the colours in the order they first appear', () => {
    const decoded = decode(
      encodeGif({
        width: 2,
        height: 1,
        frames: [
          { pixels: new Uint32Array([RED, BLACK]), delay: 10 },
          { pixels: new Uint32Array([GREEN, RED]), delay: 10 },
        ],
      }),
    );
    expect(decoded.palette.slice(0, 3)).toEqual([RED, BLACK, GREEN]);
    expect(decoded.palette).toHaveLength(4);
  });

  it('holds eight colours and refuses a ninth', () => {
    const eight = Array.from({ length: 8 }, (_value, index) => index * 0x010101);
    const frame = (colours: number[]) => ({ pixels: new Uint32Array(colours), delay: 5 });
    const decoded = decode(encodeGif({ width: 8, height: 1, frames: [frame(eight)] }));
    expect(decoded.frames[0]?.pixels).toEqual(eight);
    expect(decoded.palette).toEqual(eight);
    expect(() => encodeGif({ width: 9, height: 1, frames: [frame([...eight, 0x808080])] })).toThrow('at most 8 colours');
    // the ninth may come from a later frame
    expect(() => encodeGif({ width: 8, height: 1, frames: [frame(eight), frame([0x808080, ...eight.slice(1)])] })).toThrow('at most 8 colours');
  });

  it('gives the same bytes for the same frames', () => {
    const frames = [{ pixels: new Uint32Array([RED, WHITE, BLACK, RED]), delay: 300 }];
    expect(encodeGif({ width: 2, height: 2, frames })).toEqual(encodeGif({ width: 2, height: 2, frames }));
  });

  it('refuses frames that do not fit the size, an empty list and a size GIF cannot hold', () => {
    const pixels = new Uint32Array(3);
    expect(() => encodeGif({ width: 2, height: 2, frames: [{ pixels, delay: 5 }] })).toThrow('2x2');
    expect(() => encodeGif({ width: 2, height: 2, frames: [] })).toThrow('no frame');
    expect(() => encodeGif({ width: 0, height: 2, frames: [{ pixels: new Uint32Array(0), delay: 5 }] })).toThrow('size');
    expect(() => encodeGif({ width: 65536, height: 1, frames: [{ pixels: new Uint32Array(65536), delay: 5 }] })).toThrow('size');
    expect(() => encodeGif({ width: 1, height: 1, frames: [{ pixels: new Uint32Array(1), delay: 65536 }] })).toThrow('delay');
    expect(() => encodeGif({ width: 1, height: 1, frames: [{ pixels: new Uint32Array(1), delay: -1 }] })).toThrow('delay');
  });
});
