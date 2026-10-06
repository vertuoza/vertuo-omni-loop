// The `release` workflow only calls the release script: it runs on push to main, one run at a time,
// with `contents: write` and nothing else.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { dig } from '../bin/dig.ts';

const workflow: unknown = parse(readFileSync(fileURLToPath(new URL('../../.github/workflows/release.yml', import.meta.url)), 'utf8'));
const job = dig(workflow, 'jobs', 'release');

/** The keys of a mapping the YAML holds, in order; none for anything else. */
const keys = (value: unknown): string[] => (typeof value === 'object' && value !== null ? Object.keys(value) : []);
/** The job's steps, each as the YAML reads it. */
const steps = (): unknown[] => {
  const list = dig(job, 'steps');
  return Array.isArray(list) ? list : [];
};

describe('the release workflow', () => {
  it('runs on every push to main', () => {
    expect(dig(workflow, 'on')).toEqual({ push: { branches: ['main'] } });
  });

  it('is its only job, one run at a time, never cancelling a queued run', () => {
    expect(keys(dig(workflow, 'jobs'))).toEqual(['release']);
    expect(dig(job, 'concurrency')).toEqual({ group: 'release', 'cancel-in-progress': false });
  });

  it('asks for contents: write and nothing else', () => {
    expect(dig(workflow, 'permissions')).toEqual({ contents: 'write' });
    expect(dig(job, 'permissions')).toEqual({ contents: 'write' });
  });

  it('skips a push whose head is a release commit', () => {
    expect(dig(job, 'if')).toContain("startsWith(github.event.head_commit.message, 'chore(release): ')");
  });

  it('checks out main with its whole history and tags, installs, and only calls the script', () => {
    const checkout = steps().find((step) => String(dig(step, 'uses')).startsWith('actions/checkout@'));
    expect(dig(checkout, 'with')).toMatchObject({ ref: 'main', 'fetch-depth': 0, 'fetch-tags': true });
    const runs = steps().map((step) => dig(step, 'run')).filter(Boolean);
    expect(runs).toEqual(['pnpm install --frozen-lockfile', 'node kit/release/release.ts']);
  });
});
