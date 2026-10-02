// The scheduled workflow is the game's only writer; these pin its production-readiness rulings (F8).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { backupFiles } from './cli/export.ts';
import { supabaseRest } from './sources/supabase.ts';
import { fakeSupabase } from './test/fake-supabase.ts';

type Step = { run?: string; uses?: string; name?: string; env?: Record<string, string>; with?: Record<string, unknown>; 'continue-on-error'?: boolean };
type Job = { if?: string; needs?: unknown; concurrency: { group: string }; 'timeout-minutes'?: number; permissions: Record<string, string>; env: Record<string, string>; steps: Step[] };
type Workflow = { on: { workflow_dispatch: { inputs: Record<string, { type: string }> } }; env?: Record<string, string>; jobs: Record<string, Job> & { ledger: Job; rankings: Job; check: Job } };

const wf = parse(readFileSync(new URL('../.github/workflows/game.yml', import.meta.url), 'utf8')) as Workflow;

describe('game workflow', () => {
  it('splits into a ledger job and a rankings job, each gated, bounded and serialised', () => {
    expect(Object.keys(wf.jobs)).toEqual(['ledger', 'rankings']);
    for (const job of Object.values(wf.jobs)) {
      expect(job.if).toContain("vars.GAME_ENABLED == 'true'");
      expect(job['timeout-minutes']).toBe(20);
      expect(job.needs).toBeUndefined();
    }
    expect(wf.jobs.ledger.concurrency.group).toBe('game-ledger');
    expect(wf.jobs.rankings.concurrency.group).toBe('game-rankings');
  });

  it('posts rankings only on the Monday schedule or a dispatch that asks for it', () => {
    expect(wf.on.workflow_dispatch.inputs.post_rankings!.type).toBe('boolean');
    expect(wf.jobs.rankings.if).toContain("github.event.schedule == '0 7 * * 1'");
    expect(wf.jobs.rankings.if).toContain('inputs.post_rankings');
    expect(wf.jobs.ledger.if).not.toContain('schedule');
    const steps = wf.jobs.rankings.steps.map((s) => s.run ?? '').join('\n');
    expect(steps).toContain('pnpm game:score --rankings "$RUNNER_TEMP/rankings.md"');
    expect(steps).toContain('gh issue comment "$RANKINGS_ISSUE" --body-file "$RUNNER_TEMP/rankings.md"');
  });

  it('writes the ledger to Supabase and never to the repository', () => {
    for (const job of Object.values(wf.jobs)) {
      expect(job.permissions.contents).toBe('read');
      expect(job.env.SUPABASE_SERVICE_ROLE_KEY).toBe('${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}');
      const runs = job.steps.map((s) => s.run ?? '').join('\n');
      expect(runs).not.toMatch(/git (add|commit|push)/);
    }
    expect(wf.jobs.ledger.steps.map((s) => s.run)).toContain('pnpm game:project');
  });

  it('names the vertuoza workspace for every job: the game scripts have no default', () => {
    for (const job of Object.values(wf.jobs)) {
      expect({ ...wf.env, ...job.env }.OMNI_LOOP_WORKSPACE).toBe('vertuoza');
      const runs = job.steps.map((s) => s.run ?? '').join('\n');
      expect(runs).not.toContain('--workspace'); // one place names it: the variable
    }
  });

  it('keeps a weekly backup of the database for 90 days, before posting', () => {
    const steps = wf.jobs.rankings.steps;
    const exportAt = steps.findIndex((s) => (s.run ?? '').startsWith('pnpm game:export'));
    const upload = steps.findIndex((s) => s.uses?.startsWith('actions/upload-artifact'));
    const post = steps.findIndex((s) => s.name === 'Post the rankings');
    expect(exportAt).toBeGreaterThanOrEqual(0);
    expect(upload).toBe(exportAt + 1);
    expect(steps[upload]!.with!['retention-days']).toBe(90);
    expect(post).toBeGreaterThan(upload);
  });
});

