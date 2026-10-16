import { describe, expect, it } from 'vitest';
import { CARD, cardLines, copiedNames, failingLine, filmArgs, filmGif, filmKind, passingLine, renderCard, runJson } from './film.ts';

describe('filmKind', () => {
  it('reads two .txt as text and two .webm as clips, any case', () => {
    expect(filmKind('a.txt', 'b.TXT')).toBe('text');
    expect(filmKind('a.webm', 'b.webm')).toBe('clips');
  });
  it('refuses a mix and another type', () => {
    expect(filmKind('a.txt', 'b.webm')).toBeNull();
    expect(filmKind('a.log', 'b.log')).toBeNull();
  });
});

describe('cardLines', () => {
  const numbered = (count: number, at: Record<number, string> = {}): string =>
    Array.from({ length: count }, (_v, index) => at[index + 1] ?? `line ${index + 1}`).join('\n');

  it('drops ANSI sequences, then carriage returns', () => {
    const output = '\u001b[31mFAIL\u001b[0m  \u001b[1;32msaves\u001b[39m\r\nprogress 10%\r20%\r30%\n\u001b]0;title\u0007after\u001b[2K\u001b(B\n';
    expect(cardLines(output, 'red').lines).toEqual(['FAIL  saves', 'progress 10%20%30%', 'after']);
  });

  it('turns a tab into two spaces and cuts each line to 100 characters', () => {
    const { lines } = cardLines(`\tindented\n${'x'.repeat(150)}\n${'a'.repeat(99)}✓✓`, 'red');
    expect(lines[0]).toBe('  indented');
    expect(lines[1]).toBe('x'.repeat(100));
    expect(lines[2]).toBe(`${'a'.repeat(99)}✓`);
  });

  it('drops the blank lines at the end and holds nothing for an empty output', () => {
    expect(cardLines('one\ntwo\n\n  \n\n', 'red').lines).toEqual(['one', 'two']);
    expect(cardLines('', 'green')).toEqual({ lines: [], highlight: null });
    expect(cardLines(' \n\n', 'red')).toEqual({ lines: [], highlight: null });
  });

  it('keeps the last 20 lines', () => {
    const { lines, highlight } = cardLines(numbered(30, { 25: 'FAIL here' }), 'red');
    expect(lines).toHaveLength(20);
    expect(lines[0]).toBe('line 11');
    expect(lines.at(-1)).toBe('line 30');
    expect(highlight).toBe(14);
    expect(lines[14]).toBe('FAIL here');
  });

  it('starts two lines above a highlighted line that sits higher, so its assertion stays in view', () => {
    const { lines, highlight } = cardLines(numbered(40, { 6: 'AssertionError: 2 != 1' }), 'red');
    expect(lines).toHaveLength(20);
    expect(lines[0]).toBe('line 4');
    expect(highlight).toBe(2);
    expect(lines[2]).toBe('AssertionError: 2 != 1');
    expect(lines.at(-1)).toBe('line 23');
  });

  it('starts at the top when the highlighted line is within two lines of it', () => {
    const { lines, highlight } = cardLines(numbered(40, { 2: 'FAIL early' }), 'red');
    expect(lines[0]).toBe('line 1');
    expect(highlight).toBe(1);
    expect(cardLines(numbered(40, { 3: 'FAIL early' }), 'red').highlight).toBe(2);
    expect(cardLines(numbered(40, { 4: 'FAIL early' }), 'red').lines[0]).toBe('line 2');
  });

  it('holds a short output whole, the highlight where the first failing or passing line is', () => {
    expect(cardLines('run\nAssertionError: expected 2 to be 1\nat x', 'red')).toEqual({
      lines: ['run', 'AssertionError: expected 2 to be 1', 'at x'],
      highlight: 1,
    });
    expect(cardLines('run\n✓ saves once\n1 passed', 'green').highlight).toBe(1);
  });

  it('highlights the first non-empty line when none reads as failing or passing', () => {
    expect(cardLines('\n\nalpha\nbeta', 'red').highlight).toBe(2);
    expect(cardLines('alpha\nbeta', 'green').highlight).toBe(0);
  });

  it('reads the highlight from the line as printed, without its colour codes', () => {
    expect(cardLines('a\nfa\u001b[0mil\nb', 'red').highlight).toBe(1);
  });
});

/** The card's pixels as the 0xRRGGBB colours found in the box of a text line (index `line`). */
function coloursOfLine(pixels: Uint32Array, line: number): Set<number> {
  const found = new Set<number>();
  const top = CARD.textTop + line * CARD.pitch;
  for (let y = top; y < top + 13; y += 1) {
    for (let x = CARD.margin; x < CARD.margin + CARD.columns * 6; x += 1) found.add(pixels[y * CARD.width + x] ?? -1);
  }
  return found;
}

