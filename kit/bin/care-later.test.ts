// PRD 2739, s3: `omni care reply --verdict later` through `main()` — the reply promises the point for a
// follow-up, keeps the person's comment word for word, and records one high item a person answers. Kept
// apart from `care.test.ts`, which proves a rule of its own (testing form: a law's file stays its owner's).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExecFileSyncOptions } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { parsePr } from '../lib/ids.ts';
import { aChange, fakeLoopReads } from '../lib/loop-reads/fake.ts';
import type { FakeLoopState } from '../lib/loop-reads/fake.ts';
import { LoopReadError } from '../lib/loop-reads/port.ts';
import { digText } from './dig.ts';
import { main } from './omni.ts';

const NOW = '2026-11-12T10:00:00Z';
const PR_URL = 'https://github.com/acme/widgets/pull/9';
const SUB_URL = 'https://github.com/acme/widgets/pull/21';
const OUTBOX = '.omni-loop/delivery/outbox/0007-widgets';
const NOTE = 'Low value for this PR: naming preference. Happy to take it as a follow-up.';
/** A person's review comment with punctuation, a code span and two lines (BL-ASK-1). */
const ASKED = 'Please rename `fooBar` — it reads like a typo!\nAnd keep the old name as an alias, for now (one release).';

/** The loop of PRD 7: feature PR #9, its thread T1 opened by a person after an earlier care reply, and a merged sub-PR #21. */
const loop = (more: FakeLoopState = {}) =>
  fakeLoopReads({
    changes: {
      'acme/widgets': [
        aChange({ number: parsePr(21), head: 'feat/widgets--s1', base: 'feat/widgets', state: 'merged', url: SUB_URL }),
        aChange({ number: parsePr(9), head: 'feat/widgets', base: 'main', state: 'open', url: PR_URL }),
      ],
    },
    details: {
      'acme/widgets#9': {
        review: {
          checks: [],
          mergeable: true,
          threads: [
            { id: 'T1', resolved: false, path: 'a/x.ts', line: 1, comments: [{ author: 'bot', body: 'Earlier.\n\n<!-- omni-care: asked -->', createdAt: NOW }, { author: 'rev', body: ASKED, createdAt: NOW }] },
          ],
        },
      },
    },
    ...more,
  });

/** A fake `execFileSync`: git answers the root, `gh api graphql` the reply (or `refusal`) and the resolve. */
function fakeExec(root: string, refusal: string | null) {
  const calls: { file: string; query: string; variables: unknown }[] = [];
  const exec = (file: string, args: readonly string[], options: ExecFileSyncOptions = {}) => {
    if (file === 'git') return `${root}\n`;
    const sent = JSON.parse(String(options.input)) as { variables: unknown };
    const query = digText(sent, 'query');
    calls.push({ file, query, variables: sent.variables });
    if (args.join(' ') !== 'api graphql --input -') throw new Error(`unexpected gh ${args.join(' ')}`);
    if (query.includes('addPullRequestReviewThreadReply')) {
      return JSON.stringify(refusal === null ? { data: { addPullRequestReviewThreadReply: { comment: { url: `${PR_URL}#discussion_r9` } } } } : { errors: [{ message: refusal }] });
    }
    return JSON.stringify({ data: { resolveReviewThread: { thread: { isResolved: true } } } });
  };
  return { exec, calls };
}

async function later({ reads = loop(), thread = 'T1', refusal = null, prd = true }: { reads?: ReturnType<typeof fakeLoopReads>; thread?: string; refusal?: string | null; prd?: boolean } = {}) {
  const { root } = makeRepo({
    git: true,
    files: { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n', '.omni-loop/delivery/inbox/0007-widgets/plan.md': '| id | slice | territory | blocked by | wave |\n| --- | --- | --- | --- | --- |\n| s1 | A | `a/` | — | 2 |\n' },
  });
  writeFileSync(join(root, 'reply.md'), `${NOTE}\n`);
  const fake = fakeExec(root, refusal);
  const out: string[] = [];
  const err: string[] = [];
  const argv = ['care', 'reply', '--verdict', 'later', ...(prd ? ['--prd', '7'] : []), '--thread', thread, '--file', 'reply.md'];
  const code = await main(argv, { cwd: root, exec: fake.exec, reads, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } });
  return { code, out: out.join(''), err: err.join(''), calls: fake.calls, root };
}

