import { describe, expect, it } from 'vitest';
import { cardText, copiedNames, failingLine, filmArgs, filmKind, passingLine, runJson } from './film.ts';

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

describe('cardText', () => {
  it('keeps the last 20 lines, each cut to 100 characters', () => {
    const output = Array.from({ length: 30 }, (_v, i) => `line ${i + 1} ${'x'.repeat(150)}`).join('\n');
    const lines = cardText(output).split('\n');
    expect(lines).toHaveLength(20);
    expect(lines[0]?.startsWith('line 11 ')).toBe(true);
    expect(lines.every((line) => line.length <= 100)).toBe(true);
  });
});

describe('filmArgs', () => {
  it('draws two cards of 3 seconds, 640 wide at 10 fps, looping, for text', () => {
    const args = filmArgs({ kind: 'text', red: '/t/red: card.txt', green: '/t/green.txt', out: '/o/preview.gif' });
    const graph = args[args.indexOf('-filter_complex') + 1] ?? '';
    expect(graph).toContain('s=640x360:r=10:d=3');
    expect(graph).toContain('Before the fix · red');
    expect(graph).toContain('After the fix · green');
    expect(graph).toContain("textfile='/t/red\\: card.txt'");
    expect(graph).toContain('concat=n=2');
    expect(args.slice(-3)).toEqual(['-loop', '0', '/o/preview.gif']);
  });

  it('reads two clips up to 4 seconds each, captioned, for clips', () => {
    const args = filmArgs({ kind: 'clips', before: '/o/before.webm', after: '/o/after.webm', out: '/o/preview.gif' });
    expect(args.filter((arg) => arg === '-t')).toHaveLength(2);
    expect(args).toContain('4');
    expect(args).toContain('/o/before.webm');
    const graph = args[args.indexOf('-filter_complex') + 1] ?? '';
    expect(graph).toContain('fps=10,scale=640:');
    expect(graph).toContain('Before the fix');
    expect(graph).toContain('After the fix');
    expect(args.slice(-3)).toEqual(['-loop', '0', '/o/preview.gif']);
  });
});

describe('notes and run.json', () => {
  it('finds the first failing and passing line, else the first line', () => {
    expect(failingLine('start\nAssertionError: 2 != 1\nmore')).toBe('AssertionError: 2 != 1');
    expect(failingLine('boom')).toBe('boom');
    expect(passingLine('start\n✓ saves once\n')).toBe('✓ saves once');
    expect(failingLine('')).toBe('');
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
