// The release workflow's Vercel fallback (PRD 1646 s4): Vercel skips a merge commit on main and builds
// the release commit after it, so when the release does not land, the workflow's last step marks main
// and calls each project's Deploy Hook for main.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { dig, digText } from '../kit/bin/dig.ts';

const workflow: unknown = parse(readFileSync(join(fileURLToPath(new URL('..', import.meta.url)), '.github/workflows/release.yml'), 'utf8'));
const steps = dig(workflow, 'jobs', 'release', 'steps');
const last: unknown = Array.isArray(steps) ? steps.at(-1) : undefined;

describe('the release workflow\'s Vercel fallback', () => {
  it('is the last step, and runs only when the release failed or was cancelled', () => {
    expect(digText(last, 'if')).toBe('failure() || cancelled()');
  });

  it('marks main\'s head vercel/production-fallback, then calls both Deploy Hooks', () => {
    const run = digText(last, 'run');
    expect(run).toContain('git/ref/heads/main');
    expect(run).toContain('context=vercel/production-fallback');
    expect(digText(last, 'env', 'HOOK_GALAXY')).toBe('${{ secrets.VERCEL_DEPLOY_HOOK_GALAXY_MAIN }}');
    expect(digText(last, 'env', 'HOOK_OMNI_APP')).toBe('${{ secrets.VERCEL_DEPLOY_HOOK_OMNI_APP_MAIN }}');
    expect(run).toContain('curl -sf -X POST "$hook"');
  });

  it('may write commit statuses', () => {
    expect(digText(workflow, 'jobs', 'release', 'permissions', 'statuses')).toBe('write');
  });
});