const channels = (colour: number): [number, number, number] => [(colour >> 16) & 0xff, (colour >> 8) & 0xff, colour & 0xff];
/** Red as the band and the failing line are: the red channel leads, the others stay low. */
const isRed = (colour: number): boolean => {
  const [red, green, blue] = channels(colour);
  return red >= 0x90 && green <= 0x80 && blue <= 0x80;
};
/** Green as the band and the passing line are: the green channel leads, the others stay low. */
const isGreen = (colour: number): boolean => {
  const [red, green, blue] = channels(colour);
  return green >= 0x80 && red <= 0x90 && blue <= 0xa0;
};
const isGrey = (colour: number): boolean => channels(colour).every((value) => value >= 0xc0 && value <= 0xf0);
const isInk = (colour: number): boolean => colour !== 0x111111;

describe('renderCard', () => {
  const RED_OUTPUT = 'run 1\nAssertionError: expected 2 to be 1\nat save (app/save.test.mjs:9)';
  const GREEN_OUTPUT = 'run 1\n✓ saves once\n1 passed';

  it('is 640x360, #111111 behind the text, with a title band across the top', () => {
    const red = renderCard('red', RED_OUTPUT);
    expect(CARD.width).toBe(640);
    expect(CARD.height).toBe(360);
    expect(red).toHaveLength(640 * 360);
    expect(red[CARD.height * CARD.width - 1]).toBe(0x111111);
    expect(red[CARD.band * CARD.width + 5]).toBe(0x111111);
    expect(isRed(red[0] ?? 0)).toBe(true);
    expect(isRed(red[(CARD.band - 1) * CARD.width + CARD.width - 1] ?? 0)).toBe(true);
    const green = renderCard('green', GREEN_OUTPUT);
    expect(isGreen(green[0] ?? 0)).toBe(true);
    expect(isGreen(green[(CARD.band - 1) * CARD.width + CARD.width - 1] ?? 0)).toBe(true);
  });

  it('writes the title in white on the band, at twice the font size', () => {
    const band = (card: Uint32Array): number[] => Array.from(card.subarray(0, CARD.band * CARD.width));
    const whiteRows = (card: Uint32Array): number[] => {
      const rows = new Set<number>();
      for (let y = 0; y < CARD.band; y += 1) {
        for (let x = 0; x < CARD.width; x += 1) if (card[y * CARD.width + x] === 0xffffff) rows.add(y);
      }
      return [...rows];
    };
    const red = renderCard('red', '');
    const rows = whiteRows(red);
    // "Before the fix · red" has no descender: a capital is 9 font rows, so 18 rows at twice the size
    expect(Math.max(...rows) - Math.min(...rows) + 1).toBe(18);
    expect(Math.min(...rows)).toBeGreaterThan(0);
    expect(Math.max(...rows)).toBeLessThan(CARD.band - 1);
    // an empty output leaves everything below the band as the background
    expect(Array.from(red.subarray(CARD.band * CARD.width)).every((colour) => colour === 0x111111)).toBe(true);
    expect(band(renderCard('green', ''))).not.toEqual(band(red));
  });

  it('draws the first failing line in red on the red card, every other line in light grey', () => {
    const card = renderCard('red', RED_OUTPUT);
    const failing = [...coloursOfLine(card, 1)].filter(isInk);
    expect(failing.length).toBeGreaterThan(0);
    expect(failing.every(isRed)).toBe(true);
    for (const line of [0, 2]) {
      const ink = [...coloursOfLine(card, line)].filter(isInk);
      expect(ink.length).toBeGreaterThan(0);
      expect(ink.every(isGrey)).toBe(true);
    }
    expect([...coloursOfLine(card, 3)]).toEqual([0x111111]);
  });

  it('draws the first passing line in green on the green card, every other line in light grey', () => {
    const card = renderCard('green', GREEN_OUTPUT);
    const passing = [...coloursOfLine(card, 1)].filter(isInk);
    expect(passing.length).toBeGreaterThan(0);
    expect(passing.every(isGreen)).toBe(true);
    for (const line of [0, 2]) {
      const ink = [...coloursOfLine(card, line)].filter(isInk);
      expect(ink.length).toBeGreaterThan(0);
      expect(ink.every(isGrey)).toBe(true);
    }
  });

  it('draws a character outside the font as a question mark', () => {
    expect(renderCard('red', 'FAIL é 日 x')).toEqual(renderCard('red', 'FAIL ? ? x'));
    expect(renderCard('red', 'FAIL é')).not.toEqual(renderCard('red', 'FAIL e'));
  });

  it('draws a line of 100 characters inside its margins', () => {
    const card = renderCard('red', `${'W'.repeat(100)}\n${'W'.repeat(150)}`);
    const stray: number[] = [];
    for (let y: number = CARD.band; y < CARD.height; y += 1) {
      for (let x = 0; x < CARD.width; x += 1) {
        const inside = x >= CARD.margin && x < CARD.margin + CARD.columns * 6;
        if (!inside && card[y * CARD.width + x] !== 0x111111) stray.push(x);
      }
    }
    expect(stray).toEqual([]);
    expect(coloursOfLine(card, 1).size).toBeGreaterThan(1);
  });

  it('shows 20 lines, the last one clear of the bottom edge', () => {
    const card = renderCard('green', Array.from({ length: 25 }, (_v, index) => `WWWW ${index}`).join('\n'));
    expect(CARD.textTop + 19 * CARD.pitch + 13).toBeLessThanOrEqual(CARD.height);
    expect(coloursOfLine(card, 19).size).toBeGreaterThan(1);
    expect(Array.from(card.subarray((CARD.textTop + 19 * CARD.pitch + 13) * CARD.width)).every((colour) => colour === 0x111111)).toBe(true);
  });
});

