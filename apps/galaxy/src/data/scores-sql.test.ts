// The crew high scores' keys, read as text from the migrations that define them today: the players
// table (20260926120000_workspaces.sql) and the arcade_scores table (20260926180000_arcade_scores.sql).
// What a delete removes is the database's to do; this pins that both cascades are there.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migration = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../../../../supabase/migrations/${name}`, import.meta.url)), 'utf8').replace(/\s+/g, ' ');

/** The body of `create table public.<table> (…);` in a migration, on one line. */
function tableBody(sql: string, table: string): string {
  const match = sql.match(new RegExp(`create table public\\.${table} \\((.*?)\\);`));
  if (!match?.[1]) throw new Error(`no create table public.${table} in the migration`);
  return match[1];
}

describe('a departed member\'s scores', () => {
  // Law BR-PRODUCT-35 (.omni-loop/knowledge/product/rules.md, #1496).
  it('law BR-PRODUCT-35: leaving a workspace removes the player row and every arcade_scores row keyed to it', () => {
    const players = tableBody(migration('20260926120000_workspaces.sql'), 'players');
    const scores = tableBody(migration('20260926180000_arcade_scores.sql'), 'arcade_scores');
    expect(players).toContain(
      'foreign key (workspace_id, user_id) references public.workspace_members (workspace_id, user_id) on delete cascade',
    );
    expect(scores).toContain('primary key (workspace_id, user_id, game)');
    expect(scores).toContain(
      'foreign key (workspace_id, user_id) references public.players (workspace_id, user_id) on delete cascade',
    );
  });
});
