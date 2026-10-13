// The hourly health workflow (PRD 1723 s4), read from .github/workflows/health.yml: minute 23 of every
// hour and by hand, read the repository and write issues only, run only once an app's URL variable is
// set, and use no secret. Nothing here runs the workflow.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { dig, digText } from '../kit/bin/dig.ts';

const text = readFileSync(fileURLToPath(new URL('../.github/workflows/health.yml', import.meta.url)), 'utf8');
const workflow: unknown = parse(text);
const job = dig(workflow, 'jobs', 'probe');
const steps = dig(job, 'steps');
const run = Array.isArray(steps) ? digText(steps.at(-1), 'run') : '';

describe('the health workflow', () => {
  it('runs at minute 23 of every hour, and by hand', () => {
    expect(dig(workflow, 'on', 'schedule')).toEqual([{ cron: '23 * * * *' }]);
    expect(dig(workflow, 'on')).toHaveProperty('workflow_dispatch');
  });

  it('may read the repository and write issues, and nothing else', () => {
    expect(dig(workflow, 'permissions')).toEqual({ contents: 'read', issues: 'write' });
    expect(dig(job, 'permissions')).toBeUndefined();
  });

  it('runs only when GALAXY_URL or OMNI_APP_URL is set', () => {
    expect(digText(job, 'if')).toBe("vars.GALAXY_URL != '' || vars.OMNI_APP_URL != ''");
  });

  it('runs the health-check script, passing each app whose variable is set', () => {
    expect(run).toContain('node scripts/health-check.ts');
    expect(run).toContain('galaxy=$GALAXY_URL');
    expect(run).toContain('omni-app=$OMNI_APP_URL');
    expect(digText(job, 'steps', (Array.isArray(steps) ? steps.length : 1) - 1, 'env', 'GH_TOKEN')).toBe('${{ github.token }}');
  });

  it('uses no secret', () => {
    expect(text).not.toMatch(/secrets\./);
  });
});
