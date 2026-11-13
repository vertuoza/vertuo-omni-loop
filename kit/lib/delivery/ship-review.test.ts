// PRD 2739, s3: `omni ship` refuses a PRD whose review promised a point for later and did not keep it —
// the test that would have caught the kit-gaps review's item 1 review promises. BR-PRODUCT-130: it
// reads the promises from what the repository holds (the item each `later` reply records), never the
// review threads, so a repository that never reviews ships unblocked, with no `not judged` line.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { main } from '../../bin/omni.ts';
import { makeRepo } from '../../test/fixture.ts';
import { postponeItem } from '../care/later.ts';
import { fakeLoopReads } from '../loop-reads/fake.ts';
import { LoopReadError } from '../loop-reads/port.ts';
import { makeMarkers } from '../markers.ts';

const D = '.omni-loop/delivery';
const ASKED = 'Please rename `fooBar` — it reads like a typo.\nAnd keep the old name as an alias.';
const NOTE = 'Low value for this PR: naming preference. Happy to take it as a follow-up.';
const FEATURE_URL = 'https://github.com/acme/widgets/pull/9';
const SUB_URL = 'https://github.com/acme/widgets/pull/21';
const m = makeMarkers('omni-outbox');

const POINT = `---\nsource: PRD #7 · ${FEATURE_URL}#T1\ndate: 2026-11-12\n---\n\n## Asked\n\n${ASKED}\n\n## Agent's note\n\n${NOTE}\n`;

/** The decision text `omni care reply --verdict later` writes in its item, for thread `url`. */
const itemText = (url = `${FEATURE_URL}#T1`) =>
  `## What I had to decide\n\n${postponeItem({ threadId: 'T1', url, followUp: `${D}/follow-ups/2026-11-12-please-rename.md`, asked: ASKED, note: NOTE }).decide}\n`;

const settled = (verdict: 'agreed' | 'drifted', text = itemText()) =>
  [
    m.settledOpen('care-s0-01-postpone-x'),
    `## care-s0-01-postpone-x — ${verdict}`,
    `- Verdict: ${verdict}`,
    verdict === 'agreed' ? '- Closed: yes — agreed' : '- Closed: yes — reworked',
    '```text',
    verdict === 'agreed' ? 'A. Postpone it.' : 'B. Fix it in this PRD.',
    '```',
    '```text',
    text,
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

/** Loop reads that fail on every call and record each one: a ship that reads the network shows it. */
const unreachable = () => fakeLoopReads({ everything: new LoopReadError('unreachable', 'everything') });

async function ship(root: string, prd = '7') {
  const reads = unreachable();
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['ship', prd], { cwd: root, reads, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } });
  return { code, out: out.join(''), err: err.join(''), reads: reads.reads };
}

const noFile = (pr: number, url: string) =>
  `PR #${pr}: the reply "Low value for this PR: naming preference. Happy…" promised a follow-up that has no file: omni follow-up add --source 'PRD #7 · ${url}' --text '…'`;
const NO_FILE = noFile(9, `${FEATURE_URL}#T1`);

describe('omni ship — the review promises (PRD 2739, BR-PRODUCT-130)', () => {
  it('ships a PRD with no review, reading nothing from the network and never saying not judged', async () => {
    const root = repo();
    const { code, out, err, reads } = await ship(root);
    expect(code).toBe(0);
    expect(out).toContain(`moved ${D}/inbox/0007-widgets → ${D}/shipped/0007-widgets`);
    expect(err).not.toContain('not judged');
    expect(reads).toEqual([]);
  });

  it('refuses a later item a person agreed to whose point has no file, naming the PR and the reply', async () => {
    const root = repo({ [`${D}/outbox/0007-widgets/settled.md`]: settled('agreed') });
    const { code, err, reads } = await ship(root);
    expect(code).toBe(1);
    expect(err).toBe(`Cannot ship PRD 7:\n  - ${NO_FILE}\n`);
    expect(reads).toEqual([]);
    expect(existsSync(join(root, `${D}/inbox/0007-widgets`))).toBe(true);
  });

  it('refuses an open later item with no file, on top of the open item itself', async () => {
    const root = repo({ [`${D}/outbox/0007-widgets/care-s0-01-postpone-x.md`]: itemText() });
    const { code, err } = await ship(root);
    expect(code).toBe(1);
    expect(err).toBe(`Cannot ship PRD 7:\n  - open outbox item: ${D}/outbox/0007-widgets/care-s0-01-postpone-x.md\n  - ${NO_FILE}\n`);
  });

  it('holds while the item is still open, as every open item does', async () => {
    const root = repo({ [`${D}/follow-ups/2026-11-12-please-rename.md`]: POINT, [`${D}/outbox/0007-widgets/care-s0-01-postpone-x.md`]: itemText() });
    const { code, err } = await ship(root);
    expect(code).toBe(1);
    expect(err).toBe(`Cannot ship PRD 7:\n  - open outbox item: ${D}/outbox/0007-widgets/care-s0-01-postpone-x.md\n`);
  });

  it('ships once the file exists and a person answered the item', async () => {
    const root = repo({ [`${D}/follow-ups/2026-11-12-please-rename.md`]: POINT, [`${D}/outbox/0007-widgets/settled.md`]: settled('agreed') });
    const { code, out } = await ship(root);
    expect(code).toBe(0);
    expect(out).toContain(`moved ${D}/inbox/0007-widgets → ${D}/shipped/0007-widgets`);
  });

  it('needs no file once a person chose to fix the point in this PRD', async () => {
    const root = repo({ [`${D}/outbox/0007-widgets/settled.md`]: settled('drifted') });
    expect((await ship(root)).code).toBe(0);
  });

  it("names a sub-PR's thread by its pull request", async () => {
    const root = repo({ [`${D}/outbox/0007-widgets/settled.md`]: settled('agreed', itemText(`${SUB_URL}#T1`)) });
    expect((await ship(root)).err).toBe(`Cannot ship PRD 7:\n  - ${noFile(21, `${SUB_URL}#T1`)}\n`);
  });

  it('refuses a file of another thread of the same pull request', async () => {
    const other = POINT.replace(`${FEATURE_URL}#T1`, `${FEATURE_URL}#T10`);
    const root = repo({ [`${D}/follow-ups/2026-11-12-other.md`]: other, [`${D}/outbox/0007-widgets/settled.md`]: settled('agreed') });
    expect((await ship(root)).err).toBe(`Cannot ship PRD 7:\n  - ${NO_FILE}\n`);
  });

  it('takes a plain follow-up of its thread, as omni follow-up add writes one, and ignores items no later reply wrote', async () => {
    const plain = `---\nsource: PRD #7 · ${FEATURE_URL}#T1\ndate: 2026-11-12\n---\n\nRename fooBar.\n`;
    const other = settled('agreed', 'An item of another kind, naming no thread.\n').replaceAll('care-s0-01-postpone-x', 's1-01-other');
    const root = repo({ [`${D}/follow-ups/2026-11-12-plain.md`]: plain, [`${D}/outbox/0007-widgets/settled.md`]: `${settled('agreed')}${other}` });
    expect((await ship(root)).code).toBe(0);
  });

  it('reads nothing for a PRD that is not in the inbox', async () => {
    const { code, err, reads } = await ship(repo(), '9');
    expect(code).toBe(1);
    expect(err).toMatch(/Cannot ship PRD 9/);
    expect(reads).toEqual([]);
  });
});
