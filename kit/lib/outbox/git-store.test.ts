// The `git` outbox store's own ground (PRD 1548, slice s6): where its files land, which ones count,
// and the errors a repository can raise, beside the contract every store meets
// (`store.contract.test.ts`). And the seam itself: the outbox verbs reach the outbox through the
// store, never through the filesystem or the library functions the store wraps.
import { chmodSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { parseOutboxItemId, parsePrd } from '../ids.ts';
import { lawsFor } from '../laws.ts';
import { gitOutboxStore } from './git-store.ts';
import { outboxStore } from './stores.ts';

const OUTBOX = '.omni-loop/delivery/outbox/0042-a';
const ITEM_ID = parseOutboxItemId('s7-02-default-country');
const PRD = parsePrd(42);

/** A repository holding PRD 42 and PRD 43, and the files `files` adds. */
function repo(files: Record<string, string> = {}) {
  return makeRepo({
    files: {
      '.omni-loop/delivery/inbox/0042-a/spec.md': 'x',
      '.omni-loop/delivery/inbox/0043-b/spec.md': 'x',
      ...files,
    },
  });
}

describe('the git outbox store', () => {
  it('writes an item as <id>.md in the PRD outbox folder, creating it, and names it from the root', async () => {
    const { root, ctx } = repo();
    const written = await gitOutboxStore(ctx).writeItem({ prd: PRD, id: ITEM_ID, text: 'the text' }, null);
    expect(written).toBe(`${OUTBOX}/${ITEM_ID}.md`);
    expect(readFileSync(join(root, written), 'utf8')).toBe('the text');
  });

  it('writes into an --out folder it creates, named as the caller spelled it', async () => {
    const { root, ctx } = repo();
    const abs = join(root, 'deep/scratch');
    const written = await gitOutboxStore(ctx).writeItem({ prd: PRD, id: ITEM_ID, text: 'the text' }, { abs, shown: './deep/scratch' });
    expect(written).toBe(`deep/scratch/${ITEM_ID}.md`);
    expect(readFileSync(join(abs, `${ITEM_ID}.md`), 'utf8')).toBe('the text');
    expect(existsSync(join(root, OUTBOX))).toBe(false);
  });

  it('refuses a PRD with no inbox or shipped folder, as the library does', async () => {
    const { ctx } = repo();
    const store = gitOutboxStore(ctx);
    const none = parsePrd(7);
    await expect(store.writeItem({ prd: none, id: ITEM_ID, text: 'x' }, null)).rejects.toThrow(/^PRD 7 has no inbox or shipped folder$/);
    await expect(store.spentIds(none, null)).rejects.toThrow(/^PRD 7 has no inbox or shipped folder$/);
  });

  it('spends the ids of this PRD only: its open files, its ledger, and the .md files of --out', async () => {
    const { root, ctx } = repo({
      [`${OUTBOX}/s1-01-open.md`]: 'x',
      [`${OUTBOX}/settled.md`]: '<!-- omni-outbox-settled: s1-02-settled -->\n\n## s1-02-settled — agreed\n\n<!-- /omni-outbox-settled: s1-02-settled -->\n',
      '.omni-loop/delivery/outbox/0043-b/s1-03-other-prd.md': 'x',
      'scratch/s1-04-scratch.md': 'x',
      'scratch/s1-05-not-markdown.txt': 'x',
      'scratch/s1-06-folder.md/inside.md': 'x',
    });
    const store = gitOutboxStore(ctx);
    expect([...(await store.spentIds(PRD, null))].sort()).toEqual(['s1-01-open', 's1-02-settled']);
    const out = { abs: join(root, 'scratch'), shown: 'scratch' };
    expect([...(await store.spentIds(PRD, out))].sort()).toEqual(['s1-01-open', 's1-02-settled', 's1-04-scratch']);
    expect([...(await store.spentIds(PRD, { abs: join(root, 'missing'), shown: 'missing' }))].sort()).toEqual(['s1-01-open', 's1-02-settled']);
  });

  it('reads and removes an item by a path from the root or an absolute one', async () => {
    const { root, ctx } = repo({ [`${OUTBOX}/${ITEM_ID}.md`]: 'the text' });
    const store = gitOutboxStore(ctx);
    const absolute = join(root, OUTBOX, `${ITEM_ID}.md`);
    expect(await store.readItem(absolute)).toEqual({ ok: true, text: 'the text' });
    expect(await store.readItem(`${OUTBOX}/${ITEM_ID}.md`)).toEqual({ ok: true, text: 'the text' });
    await store.removeItem(absolute);
    expect(existsSync(absolute)).toBe(false);
  });

  it('answers a folder or an unreadable file by its code, and throws any other error', async () => {
    const { root, ctx } = repo({ 'locked.md': 'x', 'plain.md': 'x' });
    const store = gitOutboxStore(ctx);
    expect(await store.readItem(OUTBOX.replace('outbox', 'inbox'))).toEqual({ ok: false, code: 'EISDIR' });
    chmodSync(join(root, 'locked.md'), 0o000);
    expect(await store.readItem('locked.md')).toEqual({ ok: false, code: 'EACCES' });
    chmodSync(join(root, 'locked.md'), 0o644);
    await expect(store.readItem('plain.md/below.md')).rejects.toThrow(/ENOTDIR/);
  });

  it('relays nothing from a file or a missing path: neither is a folder', async () => {
    const { root, ctx } = repo({ 'scratch.md': 'x' });
    const store = gitOutboxStore(ctx);
    expect(await store.relay(PRD, join(root, 'scratch.md'), lawsFor(ctx))).toBeNull();
    expect(await store.relay(PRD, join(root, 'missing'), lawsFor(ctx))).toBeNull();
    mkdirSync(join(root, 'empty'));
    expect(await store.relay(PRD, join(root, 'empty'), lawsFor(ctx))).toEqual({ moved: [], refused: [] });
  });

  it('is the store every outbox verb of a repository reaches today', async () => {
    const { root, ctx } = repo();
    const written = await outboxStore(ctx).writeItem({ prd: PRD, id: ITEM_ID, text: 'the text' }, null);
    expect(readFileSync(join(root, written), 'utf8')).toBe('the text');
  });
});

/** The outbox verbs, and the one write to a file of its own each may still make: the outbox gate's
 * GitHub Actions output, and the comment's `--result` file. Neither is the outbox. */
const VERBS: Readonly<Record<string, readonly string[]>> = {
  item: [],
  adopt: [],
  settle: [],
  status: ['appendFileSync'],
  answers: [],
  replies: [],
  comment: ['writeFileSync'],
};

/** What only the store calls: the library functions behind its methods. */
const BEHIND_THE_STORE = [
  'adoptItem', 'settleItem', 'relayFolder', 'gateResult', 'openItemsForPrd', 'adoptedEntriesForPrd',
  'readReplies', 'upsertOutboxPrComment', 'upsertOutboxComment', 'outboxItemFiles', 'parseSettledEntries',
];

describe('the outbox verbs', () => {
  it.each(Object.entries(VERBS))('omni %s reaches the outbox only through the store', (verb, ownWrites) => {
    const source = readFileSync(new URL(`../../bin/commands/${verb}.ts`, import.meta.url), 'utf8');
    const fsImport = /^import \{([^}]*)\} from 'node:fs';$/m.exec(source);
    const fsNames = fsImport?.[1]?.split(',').map((name) => name.trim()) ?? [];
    expect(fsNames).toEqual(ownWrites);
    const imports = source.match(/^import [^;]*;$/gm)?.join('\n') ?? '';
    expect(imports).toContain("from '../../lib/outbox/stores.ts'");
    for (const name of BEHIND_THE_STORE) expect(imports).not.toMatch(new RegExp(`\\b${name}\\b`));
  });
});