describe('game workflow: XP (PRD 160)', () => {
  it('recomputes XP as the ledger job\'s step right after pnpm game:project', () => {
    const runs = wf.jobs.ledger.steps.map((s) => s.run ?? null);
    const project = runs.indexOf('pnpm game:project');
    expect(project).toBeGreaterThanOrEqual(0);
    expect(runs[project + 1]).toBe('pnpm game:xp');
    expect(wf.jobs.rankings.steps.map((s) => s.run ?? '')).not.toContain('pnpm game:xp');
  });

  it('has a root script for it, beside the other game scripts', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(pkg.scripts['game:xp']).toBe('node --env-file-if-exists=apps/galaxy/.env.local game/cli/xp.ts');
  });
});

describe('game workflow: contributions (PRD 328)', () => {
  const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

  it('records contributions as the ledger job\'s step right after pnpm game:xp, with the game token, and never fails the job', () => {
    const steps = wf.jobs.ledger.steps;
    const xp = steps.findIndex((s) => s.run === 'pnpm game:xp');
    const project = steps.findIndex((s) => s.run === 'pnpm game:project');
    expect(xp).toBeGreaterThanOrEqual(0);
    const step = steps[xp + 1];
    expect(step!.run).toBe('pnpm game:contributions');
    expect(step!['continue-on-error']).toBe(true);
    expect(step!.env!.GH_TOKEN).toBe('${{ secrets.OMNI_GAME_TOKEN }}');
    expect(step!.env!.GH_TOKEN).toBe(steps[project]!.env!.GH_TOKEN);
    expect(wf.jobs.rankings.steps.map((s) => s.run ?? '')).not.toContain('pnpm game:contributions');
  });

  it('has a root script for it, beside the other game scripts', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.scripts['game:contributions']).toBe('node --env-file-if-exists=apps/galaxy/.env.local game/cli/contributions.ts');
  });

  it('is in the game README: the command, its window and its table, among the outputs, and never the ledger', () => {
    const readme = read('game/README.md');
    expect(readme).toContain('`pnpm game:contributions --workspace <slug>`');
    const outputs = readme.slice(readme.indexOf('Its only outputs are'), readme.indexOf('Delete `game/`'));
    expect(outputs).toContain('`public.contributions`');
    const section = readme.slice(readme.indexOf('## Contributions'), readme.indexOf('## Setup'));
    expect(section).toContain('40 days');
    expect(section).toContain('never writes the ledger');
    expect(readme).toMatch(/`game:project`,\s+then `game:xp`,\s+then `game:contributions`,\s+then `game:dossiers`/);
  });

  it('has its access proved by the supabase workflow, beside the other checks', () => {
    const supabase = parse(read('.github/workflows/supabase.yml')) as Workflow;
    const runs = supabase.jobs.check.steps.map((s) => s.run ?? '');
    const at = (file: string) => runs.findIndex((r) => r.endsWith(`-v ON_ERROR_STOP=1 -f supabase/checks/${file}`));
    expect(at('contributions.sql')).toBeGreaterThan(at('access.sql'));
    expect(at('access.sql')).toBeGreaterThan(0);
  });
});

describe('game workflow: the scores backup (PRD 160)', () => {
  const VERTUOZA = 'a0000000-0000-4000-8000-000000000001';
  const ACME = 'b0000000-0000-4000-8000-000000000002';
  const score = (workspace_id: string, user_id: string, best: number) => ({ workspace_id, user_id, game: 'invaders', best, at: '2026-09-26T18:00:00+00:00' });

  it('exports arcade_scores, which nothing can rebuild, and leaves player_xp out, which the ledger rebuilds', async () => {
    const fake = fakeSupabase({
      workspaces: [{ id: VERTUOZA, slug: 'vertuoza', name: 'Vertuoza', github_org: 'vertuoza', plan_repo: 'vertuo-omni-plan', theme: {}, created_at: 'c' }],
      arcade_scores: [score(VERTUOZA, 'u1', 1240), score(ACME, 'u9', 385)],
      player_xp: [{ workspace_id: VERTUOZA, github_login: 'alice', xp: 180, level: 3, unlocked: ['invaders'], computed_at: 'c' }],
    });
    const files = await backupFiles(supabaseRest({ url: 'https://x.supabase.co', key: 'k', fetch: fake.fetch }), VERTUOZA);
    expect(Object.keys(files)).toEqual(['workspace', 'ledger_events', 'sectors', 'teams', 'players', 'arcade_scores']);
    expect(files.arcade_scores).toEqual([score(VERTUOZA, 'u1', 1240)]);
    expect(fake.calls.some((c) => c.table === 'player_xp')).toBe(false);
  });
});
