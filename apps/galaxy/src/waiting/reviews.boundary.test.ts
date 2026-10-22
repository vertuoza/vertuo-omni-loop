import { describe, expect, it } from 'vitest';
import { boundaries } from './reviews.boundary';
import { ReviewWaitRead } from './waiting.repository';

// The read the Reviews part makes (PRD 2377 s5), registered for `pnpm schemas:verify`.

describe('the Reviews part\'s boundary', () => {
  it('is registered for schemas:verify with the schema the repository parses with', () => {
    expect(boundaries.map((b) => [b.name, b.schema, b.shape])).toEqual([['waiting/reviews: waits', ReviewWaitRead, 'rows']]);
  });

  it('reads open review, merge and law waits only', () => {
    const calls: Array<[string, unknown[]]> = [];
    const chain: Record<string, unknown> = {};
    for (const name of ['select', 'is', 'in']) chain[name] = (...args: unknown[]) => { calls.push([name, args]); return chain; };
    const db = { from: (table: string) => { calls.push(['from', [table]]); return chain; } };
    for (const b of boundaries) void b.read(db as never);
    expect(calls).toEqual([
      ['from', ['waits']],
      ['select', ['id, repo, prd, pr, kind, turn, since']],
      ['is', ['ended_at', null]],
      ['in', ['kind', ['review', 'merge', 'law']]],
    ]);
  });
});
