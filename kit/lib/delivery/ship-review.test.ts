// PRD 2739, s3: `omni ship` refuses a PRD whose review promised a point for later and did not keep it —
// the test that would have caught the kit-gaps review's item 1 review promises.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { main } from '../../bin/omni.ts';
import { makeRepo } from '../../test/fixture.ts';
import { parsePr } from '../ids.ts';
import type { LoopChange, LoopChangeDetail } from '../loop-reads/contract.ts';
import { aChange, fakeLoopReads } from '../loop-reads/fake.ts';
import { LoopReadError } from '../loop-reads/port.ts';
import { makeMarkers } from '../markers.ts';

const D = '.omni-loop/delivery';
const NOW = '2026-11-12T10:00:00Z';
const ASKED = 'Please rename `fooBar` — it reads like a typo.\nAnd keep the old name as an alias.';
const REPLY = 'Low value for this PR: naming preference. Happy to take it as a follow-up.\n\n<!-- omni-care: later -->';
const FEATURE_URL = 'https://github.com/acme/widgets/pull/9';
const SUB_URL = 'https://github.com/acme/widgets/pull/21';
const m = makeMarkers('omni-outbox');

const feature = (over: Partial<LoopChange> = {}) => aChange({ number: parsePr(9), head: 'feat/widgets', base: 'main', state: 'draft', url: FEATURE_URL, ...over });
const sub = (over: Partial<LoopChange> = {}) => aChange({ number: parsePr(21), head: 'feat/widgets--s1', base: 'feat/widgets', state: 'merged', url: SUB_URL, mergedAt: NOW, ...over });

type Thread = LoopChangeDetail['review']['threads'][number];
const thread = (id: string, bodies: string[]): Thread => ({
  id,
  path: 'a/x.ts',
  line: 1,
  resolved: true,
  comments: bodies.map((body, index) => ({ author: index === 0 ? 'rev' : 'pierre', body, createdAt: NOW })),
});
const LATER = thread('T1', [ASKED, REPLY]);

const POINT = `---\nsource: PRD #7 · ${FEATURE_URL}#T1\ndate: 2026-11-12\n---\n\n## Asked\n\n${ASKED}\n\n## Agent's note\n\n${REPLY.split('\n')[0] ?? ''}\n`;
const ITEM_TEXT = "Whether a reviewer's comment can wait for a follow-up. Thread `T1`: " + `${FEATURE_URL}#T1`;
const settled = (verdict: 'agreed' | 'drifted') =>
  [
    m.settledOpen('care-s0-01-postpone-x'),
    `## care-s0-01-postpone-x — ${verdict}`,
    `- Verdict: ${verdict}`,
    verdict === 'agreed' ? '- Closed: yes — agreed' : '- Closed: yes — reworked',
    '```text',
    verdict === 'agreed' ? 'A. Postpone it.' : 'B. Fix it in this PRD.',
    '```',
    '```text',
    ITEM_TEXT,
    '```',
    m.settledClose('care-s0-01-postpone-x'),
    '',
  ].join('\n');

function repo(files: Record<string, string> = {}) {
  return makeRepo({
    git: true,
    files: {
      '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n',
      [`${D}/inbox/0007-widgets/spec.md`]: 'x\n',
      [`${D}/inbox/0007-widgets/plan.md`]: 'y\n',
      ...files,
    },
  }).root;
}

function readsOf(changes: LoopChange[], threads: Record<number, Thread[]>) {
  const details = Object.fromEntries(Object.entries(threads).map(([n, list]) => [`acme/widgets#${n}`, { review: { checks: [], mergeable: true, threads: list } }]));
  return fakeLoopReads({ changes: { 'acme/widgets': changes }, details });
}

async function ship(root: string, reads: ReturnType<typeof fakeLoopReads>, prd = '7') {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['ship', prd], { cwd: root, reads, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } });
  return { code, out: out.join(''), err: err.join('') };
}

const NO_FILE = `PR #9: the reply "Low value for this PR: naming preference. Happy…" promised a follow-up that has no file: omni follow-up add --source 'PRD #7 · ${FEATURE_URL}#T1' --text '…'`;
const NO_ITEM = `PR #9: the reply "Low value for this PR: naming preference. Happy…" postpones a person's comment with no outbox item: a person must agree to it`;

