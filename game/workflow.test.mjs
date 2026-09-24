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
    expect(steps).toContain('pnpm game:score');
    expect(steps).toContain('gh issue comment "$RANKINGS_ISSUE" --body-file game/season/rankings.md');
  });

  it('creates the ledger and season directories before staging them', () => {
    const commit = wf.jobs.ledger.steps.find((s) => s.name === 'Commit the ledger and the season').run;
    expect(commit.indexOf('mkdir -p game/ledger game/season')).toBeGreaterThanOrEqual(0);
    expect(commit.indexOf('mkdir -p game/ledger game/season')).toBeLessThan(commit.indexOf('git add'));
  });
});