describe('filmGif', () => {
  const hexOf = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');
  const gif = filmGif('run\nAssertionError: expected 2 to be 1\n', 'run\n✓ saves once\n');

  it('is a GIF89a of 640x360 that loops forever, two frames held 3 seconds each', () => {
    const hex = hexOf(gif);
    expect(hex.startsWith('474946383961' + '8002' + '6801')).toBe(true);
    // the looping extension: sub-block of 3 bytes, id 1, a count of 0 (forever), end of block
    expect(hex.includes(`${Buffer.from('NETSCAPE2.0').toString('hex')}0301000000`)).toBe(true);
    expect(hex.match(/21f904042c010000/g)).toHaveLength(2);
    expect(hex.match(/2c000000008002680100/g)).toHaveLength(2);
    expect(hex.endsWith('3b')).toBe(true);
  });

  it('gives the same bytes for the same outputs, and other bytes for other outputs', () => {
    expect(filmGif('run\nAssertionError: expected 2 to be 1\n', 'run\n✓ saves once\n')).toEqual(gif);
    expect(filmGif('run\nAssertionError: expected 3 to be 1\n', 'run\n✓ saves once\n')).not.toEqual(gif);
  });

  it('draws any text within the 8 colours of its table, every ASCII character included', () => {
    const everything = Array.from({ length: 95 }, (_v, index) => String.fromCharCode(32 + index)).join('');
    expect(() => filmGif(`${everything}\n✓✗×❯›·•→─│\n\u001b[31mred\u001b[0m`, `${everything}\nok`)).not.toThrow();
    expect(() => filmGif('', '')).not.toThrow();
  });

  it('is small: a card of text is a few kilobytes', () => {
    expect(gif.length).toBeLessThan(20_000);
  });
});

describe('filmArgs', () => {
  it('reads two clips up to 4 seconds each, captioned', () => {
    const args = filmArgs({ before: '/o/before.webm', after: '/o/after.webm', out: '/o/preview.gif' });
    expect(args.filter((arg) => arg === '-t')).toHaveLength(2);
    expect(args).toContain('4');
    expect(args).toContain('/o/before.webm');
    const graph = args[args.indexOf('-filter_complex') + 1] ?? '';
    expect(graph).toContain('fps=10,scale=640:');
    expect(graph).toContain('Before the fix');
    expect(graph).toContain('After the fix');
    expect(args.slice(-3)).toEqual(['-loop', '0', '/o/preview.gif']);
  });

  it('is the same ffmpeg call it has always been', () => {
    const caption = (text: string, index: number): string =>
      `[${index}:v]fps=10,scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2,setsar=1,` +
      `drawtext=font=monospace:text='${text}':fontcolor=white:fontsize=20:box=1:boxcolor=0x000000AA:boxborderw=6:x=12:y=12[c${index}]`;
    const graph = `${caption('Before the fix', 0)};${caption('After the fix', 1)};[c0][c1]concat=n=2:v=1:a=0,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`;
    expect(filmArgs({ before: '/o/before.webm', after: '/o/after.webm', out: '/o/preview.gif' })).toEqual([
      '-y',
      '-t',
      '4',
      '-i',
      '/o/before.webm',
      '-t',
      '4',
      '-i',
      '/o/after.webm',
      '-filter_complex',
      graph,
      '-loop',
      '0',
      '/o/preview.gif',
    ]);
  });
});

describe('notes and run.json', () => {
  it('finds the first failing and passing line, else the first line', () => {
    expect(failingLine('start\nAssertionError: 2 != 1\nmore')).toBe('AssertionError: 2 != 1');
    expect(failingLine('boom')).toBe('boom');
    expect(passingLine('start\n✓ saves once\n')).toBe('✓ saves once');
    expect(failingLine('')).toBe('');
  });

  it('reads the line as printed, without its colour codes', () => {
    expect(failingLine('start\n\u001b[31m  FAIL  saves\u001b[0m\n')).toBe('FAIL  saves');
  });

  it('names a script for text and a video for clips', () => {
    const url = 'https://github.com/a/b/issues/1';
    const text = runJson({ commit: 'abcdef1', url, kind: 'text', red: 'FAIL x', green: 'PASS x' });
    expect(text.criteria.map((c) => c.script)).toEqual(['red.txt', 'green.txt']);
    expect(text.criteria[0]?.note).toBe('FAIL x');
    const clips = runJson({ commit: 'abcdef1', url, kind: 'clips', red: '', green: '' });
    expect(clips.criteria.map((c) => c.video)).toEqual(['before.webm', 'after.webm']);
    expect(copiedNames('clips')).toEqual(['before.webm', 'after.webm']);
  });
});
