// Where the sync runs (PRD 262): .github/workflows/releases.yml, after every push to main that ships a
// PRD and after every successful migration of production, one run at a time, on main's whole history,
// with the game's Supabase credentials and without the game. And the supabase workflow's check job
// proves the table's access rules.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import { sure } from '../arcade/sure';

// A workflow, read for what these tests check: its triggers, and each job's condition, settings and steps.
const Step = z.looseObject({ uses: z.string().optional(), run: z.string().optional(), name: z.string().optional(), with: z.record(z.string(), z.unknown()).optional() });
const Job = z.looseObject({
  if: z.string().default(''),
  concurrency: z.unknown().optional(),
  env: z.record(z.string(), z.unknown()).default({}),
  permissions: z.unknown().optional(),
  steps: z.array(Step).default([]),
});
const Workflow = z.looseObject({ name: z.string().optional(), on: z.record(z.string(), z.unknown()), jobs: z.record(z.string(), Job) });

const read = (path: string) => readFileSync(fileURLToPath(new URL(`../../../../${path}`, import.meta.url)), 'utf8');
const workflow = (path: string) => Workflow.parse(parse(read(path)));
const releases = workflow('.github/workflows/releases.yml');
const game = workflow('.github/workflows/game.yml');
const supabase = workflow('.github/workflows/supabase.yml');
const jobOf = (flow: z.infer<typeof Workflow>, name: string) => sure(flow.jobs[name], `the ${name} job`);

describe('the releases workflow', () => {
  const [name, job] = sure(Object.entries(releases.jobs)[0], 'the releases job');

  it('runs after a push to main that ships a PRD or changes it, after a successful supabase run on main, and by hand', () => {
    expect(releases.on.push).toEqual({ branches: ['main'], paths: ['.omni-loop/delivery/shipped/**', '.github/workflows/releases.yml'] });
    expect(releases.on.workflow_run).toEqual({ workflows: [supabase.name], types: ['completed'], branches: ['main'] });
    expect(releases.on).toHaveProperty('workflow_dispatch');
    expect(Object.keys(releases.on)).toEqual(['push', 'workflow_run', 'workflow_dispatch']);
    expect(job.if).toContain("github.event.workflow_run.conclusion == 'success'");
  });

  it('is one job, off while SUPABASE_PROJECT_ID is unset, as the supabase workflow\'s deploy is', () => {
    expect(Object.keys(releases.jobs)).toEqual([name]);
    expect(jobOf(supabase, 'deploy').if).toContain("vars.SUPABASE_PROJECT_ID != ''");
    expect(job.if).toContain("vars.SUPABASE_PROJECT_ID != ''");
  });

  it('runs one sync at a time, never cancelling one under way', () => {
    expect(job.concurrency).toEqual({ group: 'releases', 'cancel-in-progress': false });
  });

  it('reads main\'s whole history', () => {
    const checkout = job.steps.find((step) => step.uses?.startsWith('actions/checkout'));
    expect(checkout?.with).toEqual({ ref: 'main', 'fetch-depth': 0 });
  });

  it('writes Supabase with the game\'s credentials, and never the repository', () => {
    expect(job.env.SUPABASE_URL).toBe(jobOf(game, 'ledger').env.SUPABASE_URL);
    expect(job.env.SUPABASE_SERVICE_ROLE_KEY).toBe(jobOf(game, 'ledger').env.SUPABASE_SERVICE_ROLE_KEY);
    expect(job.permissions).toEqual({ contents: 'read' });
    const runs = job.steps.map((step) => step.run ?? '').join('\n');
    expect(runs).not.toMatch(/git (add|commit|push)/);
    expect(job.steps.at(-1)?.run).toBe('pnpm releases:sync');
  });

  it('shares nothing with the game: deleting game/ leaves it working', () => {
    const text = read('.github/workflows/releases.yml').replace(/^\s*#.*$/gm, '');
    expect(text).not.toMatch(/\bgame[:/]|GAME_/);
    expect(read('apps/galaxy/scripts/releases-sync.ts')).not.toMatch(/from '[^']*game\//);
  });
});

describe('the supabase workflow', () => {
  it('proves who may read and write the releases, beside the other checks', () => {
    const runs = jobOf(supabase, 'check').steps.map((step) => step.run ?? '');
    const at = (file: string) => runs.findIndex((run) => run.endsWith(`-v ON_ERROR_STOP=1 -f supabase/checks/${file}`));
    expect(at('releases.sql')).toBeGreaterThan(at('dossiers.sql'));
    expect(at('dossiers.sql')).toBeGreaterThan(0);
  });
});
