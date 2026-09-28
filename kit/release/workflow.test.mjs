// The `release` workflow only calls the release script: it runs on push to main, one run at a time,
// with `contents: write` and nothing else.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const workflow = parse(readFileSync(fileURLToPath(new URL('../../.github/workflows/release.yml', import.meta.url)), 'utf8'));
const job = workflow.jobs.release;

describe('the release workflow', () => {
  it('runs on every push to main', () => {
    expect(workflow.on).toEqual({ push: { branches: ['main'] } });
  });

  it('is its only job, one run at a time, never cancelling a queued run', () => {
    expect(Object.keys(workflow.jobs)).toEqual(['release']);
    expect(job.concurrency).toEqual({ group: 'release', 'cancel-in-progress': false });
  });

  it('asks for contents: write and nothing else', () => {
    expect(workflow.permissions).toEqual({ contents: 'write' });
    expect(job.permissions).toEqual({ contents: 'write' });
  });

  it('skips a push whose head is a release commit', () => {
    expect(job.if).toContain("startsWith(github.event.head_commit.message, 'chore(release): ')");
  });

  it('checks out main with its whole history and tags, installs, and only calls the script', () => {
    const checkout = job.steps.find((step) => String(step.uses).startsWith('actions/checkout@'));
    expect(checkout.with).toMatchObject({ ref: 'main', 'fetch-depth': 0, 'fetch-tags': true });
    const runs = job.steps.filter((step) => step.run).map((step) => step.run);
    expect(runs).toEqual(['pnpm install --frozen-lockfile', 'node kit/release/release.mjs']);
  });
});
