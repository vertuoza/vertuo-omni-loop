// Guard for bug #2805: the terminal waits for a knowledge write at least as long as the route may run.
// A route given more time, or a client given less, fails here before a slow save is reported as failed.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WRITE_TIMEOUT_MS } from './client.ts';

const ROUTE = readFileSync(new URL('../../../apps/galaxy/app/api/knowledge/changes/route.ts', import.meta.url), 'utf8');

describe('the knowledge write timeout (#2805)', () => {
  it('is at least the maxDuration of /api/knowledge/changes', () => {
    const seconds = /export const maxDuration = (\d+);/.exec(ROUTE)?.[1];
    expect(seconds).toBeDefined();
    expect(WRITE_TIMEOUT_MS).toBeGreaterThanOrEqual(Number(seconds) * 1000);
  });
});
