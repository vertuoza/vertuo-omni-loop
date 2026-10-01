// @ts-nocheck
// The four game scripts, run as processes: Supabase is the fake PostgREST behind a local server and
// gh is a shell script on PATH, so nothing here reaches GitHub or Supabase.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chmodSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveFake } from '../test/fake-supabase.ts';

const here = dirname(fileURLToPath(import.meta.url));
const VERTUOZA = 'a0000000-0000-4000-8000-000000000001';
const ACME = 'b0000000-0000-4000-8000-000000000002';
const BARE = 'c0000000-0000-4000-8000-000000000003';

let server, tmp, tables;
beforeEach(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'omni-game-'));
  // gh logs each call and answers the PRD issue list; every other read is empty.
  writeFileSync(join(tmp, 'gh'), '#!/bin/sh\necho "$*" >> "$FAKE_GH_LOG"\nif [ "$1 $2" = "issue list" ]; then printf "%s" "$FAKE_GH_ISSUES"; fi\n');
  chmodSync(join(tmp, 'gh'), 0o755);
  writeFileSync(join(tmp, 'gh.log'), '');
  tables = {
    workspaces: [
      { id: VERTUOZA, slug: 'vertuoza', name: 'Vertuoza', github_org: 'vertuoza', plan_repo: 'vertuo-omni-plan', theme: {}, created_at: '2026-09-26T12:00:00+00:00' },
      { id: ACME, slug: 'acme', name: 'Acme', github_org: 'acme-gh', plan_repo: 'acme-plan', theme: {}, created_at: '2026-09-27T12:00:00+00:00' },
      { id: BARE, slug: 'bare', name: 'Bare', github_org: null, plan_repo: null, theme: {}, created_at: '2026-09-27T12:00:00+00:00' },
    ],
    sectors: [{ workspace_id: VERTUOZA, name: 'core', repos: ['vertuo-core'] }],
    teams: [{ workspace_id: VERTUOZA, name: 'beaver', home: 'core', label: 'BEAVER', color: '#d08a4a', motto: '', mascot: 'beaver', sort: 10, retired_at: null }],
    players: [{ workspace_id: VERTUOZA, user_id: 'u1', display_name: 'ALICE', team: 'beaver', team_since: null, hero: {}, github_id: 1, github_login: 'alice', created_at: 'c', updated_at: 'u' }],
    repositories: [{ workspace_id: ACME, full_name: 'acme-gh/acme-rockets', tracked: true }, { workspace_id: ACME, full_name: 'acme-gh/old-rockets', tracked: false }],
    ledger_events: [{ workspace_id: VERTUOZA, id: 'planet:12:charted', at: '2026-08-01T08:00:00+00:00', type: 'PLANET_CHARTED', planet: 12, region: null, contributor: null, team: null, data: {} }],
  };
  server = await serveFake(tables);
});
afterEach(async () => {
  await server.close();
  rmSync(tmp, { recursive: true, force: true });
});

async function game(script, args, env = {}) {
  try {
    const { stdout, stderr } = await promisify(execFile)(process.execPath, [join(here, `${script}.ts`), ...args], {
      cwd: tmp, // a relative path a script writes lands here, never in the repository
      env: {
        PATH: `${tmp}:${dirname(process.execPath)}:${process.env.PATH}`,
        SUPABASE_URL: server.url,
        SUPABASE_SERVICE_ROLE_KEY: 'k',
        FAKE_GH_LOG: join(tmp, 'gh.log'),
        FAKE_GH_ISSUES: JSON.stringify([{ number: 12, title: 'Rockets', assignees: [], createdAt: '2026-09-01T08:00:00Z', closedAt: null }]),
        ...env,
      },
    });
    return { code: 0, stdout, stderr };
  } catch (err) {
    return { code: err.code, stdout: err.stdout, stderr: err.stderr };
  }
}
const ghCalls = () => readFileSync(join(tmp, 'gh.log'), 'utf8').split('\n').filter(Boolean);
const EVERY = [['project', []], ['score', []], ['banner', ['12']], ['export', ['backup']]];

