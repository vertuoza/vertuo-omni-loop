// Production's safety net (PRD 1646 s4): Vercel skips a merge commit on main and builds the release
// commit after it, so when a `release` run fails or is cancelled, the release-fallback workflow marks
// main and calls each project's Deploy Hook for main. The release workflow itself is untouched.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { dig, digText } from '../kit/bin/dig.ts';

const read = (name: string): unknown => parse(readFileSync(join(fileURLToPath(new URL('..', import.meta.url)), '.github/workflows', name), 'utf8'));
const workflow = read('release-fallback.yml');
const job = dig(workflow, 'jobs', 'deploy-main');
const steps = dig(job, 'steps');
const run = Array.isArray(steps) ? digText(steps.at(-1), 'run') : '';

describe('the release-fallback workflow', () => {
  it('follows every completed release run, and acts only on a failed or cancelled one', () => {
    expect(dig(workflow, 'on', 'workflow_run', 'workflows')).toEqual(['release']);
    expect(dig(workflow, 'on', 'workflow_run', 'types')).toEqual(['completed']);
    expect(digText(job, 'if')).toBe("github.event.workflow_run.conclusion == 'failure' || github.event.workflow_run.conclusion == 'cancelled'");
  });

  it('marks main\'s head vercel/production-fallback, then calls both Deploy Hooks', () => {
    expect(run).toContain('git/ref/heads/main');
    expect(run).toContain('context=vercel/production-fallback');
    expect(run.indexOf('statuses')).toBeLessThan(run.indexOf('curl'));
    expect(digText(job, 'env', 'HOOK_GALAXY')).toBe('${{ secrets.VERCEL_DEPLOY_HOOK_GALAXY_MAIN }}');
    expect(digText(job, 'env', 'HOOK_OMNI_APP')).toBe('${{ secrets.VERCEL_DEPLOY_HOOK_OMNI_APP_MAIN }}');
  });

  it('may write commit statuses and nothing else', () => {
    expect(dig(workflow, 'permissions')).toEqual({ statuses: 'write' });
  });

  it('leaves the release workflow without it', () => {
    expect(JSON.stringify(read('release.yml'))).not.toContain('vercel');
  });
});
