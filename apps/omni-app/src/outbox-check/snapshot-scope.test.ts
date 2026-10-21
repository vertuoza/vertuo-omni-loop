// Issue 1968: the outbox check fetched every file of the head's delivery folder, one GitHub call
// each, though the gate reads the contents of the pull request's own PRD (or fix) folder alone. On
// a repository with a long shipped history that drained the installation's GitHub budget, and every
// check waited up to an hour and a half for it. Every other PRD's files are now listed, never fetched,
// and the verdict is the one the whole folder gave.
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InngestTestEngine } from '@inngest/test';
import { afterEach, describe, expect, it } from 'vitest';
import { parsePr } from 'omni-loop/kit/lib/ids.ts';
import { inngest, OUTBOX_CHECK_EVENT } from '../inngest-client.ts';
import { fakeGitHub } from './fake-github.ts';
import { createOutboxCheck } from './outbox-check.ts';

const FIXTURES = fileURLToPath(new URL('../../test/fixtures/', import.meta.url));
const fixture = (name: string) => join(FIXTURES, name);

const BLOB = 'GET /repos/{owner}/{repo}/git/blobs/{file_sha}';

/** Another PRD's files, already shipped, beside the pull request's own. */
const SHIPPED = {
  '.omni-loop/delivery/shipped/0007-gadget/spec.md': '---\nprd: 7\ntitle: Gadget\nblocked-by: none\nspec: file\n---\n\n## Problem\n',
  '.omni-loop/delivery/shipped/0007-gadget/outbox/settled.md': '# Settled\n',
  '.omni-loop/delivery/shipped/0007-gadget/outbox/accounts/s1.md': '---\nprd: 7\nslice: s1\ngraded: 2026-01-01\n---\n',
  '.omni-loop/delivery/bugs/0099-other/bug.md': '# Bug 99: another\n',
};

const made: string[] = [];
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A copy of a head fixture, with `extra` files written into it. */
function headWith(name: string, extra: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'omni-head-'));
  made.push(dir);
  cpSync(fixture(name), dir, { recursive: true });
  for (const [path, body] of Object.entries(extra)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), body);
  }
  return dir;
}

const event = () => ({
  name: OUTBOX_CHECK_EVENT,
  data: { installationId: 7, owner: 'acme', repo: 'widgets', repository: 'acme/widgets', prNumber: 12, headSha: 'head1', trigger: 'pull_request.synchronize' },
});

/** One run of the check on a pull request from `headRef`; what it fetched and what it concluded. */
async function run({ base, head, headRef }: { base: string; head: string; headRef: string }) {
  const github = fakeGitHub({
    commits: { base1: base, head1: head },
    pull: { number: parsePr(12), base: { ref: 'main', sha: 'base1' }, head: { ref: headRef, sha: 'head1' } },
  });
  const fn = createOutboxCheck({ client: inngest, octokitFor: () => github.octokit });
  const { result } = await new InngestTestEngine({ function: fn, events: [event()] }).execute();
  const fetched = github.state.requests.filter((r) => r.route === BLOB).map((r) => String(r.file_sha));
  return { result, fetched };
}

describe('outbox-check — the delivery folder is listed, and only the pull request\'s own folder fetched (issue 1968)', () => {
  it('a feature PR fetches no file of another PRD, and concludes as it did on the whole folder', async () => {
    const alone = await run({ base: fixture('base-active'), head: fixture('head-open'), headRef: 'feat/widget' });
    const beside = await run({ base: fixture('base-active'), head: headWith('head-open', SHIPPED), headRef: 'feat/widget' });

    expect(beside.fetched.filter((sha) => sha.includes('0007-gadget') || sha.includes('0099-other'))).toEqual([]);
    expect(beside.fetched).toContain('head1:.omni-loop/delivery/inbox/0042-widget/spec.md');
    expect(beside.fetched).toContain('head1:.omni-loop/delivery/outbox/0042-widget/s1-01-widget-colour.md');
    expect(beside.result).toEqual(alone.result);
  });

  it('a fix PR fetches its own fix folder and no other PRD\'s or fix\'s files', async () => {
    const alone = await run({ base: fixture('base-laws'), head: fixture('head-laws-fix'), headRef: 'fix/77-crash' });
    const beside = await run({ base: fixture('base-laws'), head: headWith('head-laws-fix', SHIPPED), headRef: 'fix/77-crash' });

    expect(beside.fetched.filter((sha) => sha.includes('0007-gadget') || sha.includes('0099-other'))).toEqual([]);
    expect(beside.fetched).toContain('head1:.omni-loop/delivery/bugs/0077-crash/bug.md');
    expect(beside.result).toEqual(alone.result);
  });
});
