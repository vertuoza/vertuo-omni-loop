// `omni e2e guard` (PRD 1276, s2), through `main()` on a fixture plan repository. Secret-shaped fixtures are
// built at run time so no file of this repository holds one.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo, realExec } from '../../test/fixture.ts';
import { main } from '../omni.ts';

const ON = 'kit: 1\ne2e:\n  enabled: true\n';
const SECRET = ['hunter', '2xyz', '987'].join('');
const assign = (name: string) => `const ${name} = '${SECRET}';\n`;

async function run(config: string, files: Record<string, string>, args = ['guard', '7']) {
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

describe('omni e2e guard', () => {
  it('exits 0 on a clean folder', async () => {
    const { code, out } = await run(ON, { 'e2e/a.spec.ts': "const password = process.env.QA_PASSWORD;\ntest('a', () => {});\n" });
    expect(code).toBe(0);
    expect(JSON.parse(out)).toMatchObject({ prd: 7, findings: 0 });
  });

  it('exits 1 naming file:line and the kind, never the value', async () => {
    const { code, out, err } = await run(ON, { 'e2e/a.spec.ts': `test('a', () => {});\n${assign('password')}` });
    expect(code).toBe(1);
    expect(err).toContain('e2e/a.spec.ts:2');
    expect(err).toContain('password, token or key');
    expect(err + out).not.toContain(SECRET);
  });

  it('refuses a token, a key and a session-state shape', async () => {
    const { code, err } = await run(ON, {
      'e2e/t.ts': `fetch(u, { headers: { Authorization: 'Bearer ${'a'.repeat(24)}' } });\n`,
      'e2e/k.ts': `-----BEGIN RSA ${'PRIVATE'} KEY-----\n`,
      'e2e/s.json': '{ "cookies": [], "origins": [] }\n',
    });
    expect(code).toBe(1);
    expect(err).toContain('e2e/t.ts:1');
    expect(err).toContain('e2e/k.ts:1');
    expect(err).toContain('e2e/s.json:1');
  });

  it('refuses storage-state.json by name, wherever it sits under e2e.dir', async () => {
    const { code, err } = await run(ON, { 'e2e/.auth/storage-state.json': '{}' });
    expect(code).toBe(1);
    expect(err).toContain('e2e/.auth/storage-state.json:1');
    expect(err).toContain('saved session');
  });

  it('leaves the ignored recording cache alone', async () => {
    const { code } = await run(ON, { 'e2e/.e2e/cache/a.json': assign('token') });
    expect(code).toBe(0);
  });

  it('also reads files of the branch outside e2e.dir', async () => {
    const { code, err } = await run(ON, { 'e2e/a.spec.ts': 'test();\n', 'notes/login.md': assign('apiKey') });
    expect(code).toBe(1);
    expect(err).toContain('notes/login.md:1');
  });

  it('says so in one line, reading no file, when e2e is off', async () => {
    const { code, out, err } = await run('kit: 1\n', { 'e2e/a.spec.ts': assign('password') });
    expect(code).toBe(1);
    expect(out).toBe('');
    expect(err.trim().split('\n')).toHaveLength(1);
    expect(err).toContain('e2e.enabled');
  });

  it('is a usage error without a PRD', async () => {
    const { code } = await run(ON, {}, ['guard']);
    expect(code).toBe(2);
  });
});
