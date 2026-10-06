// `omni adopt <item-text-file>` — adopts a medium item straight to the ledger, then removes the
// open item file it adopted (PRD 7, slice s12: the bug found in wave 1 left the file behind, so
// `omni status` kept counting it as open).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } };
}

const CONFIG = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n' };

const MEDIUM_ITEM = [
  '---', 'id: s7-01-default-timeout', 'prd: 42', 'slice: s7', 'rank: medium', 'bears-on: none', 'raised: 2026-09-22', 'wave: 4', '---', '',
  '## The question, in plain words', '', 'How long should we wait before giving up on a slow call?', '',
  '## The decision, in plain words', '', 'We wait five seconds, which is generous without being unbounded.', '',
  '## The options, in plain words', '', 'A. Wait five seconds, the option built.', 'B. Wait one second, so a stuck call is caught sooner.', '',
  '## What I had to decide', '', 'How long a slow call gets before it is treated as stuck.', '',
  '## What I did meanwhile', '', 'Five seconds, a constant with no migration to undo it.', '',
  '## What it costs to change later', '', 'One constant.', '',
  '## What I could not know', '', '(author) Whether five seconds is measured against a real incident.', '',
].join('\n');

describe('omni adopt', () => {
  it('removes the open item file it adopted, and appends the settled entry', async () => {
    const { root, read } = makeRepo({
      git: true,
      files: {
        ...CONFIG,
        '.omni-loop/delivery/inbox/0042-a/spec.md': 'x',
        '.omni-loop/delivery/outbox/0042-a/s7-01-default-timeout.md': MEDIUM_ITEM,
      },
    });
    const itemFile = '.omni-loop/delivery/outbox/0042-a/s7-01-default-timeout.md';

    // Open before adopting.
    expect(await main(['status', '42'], { cwd: root, ...io() })).toBe(1);

    const s = io();
    const code = await main(['adopt', itemFile], { cwd: root, ...s });
    expect(code).toBe(0);
    expect(s.err.join('')).toBe('');
    expect(s.out.join('')).toMatch(/adopted/);
    expect(s.out.join('')).not.toMatch(/No open item file was read or written/);

    expect(existsSync(join(root, itemFile))).toBe(false);
    const settled = read('.omni-loop/delivery/outbox/0042-a/settled.md');
    expect(settled).toMatch(/s7-01-default-timeout — adopted/);
    expect(settled).toMatch(/Verdict: adopted/);

    // Green after adopting: nothing open any more.
    expect(await main(['status', '42'], { cwd: root, ...io() })).toBe(0);
  });

  it('refuses a file that is not under the item PRD outbox dir, exit 2, nothing changes', async () => {
    const { root } = makeRepo({
      git: true,
      files: {
        ...CONFIG,
        '.omni-loop/delivery/inbox/0042-a/spec.md': 'x',
        'stray.md': MEDIUM_ITEM,
      },
    });
    const s = io();
    const code = await main(['adopt', 'stray.md'], { cwd: root, ...s });
    expect(code).toBe(2);
    expect(s.err.join('')).toMatch(/^[^\n]+\n$/);

    expect(existsSync(join(root, 'stray.md'))).toBe(true);
    expect(existsSync(join(root, '.omni-loop/delivery/outbox/0042-a/settled.md'))).toBe(false);
  });
});
