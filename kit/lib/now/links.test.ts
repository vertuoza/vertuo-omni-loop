// PRD 2906, slice s2: the pull request kept beside a work's links is written whole, read back however
// old, and a file that does not read is no copy.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readPullRequest, writePullRequest } from './links.ts';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
const folder = () => {
  const root = mkdtempSync(join(tmpdir(), 'omni-pr-links-'));
  roots.push(root);
  return root;
};

const PULL = { at: '2020-01-01T00:00:00.000Z', number: 4, url: 'https://github.com/acme/widgets/pull/4', state: 'open' as const, files: ['a.ts'], checks: [{ name: 'test', state: 'success' as const }] };

describe('the pull request kept beside the links', () => {
  it('reads back what was written, however old', () => {
    const root = folder();
    writePullRequest(root, 'bug', 12, PULL);
    expect(readPullRequest(root, 'bug', 12)).toEqual(PULL);
    expect(readPullRequest(root, 'bug', 13)).toBeNull();
  });

  it('reads as none when the file does not read or has the wrong shape', () => {
    const root = folder();
    mkdirSync(join(root, '.omni-loop/local/now'), { recursive: true });
    writeFileSync(join(root, '.omni-loop/local/now/pr-prd-7.json'), 'not json');
    writeFileSync(join(root, '.omni-loop/local/now/pr-prd-8.json'), JSON.stringify({ at: 'x' }));
    expect(readPullRequest(root, 'prd', 7)).toBeNull();
    expect(readPullRequest(root, 'prd', 8)).toBeNull();
  });
});
