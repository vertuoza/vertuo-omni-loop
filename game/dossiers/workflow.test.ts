// Where the fallback runs (PRD 216): a root script, a step of the game workflow's ledger job after
// game:project, and a line among the game's outputs.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { z } from 'zod';
import { nth } from '../test/present.ts';

// The root package.json, as far as these tests read it: its scripts.
const Package = z.object({ scripts: z.record(z.string(), z.string()) });

type Step = { run?: string; env: Record<string, string>; 'continue-on-error'?: boolean };
type Job = { steps: Step[]; env: Record<string, string> };
type Workflow = { jobs: { ledger: Job; rankings: Job } };

const read = (path: string): string => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const wf = parse(read('.github/workflows/game.yml')) as Workflow;

describe('game:dossiers in the game workflow', () => {
  it('has a root script beside the other game scripts', () => {
    expect(Package.parse(JSON.parse(read('package.json'))).scripts['game:dossiers']).toBe('node --env-file-if-exists=apps/galaxy/.env.local game/cli/dossiers.ts');
  });

  it('runs in the ledger job after game:project, with the same GitHub token and service role, and never fails the job', () => {
    const steps = wf.jobs.ledger.steps;
    const project = steps.findIndex((s) => s.run === 'pnpm game:project');
    const dossiers = steps.findIndex((s) => s.run === 'pnpm game:dossiers');
    expect(project).toBeGreaterThanOrEqual(0);
    expect(dossiers).toBeGreaterThan(project);
    expect(nth(steps, dossiers, 'steps').env.GH_TOKEN).toBe(nth(steps, project, 'steps').env.GH_TOKEN);
    expect(nth(steps, dossiers, 'steps')['continue-on-error']).toBe(true);
    expect(wf.jobs.ledger.env.SUPABASE_SERVICE_ROLE_KEY).toBe('${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}');
    expect(wf.jobs.rankings.steps.map((s) => s.run ?? '')).not.toContain('pnpm game:dossiers');
  });

  it('is listed in the game README, among its commands and its outputs', () => {
    const readme = read('game/README.md');
    expect(readme).toContain('`pnpm game:dossiers --workspace <slug>`');
    const outputs = readme.slice(readme.indexOf('Its only outputs are'), readme.indexOf('Delete `game/`'));
    expect(outputs).toContain('`public.dossier_versions`');
  });
});