describe('omni care reply --verdict later (PRD 2739)', () => {
  it('posts the reply with its marker, resolves the thread, keeps the point and records one high item', async () => {
    const { code, out, calls, root } = await later();
    expect(code).toBe(0);
    expect(calls.map((call) => call.query)).toEqual([expect.stringContaining('addPullRequestReviewThreadReply'), expect.stringContaining('resolveReviewThread')]);
    expect(calls[0]?.variables).toEqual({ thread: 'T1', body: `${NOTE}\n\n<!-- omni-care: later -->` });
    const printed = JSON.parse(out) as { followUp: string; item: { id: string; rank: string; file: string } };
    expect(printed).toMatchObject({ thread: 'T1', verdict: 'later', resolved: true, item: { id: 'care-s0-01-postpone-please-rename-foobar-it-reads-like', rank: 'high' } });

    expect(printed.followUp).toMatch(/^\.omni-loop\/delivery\/follow-ups\/\d{4}-\d{2}-\d{2}-please-rename-foobar-it-reads-like\.md$/);
    const point = readFileSync(join(root, printed.followUp), 'utf8');
    expect(point).toContain(`source: PRD #7 · ${PR_URL}#T1\n`);
    expect(point).toContain(`## Asked\n\n${ASKED}\n\n## Agent's note\n\n${NOTE}\n`);

    expect(printed.item.file).toBe(`${OUTBOX}/care-s0-01-postpone-please-rename-foobar-it-reads-like.md`);
    const item = readFileSync(join(root, printed.item.file), 'utf8');
    expect(item).toContain('rank: high\n');
    expect(item).toContain('wave: 2\n');
    expect(item).toContain(`${PR_URL}#T1`);
    expect(item).toContain(printed.followUp);
    expect(item).toContain('Postpone this to a follow-up, or fix it in this PRD?');
  });

  it("finds the thread on a sub-PR of the PRD, and names the sub-PR's url", async () => {
    const reads = loop({
      details: { 'acme/widgets#21': { review: { checks: [], mergeable: true, threads: [{ id: 'T7', resolved: false, path: null, line: null, comments: [{ author: 'rev', body: ASKED, createdAt: NOW }] }] } } },
    });
    const { code, out, root } = await later({ reads, thread: 'T7' });
    expect(code).toBe(0);
    const { followUp } = JSON.parse(out) as { followUp: string };
    expect(readFileSync(join(root, followUp), 'utf8')).toContain(`source: PRD #7 · ${SUB_URL}#T7\n`);
  });

  it('calls GitHub only to reply and resolve: no read, no issue, no notification', async () => {
    const { calls } = await later();
    expect(calls.map((call) => call.file)).toEqual(['gh', 'gh']);
  });

  it('refuses a later reply posted without --prd, before anything is posted', async () => {
    const { code, err, calls } = await later({ prd: false });
    expect(code).toBe(2);
    expect(err).toMatch(/--prd/);
    expect(calls).toEqual([]);
  });

  it('says not judged and writes nothing when no pull request of the PRD holds the thread', async () => {
    const { code, err, calls, root } = await later({ thread: 'T404' });
    expect(code).toBe(1);
    expect(err).toBe('omni care reply: not judged: could not read thread T404\n');
    expect(calls).toEqual([]);
    expect(existsSync(join(root, '.omni-loop/delivery/follow-ups'))).toBe(false);
    expect(existsSync(join(root, OUTBOX))).toBe(false);
  });

  it('says not judged, naming why, when the loop cannot be read', async () => {
    const { code, err } = await later({ reads: fakeLoopReads({ everything: new LoopReadError('unreachable', 'everything') }) });
    expect(code).toBe(1);
    expect(err).toBe('omni care reply: not judged: could not read thread T1: unreachable\n');
  });

  it('keeps nothing when GitHub refuses the reply', async () => {
    const { code, err, root } = await later({ refusal: 'Resource not accessible' });
    expect(code).toBe(1);
    expect(err).toMatch(/GitHub refused it: Resource not accessible/);
    expect(existsSync(join(root, '.omni-loop/delivery/follow-ups'))).toBe(false);
    expect(existsSync(join(root, OUTBOX))).toBe(false);
  });
});
