// pnpm game:score, as a process, against the fake PostgREST behind a local server. Nothing here
// reaches Supabase.
import { describe, it, expect, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveFake } from '../test/fake-supabase.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const VERTUOZA = 'a0000000-0000-4000-8000-000000000001';
const workspaces = [{ id: VERTUOZA, slug: 'vertuoza', name: 'Vertuoza', github_org: 'vertuoza', plan_repo: 'vertuo-omni-plan', theme: {}, created_at: '2026-09-26T12:00:00+00:00' }];
const row = (id, at, type, over = {}) => ({ workspace_id: VERTUOZA, id, at, type, planet: 88, home: 'acme/plan', region: null, contributor: null, team: null, data: {}, ...over });

describe('pnpm game:score, as a process', () => {
  let server;
  afterEach(async () => { await server?.close(); server = null; });

  it('counts no row without a home, for no hero and no fleet: the fresh start (PRD 728)', async () => {
    server = await serveFake({
      workspaces,
      ledger_events: [
        row('planet:88:charted', '2026-09-01T08:00:00+00:00', 'PLANET_CHARTED', { home: null, data: { ownerTeam: 'beaver' } }),
        row('zone:r:88:s1:secured', '2026-09-21T12:00:00+00:00', 'ZONE_SECURED', { home: null, contributor: 'pierre', team: 'octopod' }),
        row('planet:88:terraformed', '2026-09-22T12:00:00+00:00', 'PLANET_TERRAFORMED', { home: null, data: { ownerTeam: 'beaver', class: 1, crossSector: false } }),
        row('planet:acme/plan#88:charted', '2026-09-23T08:00:00+00:00', 'PLANET_CHARTED', { data: { ownerTeam: 'octopod' } }),
        row('zone:acme/plan:acme/plan#88:s1:secured', '2026-09-23T12:00:00+00:00', 'ZONE_SECURED', { contributor: 'paul', team: 'octopod' }),
      ],
    });
    const { stdout } = await promisify(execFile)(process.execPath, [join(here, 'score.mjs'), '2026-09', '--workspace', 'vertuoza'], {
      env: { PATH: process.env.PATH, SUPABASE_URL: server.url, SUPABASE_SERVICE_ROLE_KEY: 'k' },
    });
    expect(stdout).toMatch(/vertuoza season 2026-09: 1 heroes · 1 fleets · 1 credits/);
  });
});