describe('omni ship — the review promises (PRD 2739)', () => {
  it('refuses a later reply on the feature PR with no follow-up file and no item, naming the PR and the reply', async () => {
    const root = repo();
    const { code, err } = await ship(root, readsOf([feature()], { 9: [LATER] }));
    expect(code).toBe(1);
    expect(err).toBe(`Cannot ship PRD 7:\n  - ${NO_FILE}\n  - ${NO_ITEM}\n`);
    expect(existsSync(join(root, `${D}/inbox/0007-widgets`))).toBe(true);
  });

  it('refuses a later reply whose item a person agreed to but whose point has no file', async () => {
    const root = repo({ [`${D}/outbox/0007-widgets/settled.md`]: settled('agreed') });
    const { code, err } = await ship(root, readsOf([feature()], { 9: [LATER] }));
    expect(code).toBe(1);
    expect(err).toBe(`Cannot ship PRD 7:\n  - ${NO_FILE}\n`);
  });

  it('refuses a later reply with its file but no outbox item of its thread', async () => {
    const root = repo({ [`${D}/follow-ups/2026-11-12-please-rename.md`]: POINT });
    const { code, err } = await ship(root, readsOf([feature()], { 9: [LATER] }));
    expect(code).toBe(1);
    expect(err).toBe(`Cannot ship PRD 7:\n  - ${NO_ITEM}\n`);
  });

  it('ships once the file exists and a person answered the item', async () => {
    const root = repo({ [`${D}/follow-ups/2026-11-12-please-rename.md`]: POINT, [`${D}/outbox/0007-widgets/settled.md`]: settled('agreed') });
    const { code, out } = await ship(root, readsOf([feature()], { 9: [LATER] }));
    expect(code).toBe(0);
    expect(out).toContain(`moved ${D}/inbox/0007-widgets → ${D}/shipped/0007-widgets`);
  });

  it('holds while the item is still open, as every open item does', async () => {
    const root = repo({ [`${D}/follow-ups/2026-11-12-please-rename.md`]: POINT, [`${D}/outbox/0007-widgets/care-s0-01-postpone-x.md`]: `${ITEM_TEXT}\n` });
    const { code, err } = await ship(root, readsOf([feature()], { 9: [LATER] }));
    expect(code).toBe(1);
    expect(err).toBe(`Cannot ship PRD 7:\n  - open outbox item: ${D}/outbox/0007-widgets/care-s0-01-postpone-x.md\n`);
  });

  it('needs no file once a person chose to fix the point in this PRD', async () => {
    const root = repo({ [`${D}/outbox/0007-widgets/settled.md`]: settled('drifted') });
    const { code } = await ship(root, readsOf([feature()], { 9: [LATER] }));
    expect(code).toBe(0);
  });

  it("reads a merged sub-PR's threads, and leaves a closed one's and a file of another PR aside", async () => {
    const elsewhere = POINT.replace(FEATURE_URL, 'https://github.com/acme/widgets/pull/30');
    const root = repo({ [`${D}/follow-ups/2026-11-12-please-rename.md`]: elsewhere, [`${D}/outbox/0007-widgets/settled.md`]: settled('agreed').replace(FEATURE_URL, SUB_URL) });
    const closed = aChange({ number: parsePr(22), head: 'feat/widgets--s2', base: 'feat/widgets', state: 'closed' });
    const { code, err } = await ship(root, readsOf([feature(), sub(), closed], { 9: [], 21: [LATER], 22: [thread('T9', [ASKED, REPLY])] }));
    expect(code).toBe(1);
    expect(err).toBe(
      `Cannot ship PRD 7:\n  - PR #21: the reply "Low value for this PR: naming preference. Happy…" promised a follow-up that has no file: omni follow-up add --source 'PRD #7 · ${SUB_URL}#T1' --text '…'\n`,
    );
  });

  it('refuses a file and an item of another thread of the same pull request', async () => {
    const other = POINT.replace(`${FEATURE_URL}#T1`, `${FEATURE_URL}#T10`);
    const root = repo({ [`${D}/follow-ups/2026-11-12-other.md`]: other, [`${D}/outbox/0007-widgets/settled.md`]: settled('agreed').replace(`${FEATURE_URL}#T1`, `${FEATURE_URL}#T10`) });
    expect((await ship(root, readsOf([feature()], { 9: [LATER] }))).err).toBe(`Cannot ship PRD 7:\n  - ${NO_FILE}\n  - ${NO_ITEM}\n`);
  });

  it('takes a plain follow-up of its thread, as omni follow-up add writes one, and ignores threads no later reply answered', async () => {
    const plain = `---\nsource: PRD #7 · ${FEATURE_URL}#T1\ndate: 2026-11-12\n---\n\nRename fooBar.\n`;
    const root = repo({ [`${D}/follow-ups/2026-11-12-plain.md`]: plain, [`${D}/outbox/0007-widgets/settled.md`]: settled('agreed') });
    const pushedBack = thread('T2', ['Rename this.', 'Naming taste.\n\n<!-- omni-care: pushed-back -->']);
    expect((await ship(root, readsOf([feature()], { 9: [LATER, pushedBack] }))).code).toBe(0);
  });

  it('says not judged and exits 1 when the threads cannot be read, never a pass', async () => {
    const root = repo({ [`${D}/follow-ups/2026-11-12-please-rename.md`]: POINT });
    const { code, out, err } = await ship(root, fakeLoopReads({ everything: new LoopReadError('unreachable', 'everything') }));
    expect(code).toBe(1);
    expect(out).toBe('');
    expect(err).toBe("not judged: could not read the review threads of PRD 7's pull requests: unreachable\n");
    expect(existsSync(join(root, `${D}/inbox/0007-widgets`))).toBe(true);
  });

  it('reads nothing for a PRD that is not in the inbox', async () => {
    const root = repo();
    const reads = fakeLoopReads({ everything: new LoopReadError('unreachable', 'everything') });
    const { code, err } = await ship(root, reads, '9');
    expect(code).toBe(1);
    expect(err).toMatch(/Cannot ship PRD 9/);
    expect(reads.reads).toEqual([]);
  });
});
