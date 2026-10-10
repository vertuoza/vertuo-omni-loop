// The list of lowest-wins games lives twice (PRD 1440): in submit_score()'s migration and as
// `measure: 'time'` in the registry. This fails when the two differ, or when the migration does not
// reset the kart's point scores.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAMES, type Game } from './games/index.ts';

const MIGRATION = new URL('../../../../supabase/migrations/20261201090000_arcade_kart_times.sql', import.meta.url);

/** The games the function's `lowest_wins` list names. */
function sqlLowestWins(sql: string): string[] {
  const m = /lowest_wins\s+constant\s+text\[\]\s*:=\s*array\[([^\]]*)\]/.exec(sql);
  if (!m) throw new Error('the migration declares no lowest_wins list');
  return [...(m[1] ?? '').matchAll(/'([a-z0-9-]+)'/g)].map((g) => g[1] ?? '');
}

/** What differs between the registry's `time` games and the SQL list. */
function drift(games: readonly Pick<Game, 'id' | 'measure'>[], sql: string): string[] {
  const inSql = new Set(sqlLowestWins(sql));
  const time = new Set(games.filter((g) => g.measure === 'time').map((g) => g.id));
  return [
    ...[...time].filter((id) => !inSql.has(id)).map((id) => `${id} is a time game missing from the SQL list`),
    ...[...inSql].filter((id) => !time.has(id)).map((id) => `${id} is in the SQL list but not a time game`),
  ];
}

describe('the two lists of lowest-wins games', () => {
  const sql = readFileSync(MIGRATION, 'utf8');

  it('are the same set', () => {
    expect(sqlLowestWins(sql)).toEqual(['kart']);
    expect(drift(GAMES, sql)).toEqual([]);
  });

  it('fail when a time game is missing from the SQL list, or the SQL names one the registry does not', () => {
    expect(drift(GAMES, sql.replace("array['kart']", 'array[]::text[]'))).toEqual(['kart is a time game missing from the SQL list']);
    expect(drift(GAMES, sql.replace("array['kart']", "array['kart', 'invaders']"))).toEqual(['invaders is in the SQL list but not a time game']);
    expect(drift([...GAMES, { id: 'lap', measure: 'time' }], sql)).toEqual(['lap is a time game missing from the SQL list']);
  });

  it('deletes the kart rows, so no point score is read as a time', () => {
    expect(sql).toMatch(/delete from public\.arcade_scores where game = 'kart';/);
  });
});
