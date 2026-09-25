// The scheduled workflow is the game's only writer; these pin its production-readiness rulings (F8).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const wf = parse(readFileSync(new URL('../.github/workflows/game.yml', import.meta.url), 'utf8'));

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
    expect(wf.on.workflow_dispatch.inputs.post_rankings.type).toBe('boolean');
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

  it('keeps a weekly backup of the database for 90 days, before posting', () => {
    const steps = wf.jobs.rankings.steps;
    const exportAt = steps.findIndex((s) => (s.run ?? '').startsWith('pnpm game:export'));
    const upload = steps.findIndex((s) => s.uses?.startsWith('actions/upload-artifact'));
    const post = steps.findIndex((s) => s.name === 'Post the rankings');
    expect(exportAt).toBeGreaterThanOrEqual(0);
    expect(upload).toBe(exportAt + 1);
    expect(steps[upload].with['retention-days']).toBe(90);
    expect(post).toBeGreaterThan(upload);
  });
});
