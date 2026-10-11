// `omni approval <n>` and `omni approval restore <n>` (PRD 1612, s1), seen from the outside: through
// `main()` on a fixture repository, the approval route stubbed. `omni approval <n>` prints the shared
// judge's lines unchanged; `restore` writes each drifted file back from its pinned content, one line per
// file, and never commits or pushes.
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import type { FetchInit } from '../test/fixture.ts';
import { sha256 } from '../lib/dossier/folder.ts';
import type { Tokens } from '../lib/ask/schema.ts';
import { main } from './omni.ts';

const HOST = 'omni.test';
const URL_ = 'https://omni.test/prd/acme/widgets/1612';
const INBOX = '.omni-loop/delivery/inbox/1612-approved-gate';
const SPEC = '---\nprd: 1612\ntitle: A\nblocked-by: none\nspec: file\nphase0: server\n---\n\n# A\n';
const PLAN = '# Plan\n\n| id | slice |\n';
const CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: https://omni.test\n';

const pinned = (kind: 'spec' | 'plan', content: string, extra: Record<string, unknown> = {}) =>
  ({ kind, path: `${INBOX}/${kind}.md`, sha256: sha256(content), versionId: `v-${kind}`, content, ...extra });

const approved = (files: unknown[]) => ({ url: URL_, approval: { approver: { login: 'ada', member: true }, approvedAt: 't', files } });

function checkout(plan: string) {
  const repo = makeRepo({ git: true, files: { '.omni-loop/config.yml': CONFIG, [`${INBOX}/spec.md`]: SPEC, [`${INBOX}/plan.md`]: plan } });
  const tokens: Record<string, Tokens> = { [HOST]: { access_token: 'a', refresh_token: 'r' } };
  return { ...repo, tokens: { read: (host: string) => tokens[host] ?? null, write: () => {} } };
}

async function omni(args: string[], { root, tokens }: ReturnType<typeof checkout>, body: unknown) {
  const out: string[] = [];
  const err: string[] = [];
  const fetch = (_url: string, _init: FetchInit) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  const code = await main(['approval', ...args], {
    cwd: root, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) }, tokens, env: {}, fetch,
  });
  return { code, out: out.join(''), err: err.join('') };
}

const git = (root: string, ...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });

describe('omni approval <n>', () => {
  it('prints the judge\'s lines as before: drifted, exit 1', async () => {
    const repo = checkout('another plan');
    expect(await omni(['1612'], repo, approved([pinned('spec', SPEC), pinned('plan', PLAN)]))).toEqual({
      code: 1, err: '', out: `≠ plan.md · content · ✗ refuse · restore it, or approve again: ${URL_}\n`,
    });
  });
});

describe('omni approval restore <n>', () => {
  it('writes each drifted file back, one line per file, then the judge reads approved; nothing is committed', async () => {
    const repo = checkout('another plan');
    const head = git(repo.root, 'rev-parse', 'HEAD');
    const body = approved([pinned('spec', SPEC), pinned('plan', PLAN)]);
    expect(await omni(['restore', '1612'], repo, body)).toEqual({
      code: 0, err: '', out: `restored ${INBOX}/plan.md · content · sha256 ${sha256(PLAN).slice(0, 7)}\n`,
    });
    expect(repo.read(`${INBOX}/plan.md`)).toBe(PLAN);
    expect(git(repo.root, 'rev-parse', 'HEAD')).toBe(head);
    expect(git(repo.root, 'status', '--porcelain')).toBe(` M ${INBOX}/plan.md\n`);
    expect((await omni(['1612'], repo, body)).code).toBe(0);
  });

  it('refuses a pinned version that does not hash, exit 1, the file untouched', async () => {
    const repo = checkout('another plan');
    const run = await omni(['restore', '1612'], repo, approved([pinned('spec', SPEC), pinned('plan', PLAN, { content: 'tampered' })]));
    expect(run).toMatchObject({ code: 1, out: `refused ${INBOX}/plan.md · the pinned version does not hash to ${sha256(PLAN).slice(0, 7)} · approve again: ${URL_}\n` });
    expect(repo.read(`${INBOX}/plan.md`)).toBe('another plan');
  });

  it('is named by omni help approval', async () => {
    const out: string[] = [];
    const sink = { write: (s: string) => out.push(s) };
    expect(await main(['help', 'approval'], { cwd: checkout(PLAN).root, stdout: sink, stderr: sink, env: {} })).toBe(0);
    expect(out.join('')).toContain('omni approval restore <n>');
  });

  it('refuses a usage it does not know', async () => {
    const repo = checkout(PLAN);
    expect((await omni(['restore'], repo, approved([]))).code).toBe(2);
    expect((await omni(['restore', '1612', 'x'], repo, approved([]))).code).toBe(2);
  });
});