describe('the game scripts name their workspace', () => {
  it('each one stops, naming both ways to name a workspace, when neither is set', async () => {
    const runs = await Promise.all(EVERY.map(([script, args]) => game(script, args)));
    for (const run of runs) {
      expect(run.code).toBe(2);
      expect(run.stderr).toMatch(/no workspace named: pass --workspace <slug>, or set OMNI_LOOP_WORKSPACE/);
    }
    expect(server.calls).toEqual([]);
  });

  it('each one stops, naming the slug, when the workspace is unknown; --workspace beats the variable', async () => {
    const runs = await Promise.all(EVERY.map(([script, args]) => game(script, [...args, '--workspace', 'ghost'], { OMNI_LOOP_WORKSPACE: 'vertuoza' })));
    for (const run of runs) {
      expect(run.code).toBe(1);
      expect(run.stderr).toMatch(/no workspace "ghost"/);
    }
    expect(ghCalls()).toEqual([]);
  });

  it('each one stops on an argument it does not understand, rather than fall back to the variable\'s workspace', async () => {
    const runs = await Promise.all(EVERY.map(([script, args]) => game(script, [...args, '--worksapce', 'acme'], { OMNI_LOOP_WORKSPACE: 'vertuoza' })));
    for (const run of runs) {
      expect(run.code).toBe(2);
      expect(run.stderr).toMatch(/unexpected argument "--worksapce"/);
    }
    expect(server.calls).toEqual([]);
  });

  it('game:project reads the workspace\'s tracked repositories, and appends rows carrying its workspace and each PRD\'s home', async () => {
    const run = await game('project', ['--workspace', 'acme']);
    expect(run.code, run.stderr).toBe(0);
    expect(ghCalls()[0]).toMatch(/^issue list -R acme-gh\/acme-rockets /);
    expect(ghCalls().join('\n')).not.toMatch(/old-rockets|acme-plan/); // PRD 728: an untracked repository is not read
    const reads = server.calls.filter((c) => c.method === 'GET' && c.table !== 'workspaces');
    expect(reads.map((c) => c.table).sort()).toEqual(['players', 'repositories', 'sectors', 'teams']);
    for (const c of reads) expect(c.url.searchParams.get('workspace_id')).toBe(`eq.${ACME}`);
    const append = server.calls.find((c) => c.method === 'POST');
    expect(append.table).toBe('ledger_events');
    expect(append.url.searchParams.get('on_conflict')).toBe('workspace_id,id');
    expect(append.body.map((r) => r.workspace_id)).toEqual(append.body.map(() => ACME));
    // Acme's PRD 12 is named by its home; Vertuoza's old planet:12:charted stays as it was.
    expect(tables.ledger_events.filter((r) => r.workspace_id === ACME).map((r) => [r.id, r.home])).toEqual([['planet:acme-gh/acme-rockets#12:charted', 'acme-gh/acme-rockets']]);
  });

  it('game:project and game:banner refuse a workspace that names no GitHub organisation', async () => {
    for (const [script, args] of [['project', []], ['banner', ['12']]]) {
      const run = await game(script, [...args, '--workspace', 'bare']);
      expect(run.code).toBe(1);
      expect(run.stderr).toMatch(/workspace "bare" has no github_org/);
    }
    expect(ghCalls()).toEqual([]);
    expect(server.calls.filter((c) => c.table !== 'workspaces')).toEqual([]);
  });

  it('game:score folds only the named workspace\'s ledger', async () => {
    const run = await game('score', ['2026-08'], { OMNI_LOOP_WORKSPACE: 'acme' });
    expect(run.code, run.stderr).toBe(0);
    const read = server.calls.find((c) => c.table === 'ledger_events');
    expect(read.url.searchParams.get('workspace_id')).toBe(`eq.${ACME}`);
  });

  it('game:export writes one workspace: workspace.jsonl and its five tables, nothing of another', async () => {
    tables.ledger_events.push({ ...tables.ledger_events[0], workspace_id: ACME });
    tables.sectors.push({ workspace_id: ACME, name: 'rockets', repos: [] });
    tables.arcade_scores = [VERTUOZA, ACME].map((workspace_id) => ({ workspace_id, user_id: 'u1', game: 'invaders', best: 1240, at: 'a' }));
    const dir = join(tmp, 'backup');
    const run = await game('export', [dir, '--workspace', 'vertuoza']);
    expect(run.code, run.stderr).toBe(0);
    expect(readdirSync(dir).sort()).toEqual(['arcade_scores.jsonl', 'ledger_events.jsonl', 'players.jsonl', 'sectors.jsonl', 'teams.jsonl', 'workspace.jsonl']);
    const read = (file) => readFileSync(join(dir, file), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    expect(read('workspace.jsonl')).toEqual([tables.workspaces[0]]);
    for (const table of ['ledger_events', 'sectors', 'teams', 'players', 'arcade_scores']) {
      expect(read(`${table}.jsonl`).map((r) => r.workspace_id)).toEqual([VERTUOZA]);
    }
    expect(readdirSync(dir).map((f) => readFileSync(join(dir, f), 'utf8')).join('')).not.toContain(ACME);
  });
});
