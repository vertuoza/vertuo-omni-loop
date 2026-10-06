import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// A guard (#1014): on HOME, every link to the game is a PRESS START. Controls answers a click on an
// element marked PRESS START by opening SELECT YOUR APP, so a link to /play without the mark would
// skip the picker, as CONTINUE YOUR GAME once did. This reads HOME's components and names each
// element that links to the game without carrying the mark.

/** The opening tags in `source` that link to the game: `href={PLAY}`, `href={PLAY_HREF}` or "/play". */
function unmarkedGameLinks(source: string): string[] {
  const tags = source.match(/<[a-zA-Z][^<>]*?href=(?:\{PLAY(?:_HREF)?\}|"\/play")[^<>]*>/g) ?? [];
  return tags.filter((tag) => !tag.includes('PRESS_START_ATTR'));
}

function homeComponents(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return homeComponents(path);
    return entry.name.endsWith('.tsx') ? [path] : [];
  });
}

describe('every link to the game on HOME', () => {
  it('finds a link to the game without the PRESS START mark', () => {
    expect(unmarkedGameLinks('<a className="home-signed-in" href={PLAY_HREF} aria-label="x">')).toHaveLength(1);
    expect(unmarkedGameLinks('<a href="/play">PLAY</a>')).toHaveLength(1);
  });

  it('lets a marked link, and a link elsewhere, through', () => {
    expect(unmarkedGameLinks("<a href={PLAY} {...{ [PRESS_START_ATTR]: '' }}>PRESS START</a>")).toEqual([]);
    expect(unmarkedGameLinks('<a href="/docs">GETTING STARTED</a>')).toEqual([]);
  });

  it('is a PRESS START, so a click opens SELECT YOUR APP', () => {
    const dir = new URL('.', import.meta.url).pathname;
    const unmarked = homeComponents(dir).flatMap((file) =>
      unmarkedGameLinks(readFileSync(file, 'utf8')).map((tag) => `${file.slice(dir.length)}: ${tag}`));
    expect(unmarked).toEqual([]);
  });
});
