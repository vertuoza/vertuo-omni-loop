// `omni e2e status` (PRD 1233, s2), through `main()` on a fixture repository with small trace-1 files.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo, realExec } from '../../test/fixture.ts';
import { main } from '../omni.ts';

const trace = (testId: string, version = 'trace-1') =>
  JSON.stringify({ schemaVersion: version, summary: 's', recordedFor: { testId, callIndex: 0 }, actions: [{ name: 'click', target: 'Rank' }] });
const ON = 'kit: 1\ne2e:\n  enabled: true\n';

async function run(args: string[], config: string, files: Record<string, string> = {}) {
  const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config } });
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['e2e', ...args], { cwd: root, exec: realExec, env: {}, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } });
  return { code, out: out.join(''), err: err.join('') };
}

const TEST = { 'e2e/rank.spec.ts': "test('rank', { tag: 'prd-7' }, () => {})" };

describe('omni e2e status', () => {
  it('prints the tagged tests with their recordings and exits 0 when all have one', async () => {
    const { code, out } = await run(['status', '7'], ON, { ...TEST, 'e2e/.e2e/cache/a.json': trace('rank.spec.ts') });
    expect(JSON.parse(out)).toEqual({
      prd: 7, dir: 'e2e', tests: [{ id: 'rank.spec.ts', file: 'e2e/rank.spec.ts', recording: true, recordings: ['e2e/.e2e/cache/a.json'] }],
    });
    expect(code).toBe(0);
  });

  it('exits 1 when a test has no recording, still printing the JSON', async () => {
    const { code, out } = await run(['status', '7'], ON, TEST);
    expect(JSON.parse(out).tests[0].recording).toBe(false);
    expect(code).toBe(1);
  });

  it('fails naming a recording that is not trace-1 or does not read', async () => {
    const stale = await run(['status', '7'], ON, { ...TEST, 'e2e/.e2e/cache/a.json': trace('rank.spec.ts', 'trace-2') });
    expect(stale.code).toBe(1);
    expect(stale.err).toContain('e2e/.e2e/cache/a.json');
    const bad = await run(['status', '7'], ON, { ...TEST, 'e2e/.e2e/cache/b.json': '{' });
    expect(bad.code).toBe(1);
    expect(bad.err).toContain('e2e/.e2e/cache/b.json');
    expect(bad.out).toBe('');
  });

  it('says so in one line, reading no file, when e2e is off', async () => {
    const { code, out, err } = await run(['status', '7'], 'kit: 1\n', { ...TEST, 'e2e/.e2e/cache/b.json': '{' });
    expect(code).toBe(1);
    expect(out).toBe('');
    expect(err.trim().split('\n')).toHaveLength(1);
    expect(err).toContain('e2e.enabled');
  });

  it('is a usage error without a PRD or with an unknown subcommand', async () => {
    expect((await run(['status'], ON)).code).toBe(2);
    expect((await run(['heal'], ON)).code).toBe(2);
  });
});
