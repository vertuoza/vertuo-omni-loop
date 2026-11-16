// `omni dashboard [--fetch]` (PRD 2906, slice s3): the repository's overview, exactly what `omni status`
// prints with no PRD number. The fixture is a `makeRepo` seed cloned into a local bare repository, which
// a second clone takes as its `origin`, so no test reads the network.
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } };
}

const ME = 'me@example.com';
const CONFIG = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n' };
const DELIVERY = '.omni-loop/delivery';
const USAGE = 'usage: omni dashboard [--fetch]';

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/** A clone, run as `ME`, of a bare copy of a seed repository holding a shipped PRD and an inbox PRD. */
function clone(): string {
  const seed = makeRepo({
    git: true,
    files: {
      ...CONFIG,
      [`${DELIVERY}/shipped/0001-first/spec.md`]: '# first\n',
      [`${DELIVERY}/inbox/0002-second/spec.md`]: '# second\n',
    },
  });
  const bare = join(mkdtempSync(join(tmpdir(), 'omni-dash-bare-')), 'origin.git');
  git(seed.root, 'clone', '-q', '--bare', seed.root, bare);
  const root = join(mkdtempSync(join(tmpdir(), 'omni-dash-clone-')), 'work');
  git(seed.root, 'clone', '-q', bare, root);
  git(root, 'config', 'user.email', ME);
  return root;
}

describe('omni dashboard', () => {
  it('prints exactly what omni status prints with no PRD number', async () => {
    const root = clone();
    const status = io();
    const dashboard = io();
    expect(await main(['status'], { cwd: root, ...status })).toBe(0);
    expect(await main(['dashboard'], { cwd: root, ...dashboard })).toBe(0);
    expect(dashboard.out.join('')).toBe(status.out.join(''));
    expect(dashboard.out.join('')).not.toBe('');
  });

  it('prints exactly what omni status --fetch prints with --fetch', async () => {
    const root = clone();
    const status = io();
    const dashboard = io();
    expect(await main(['status', '--fetch'], { cwd: root, ...status })).toBe(0);
    expect(await main(['dashboard', '--fetch'], { cwd: root, ...dashboard })).toBe(0);
    expect(dashboard.out.join('')).toBe(status.out.join(''));
  });

  it('refuses a PRD number, which belongs to the outbox gate of omni status', async () => {
    const root = clone();
    const s = io();
    expect(await main(['dashboard', '2'], { cwd: root, ...s })).toBe(2);
    expect(s.err.join('')).toBe(`${USAGE}\n`);
  });

  it('refuses a flag other than --fetch', async () => {
    const root = clone();
    const s = io();
    expect(await main(['dashboard', '--changes'], { cwd: root, ...s })).toBe(2);
    expect(s.err.join('')).toBe('omni dashboard: unknown flag --changes.\n');
  });
});
