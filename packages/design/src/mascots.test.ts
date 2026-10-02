import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { MASCOTS, SPRITE_DEFS } from './sprites.ts';
import { spritePixels } from './draw.ts';
import { assertDefined } from '../../../kit/test/assert.ts';

// The mascot library (PRD 517): the keys an owner may pick for a fleet, in the order the picker shows
// them. The database holds the same list in public.fleet_mascots(), and these tests keep the two in step.

const LIBRARY = ['beaver', 'octopod', 'picsou', 'cia', 'pirate', 'invincible', 'atom-eve', 'shark', 'turtle', 'allen', 'robot'];

const MIGRATIONS = new URL('../../../supabase/migrations/', import.meta.url);
const DEFINES = /create\s+(?:or\s+replace\s+)?function\s+public\.fleet_mascots\s*\(\s*\)/i;

// The keys a migration's fleet_mascots() returns, in its order: the quoted strings of the first
// array[…] after the function's definition. Null when the text defines no fleet_mascots().
function mascotKeys(sql: string): string[] | null {
  const at = sql.search(DEFINES);
  if (at < 0) return null;
  const list = /array\s*\[([^\]]*)\]/i.exec(sql.slice(at));
  if (!list) return [];
  const body = list[1];
  assertDefined(body, 'the array fleet_mascots() returns');
  return [...body.matchAll(/'([^']*)'/g)].map((m) => {
    const key = m[1];
    assertDefined(key, 'a mascot key');
    return key;
  });
}

// What differs between a fleet_mascots() definition and the library: [] when they agree, key for key.
function drift(sql: string, library: readonly string[] = MASCOTS): string[] {
  const keys = mascotKeys(sql) ?? [];
  return [
    ...library.filter((k) => !keys.includes(k)).map((k) => `missing ${k}`),
    ...keys.filter((k) => !library.includes(k)).map((k) => `extra ${k}`),
    ...(keys.length === library.length && keys.some((k, i) => k !== library[i]) ? ['another order'] : []),
  ];
}

// The newest migration defining fleet_mascots(): the one the database runs last.
function newestDefinition() {
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
  const defining = files.filter((f) => DEFINES.test(readFileSync(new URL(f, MIGRATIONS), 'utf8')));
  const file = defining.at(-1);
  assertDefined(file, 'a migration that defines fleet_mascots()');
  return { file, sql: readFileSync(new URL(file, MIGRATIONS), 'utf8') };
}

describe('the mascot library', () => {
  it('holds the eleven mascots, in the order the picker shows them', () => {
    expect([...MASCOTS]).toEqual(LIBRARY);
    expect(new Set(MASCOTS).size).toBe(MASCOTS.length);
  });

  it('draws each as a 32×32 sprite with two frames that differ', () => {
    for (const key of MASCOTS) {
      const def = SPRITE_DEFS[key];
      expect(def, key).toBeDefined();
      expect([def?.w, def?.h], key).toEqual([32, 32]);
      const [a, b] = [0, 1].map((frame) => spritePixels(key, { frame }).pixels.join());
      expect(a === b, `${key}: both frames are the same`).toBe(false);
    }
  });

  it('holds no commander, hero, enemy or icon', () => {
    const cast = Object.keys(SPRITE_DEFS).filter((k) => k === 'omni' || k.startsWith('omni-') || k.startsWith('hero-') || k === 'entropy');
    const icons = Object.entries(SPRITE_DEFS).filter(([, def]) => def.w < 32).map(([k]) => k);
    expect(cast.length).toBeGreaterThan(0);
    expect(icons).toContain('coin');
    for (const key of [...cast, ...icons]) expect(MASCOTS, key).not.toContain(key);
  });
});

describe('the library and the database', () => {
  it('list the same keys, in the same order, in the newest migration defining fleet_mascots()', () => {
    const { file, sql } = newestDefinition();
    expect(mascotKeys(sql), file).toEqual([...MASCOTS]);
    expect(drift(sql), file).toEqual([]);
  });

  it('tell a definition missing one key, one extra or one out of order apart from the library', () => {
    const define = (keys: readonly string[]): string => `create or replace function public.fleet_mascots() returns text[]
language sql immutable
set search_path = ''
as $$
  select array[${keys.map((k) => `'${k}'`).join(', ')}]
$$;`;
    expect(drift(define(LIBRARY), LIBRARY)).toEqual([]);
    expect(drift(define(LIBRARY.filter((k) => k !== 'turtle')), LIBRARY)).toEqual(['missing turtle']);
    expect(drift(define([...LIBRARY, 'dragon']), LIBRARY)).toEqual(['extra dragon']);
    expect(drift(define([...LIBRARY.slice(1), ...LIBRARY.slice(0, 1)]), LIBRARY)).toEqual(['another order']);
    expect(drift('select 1;', LIBRARY)).toHaveLength(LIBRARY.length);
  });
});
