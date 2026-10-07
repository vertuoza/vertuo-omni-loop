// What wakes the sync (PRD 587, s2): Vercel Cron, every 15 minutes, calling GET /api/stages/sync with
// CRON_SECRET as its bearer. It ran on a GitHub Actions runner before, which billed at least a minute
// for one HTTP call, 96 times a day. And the galaxy env example names both of PRD 587's secrets.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const read = (path: string) => readFileSync(fileURLToPath(new URL(`../../../../../${path}`, import.meta.url)), 'utf8');

const VercelJson = z.looseObject({ crons: z.array(z.object({ path: z.string(), schedule: z.string() })) });

describe('the stages cron', () => {
  it('calls /api/stages/sync every 15 minutes, from galaxy\'s own Vercel project', () => {
    const { crons } = VercelJson.parse(JSON.parse(read('apps/galaxy/vercel.json')));
    expect(crons).toContainEqual({ path: '/api/stages/sync', schedule: '*/15 * * * *' });
  });

  it('is answered on GET, the method Vercel Cron sends, and on POST, for a call by hand', () => {
    const route = read('apps/galaxy/app/api/stages/sync/route.ts');
    expect(route).toMatch(/^export function GET\(request: Request\)/m);
    expect(route).toMatch(/^export const POST = GET;$/m);
  });

  it('runs on no GitHub Actions runner any more', () => {
    expect(() => read('.github/workflows/stages.yml')).toThrow();
  });
});

describe('the galaxy env example', () => {
  it('lists STAGES_SYNC_SECRET and STAGE_EVENT_SECRET', () => {
    const example = read('apps/galaxy/.env.example');
    expect(example).toMatch(/^STAGES_SYNC_SECRET=$/m);
    expect(example).toMatch(/^STAGE_EVENT_SECRET=$/m);
  });
});
