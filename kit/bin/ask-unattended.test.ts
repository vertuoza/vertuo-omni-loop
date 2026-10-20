// `omni ask question` and `omni ask wait` under `OMNI_UNATTENDED` (PRD 2175): exit 3 with `unattended`,
// no round opened, nothing waited for. The server is the fake contract server and must see no call.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { startFakeAskServer } from '../test/fake-ask-server.ts';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';
import type { FakeAskServer } from '../test/fake-ask-server.ts';

const QUESTION = {
  question: 'Which theme should the page open in?',
  header: 'Theme',
  multiSelect: false,
  options: [{ label: 'System', description: 'follow the computer' }, { label: 'Dark', description: 'always dark' }],
};

const started: FakeAskServer[] = [];
afterEach(async () => {
  for (const running of started.splice(0)) await running.close();
});

/** Runs `omni ask <verb…>` in a checkout whose ask mode is on, with `env` added. */
async function run(args: string[], env: Record<string, string>) {
  const server = await startFakeAskServer();
  started.push(server);
  const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${server.url}\n` } });
  const file = join(mkdtempSync(join(tmpdir(), 'omni-unattended-')), 'q.json');
  writeFileSync(file, JSON.stringify({ questions: [QUESTION] }));
  const out: string[] = [];
  const err: string[] = [];
  const tokens = { read: () => ({ access_token: 'a', refresh_token: 'r', email: 'ada@example.com' }), write: () => undefined };
  const code = await main(['ask', ...args.map((a) => (a === '<file>' ? file : a))], {
    cwd: root,
    stdout: { write: (s: string) => out.push(s) },
    stderr: { write: (s: string) => err.push(s) },
    env: { OMNI_ASK: 'on', ...env },
    tokens,
  });
  return { code, out: out.join(''), err: err.join(''), calls: server.calls.filter((call) => call.path !== '/api/ask/workspace') };
}

describe('omni ask under OMNI_UNATTENDED', () => {
  it('question exits 3 with unattended and opens no round', async () => {
    const result = await run(['question', '--file', '<file>'], { OMNI_UNATTENDED: '1' });
    expect(result.code).toBe(3);
    expect(result.err.trim()).toBe('unattended');
    expect(result.out).toBe('');
    expect(result.calls).toHaveLength(0);
  });

  it('wait exits 3 with unattended and waits for nothing', async () => {
    const result = await run(['wait', 'round-1'], { OMNI_UNATTENDED: '1' });
    expect(result.code).toBe(3);
    expect(result.err.trim()).toBe('unattended');
    expect(result.calls).toHaveLength(0);
  });

  it('0 means attended: the ask goes on as before', async () => {
    const result = await run(['question', '--file', '<file>', '--wait', '10'], { OMNI_UNATTENDED: '0' });
    expect(result.err).not.toBe('unattended\n');
    expect(result.calls.length).toBeGreaterThan(0);
  });
});
