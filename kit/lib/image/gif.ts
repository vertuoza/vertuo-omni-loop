// A GIF89a encoder of the kit's own (PRD 2100): the frames of `omni bug film`, drawn with no ffmpeg.
// Pure and deterministic: the same frames give the same bytes. One global table of at most 8
// colours, kept in the order they first appear, the format's LZW, and the looping extension.

/** The most colours the global table holds: a 3-bit table, enough for a card of text. */
const MAX_COLOURS = 8;
/** Codes grow to 12 bits: past 4096 entries the table is cleared and starts again. */
const MAX_CODE_SIZE = 12;
const TABLE_ENTRIES = 1 << MAX_CODE_SIZE;
const MAX_SIDE = 0xffff;
const BLOCK = 255;

/** One frame: `pixels` are 0xRRGGBB, row after row (only the low 24 bits are read); `delay` is in hundredths of a second. */
export type GifFrame = { pixels: Uint32Array; delay: number };

export type GifImage = { width: number; height: number; frames: readonly GifFrame[] };

const word = (value: number): number[] => [value & 0xff, value >>> 8];

/** The global table: each colour's position, in the order the frames first show it. Refuses a ninth. */
function paletteOf(frames: readonly GifFrame[]): Map<number, number> {
  const positions = new Map<number, number>();
  for (const { pixels } of frames) {
    for (const pixel of pixels) {
      const colour = pixel & 0xffffff;
      if (positions.has(colour)) continue;
      if (positions.size === MAX_COLOURS) {
        throw new RangeError(`a GIF here holds at most ${MAX_COLOURS} colours: #${colour.toString(16).padStart(6, '0')} is a ninth`);
      }
      positions.set(colour, positions.size);
    }
  }
  return positions;
}

/** The bits of a table that holds `colours` entries (2, 4 or 8 of them): at least 1. */
const tableBits = (colours: number): number => Math.max(1, 32 - Math.clz32(colours - 1));

/**
 * The LZW codes of `indices` (clear code first, end code last), packed least significant bit first
 * into bytes. The table is cleared the moment it is full, so a code never needs more than 12 bits.
 */
function lzw(indices: Uint8Array, minCode: number): number[] {
  const clear = 1 << minCode;
  const end = clear + 1;
  const bytes: number[] = [];
  let buffer = 0;
  let held = 0;
  const emit = (code: number, size: number): void => {
    buffer |= code << held;
    held += size;
    while (held >= 8) {
      bytes.push(buffer & 0xff);
      buffer >>>= 8;
      held -= 8;
    }
  };

  let size = minCode + 1;
  let next = end + 1;
  let table = new Map<number, number>();
  emit(clear, size);
  let prefix = indices[0] ?? 0;
  for (let at = 1; at < indices.length; at += 1) {
    const pixel = indices[at] ?? 0;
    const key = prefix * 256 + pixel;
    const known = table.get(key);
    if (known !== undefined) {
      prefix = known;
      continue;
    }
    emit(prefix, size);
    if (next < TABLE_ENTRIES) {
      table.set(key, next);
      if (next === 1 << size) size += 1;
      next += 1;
    } else {
      emit(clear, size);
      table = new Map();
      size = minCode + 1;
      next = end + 1;
    }
    prefix = pixel;
  }
  emit(prefix, size);
  emit(end, size);
  if (held > 0) bytes.push(buffer & 0xff);
  return bytes;
}

/** `bytes` as the format's data sub-blocks: runs of at most 255 bytes, each after its length, then a 0. */
function subBlocks(bytes: readonly number[]): number[] {
  const out: number[] = [];
  for (let from = 0; from < bytes.length; from += BLOCK) {
    const run = bytes.slice(from, from + BLOCK);
    out.push(run.length, ...run);
  }
  out.push(0);
  return out;
}

/** Whether `side` is a whole number of pixels GIF can hold. */
const sideFits = (side: number): boolean => Number.isInteger(side) && side >= 1 && side <= MAX_SIDE;

/** Throws a `RangeError` when `frame` does not fill a `width` by `height` image or holds a delay GIF cannot. */
function checkedFrame({ pixels, delay }: GifFrame, width: number, height: number): void {
  if (pixels.length !== width * height) {
    throw new RangeError(`a frame of ${pixels.length} pixels does not fill a ${width}x${height} image (${width * height})`);
  }
  if (!Number.isInteger(delay) || delay < 0 || delay > 0xffff) {
    throw new RangeError(`a frame's delay is 0 to 65535 hundredths of a second, not ${delay}`);
  }
}

function checked({ width, height, frames }: GifImage): void {
  if (!sideFits(width) || !sideFits(height)) {
    throw new RangeError(`a GIF's size is 1 to ${MAX_SIDE} pixels each way, not ${width}x${height}`);
  }
  if (frames.length === 0) throw new RangeError('a GIF needs a frame: no frame was given');
  for (const frame of frames) checkedFrame(frame, width, height);
}

/**
 * The bytes of a GIF89a that plays `frames` one after the other, forever. Every frame fills the whole
 * image and replaces the one before it. Throws a `RangeError` for more than 8 colours across the
 * frames, a frame that does not fill the image, a size or a delay GIF cannot hold, or no frame.
 */
export function encodeGif(image: GifImage): Uint8Array {
  checked(image);
  const { width, height, frames } = image;
  const palette = paletteOf(frames);
  const bits = tableBits(palette.size);
  const minCode = Math.max(2, bits);

  const bytes: number[] = [...Array.from('GIF89a', (letter) => letter.charCodeAt(0)), ...word(width), ...word(height), 0x80 | 0x70 | (bits - 1), 0, 0];
  const colours = Array.from(palette.keys());
  for (let slot = 0; slot < 1 << bits; slot += 1) {
    const colour = colours[slot] ?? 0;
    bytes.push((colour >>> 16) & 0xff, (colour >>> 8) & 0xff, colour & 0xff);
  }
  bytes.push(0x21, 0xff, 0x0b, ...Array.from('NETSCAPE2.0', (letter) => letter.charCodeAt(0)), 0x03, 0x01, ...word(0), 0x00);
  for (const { pixels, delay } of frames) {
    bytes.push(0x21, 0xf9, 0x04, 0x04, ...word(delay), 0x00, 0x00);
    bytes.push(0x2c, ...word(0), ...word(0), ...word(width), ...word(height), 0x00);
    const indices = Uint8Array.from(pixels, (pixel) => palette.get(pixel & 0xffffff) ?? 0);
    bytes.push(minCode);
    for (const byte of subBlocks(lzw(indices, minCode))) bytes.push(byte);
  }
  bytes.push(0x3b);
  return Uint8Array.from(bytes);
}
