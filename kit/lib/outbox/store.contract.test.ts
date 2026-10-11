// The outbox store contract (PRD 1548, slice s6): what every `OutboxStore` does, run against each
// store through its methods alone, so two stores cannot drift. Each store hands the suite a fresh
// outbox of a PRD with nothing in it, and a scratch folder beside it for `--out` and the relay.
// The `git` store runs on a fixture repository, with PRD 42; slice s7's `server` store on a fake of
// its routes (`kit/test/fake-outbox-routes.ts`), with product PRD mobile-12. Where the two differ by
// design, a trait says how: the server deletes nothing, and a product PRD's questions are answered on
// its Questions tab, never in a GitHub comment.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fakeOutboxRoutes } from '../../test/fake-outbox-routes.ts';
import { makeRepo } from '../../test/fixture.ts';
import { parseCommentId, parseOutboxItemId, parsePr, parsePrd, parseProductPrdId } from '../ids.ts';
import { lawsFor } from '../laws.ts';
import type { Laws } from '../laws.ts';
import type { CommentClient } from './comment.ts';
import { gitOutboxStore } from './git-store.ts';
import type { OutboxPrd, OutboxStore, OutFolder } from './store.ts';
import { outboxStore } from './stores.ts';

/** What one store hands each case: the store, its PRD, a scratch folder, and the laws it grades by. */
type Subject = { store: OutboxStore; prd: OutboxPrd; scratch: string; laws: Laws };

/** How a store differs by design: whether it deletes an item no ledger holds, and whether it writes
 * the outbox comments on GitHub. */
type Traits = { deletes: boolean; comments: boolean };

const SIGNED_IN = { 'omni.example': { access_token: 'access-1', refresh_token: 'refresh-1' } };

/** Every store the contract runs against, by name. */
const STORES: readonly (readonly [string, Traits, () => Subject])[] = [
  [
    'git',
    { deletes: true, comments: true },
    () => {
      const { root, ctx } = makeRepo({ files: { '.omni-loop/delivery/inbox/0042-a/spec.md': 'x' } });
      const scratch = join(root, 'scratch');
      mkdirSync(scratch);
      return { store: gitOutboxStore(ctx), prd: parsePrd(42), scratch, laws: lawsFor(ctx) };
    },
  ],
  [
    'server',
    { deletes: false, comments: false },
    () => {
      const { root, ctx } = makeRepo({ config: { ask: { url: 'https://omni.example' }, dossier: { enabled: true } } });
      const scratch = join(root, 'scratch');
      mkdirSync(scratch);
      const tokens = { read: (host: string) => SIGNED_IN[host as keyof typeof SIGNED_IN] ?? null, write: () => undefined };
      const prd = parseProductPrdId('mobile-12');
      return { store: outboxStore(ctx, prd, { tokens, fetch: fakeOutboxRoutes().fetch }), prd, scratch, laws: lawsFor(ctx) };
    },
  ],
];

const MEDIUM_ID = parseOutboxItemId('s7-01-default-timeout');
const HIGH_ID = parseOutboxItemId('s7-02-default-country');

/** An item of PRD `prd` at `rank`, with every section an item carries. */
function itemText(prd: OutboxPrd, id: string, rank: string): string {
  return [
    '---', `id: ${id}`, `prd: ${prd}`, 'slice: s7', `rank: ${rank}`, 'bears-on: none', 'raised: 2026-09-22', 'wave: 4', '---', '',
    '## The question, in plain words', '', 'How long should we wait before giving up on a slow call?', '',
    '## The decision, in plain words', '', 'We wait five seconds, which is generous without being unbounded.', '',
    '## The options, in plain words', '', 'A. Wait five seconds, the option built.', 'B. Wait one second, so a stuck call is caught sooner.', '',
    '## What I had to decide', '', 'How long a slow call gets before it is treated as stuck.', '',
    '## What I did meanwhile', '', 'Five seconds, a constant with no migration to undo it.', '',
    '## What it costs to change later', '', 'One constant.', '',
    '## What I could not know', '', '(author) Whether five seconds is measured against a real incident.', '',
  ].join('\n');
}

const AGREED = {
  text: 'Yes, five seconds is right.',
  approvedBy: 'pm',
  approvedAt: '2026-10-11',
  channel: { kind: 'feature-pull-request', number: 7 },
  statedVerdict: 'agreed',
};

/** A pull request with no comment yet, which records what is written on it. */
function emptyPullRequest(): CommentClient & { bodies: string[] } {
  const bodies: string[] = [];
  return {
    bodies,
    listComments: () => [],
    createComment: (body) => {
      bodies.push(body);
      return { id: parseCommentId(1), html_url: 'https://github.com/acme/widgets/pull/7#issuecomment-1' };
    },
    updateComment: () => null,
  };
}

/** The ids of PRD `prd`'s open items. */
async function openIds(store: OutboxStore, prd: OutboxPrd): Promise<string[]> {
  return (await store.openItems(prd)).map((item) => item.id);
}

describe.each(STORES)('the %s outbox store', (_name, traits, make) => {
  it('holds nothing for a PRD with no item yet, and its gate is green', async () => {
    const { store, prd } = make();
    expect(await store.openItems(prd)).toEqual([]);
    expect(await store.adoptedEntries(prd)).toEqual([]);
    expect([...(await store.spentIds(prd, null))]).toEqual([]);
    const gate = await store.gate(prd, {});
    expect(gate.ok).toBe(true);
    expect(gate.items).toEqual([]);
  });

  it('writes an open item it reads back word for word, counts open, and spends its id', async () => {
    const { store, prd } = make();
    const text = itemText(prd, HIGH_ID, 'high');
    const ref = await store.writeItem({ prd, id: HIGH_ID, text }, null);
    expect(await store.readItem(ref)).toEqual({ ok: true, text });
    expect(await openIds(store, prd)).toEqual([HIGH_ID]);
    expect([...(await store.spentIds(prd, null))]).toEqual([HIGH_ID]);
    const gate = await store.gate(prd, {});
    expect(gate.ok).toBe(false);
    expect(gate.items.map((item) => item.id)).toEqual([HIGH_ID]);
  });

  it.runIf(traits.deletes)('reads no item where none was written', async () => {
    const { store, prd } = make();
    const ref = await store.writeItem({ prd, id: HIGH_ID, text: itemText(prd, HIGH_ID, 'high') }, null);
    await store.removeItem(ref);
    expect(await store.readItem(ref)).toEqual({ ok: false, code: 'ENOENT' });
    expect(await store.openItems(prd)).toEqual([]);
    expect([...(await store.spentIds(prd, null))]).toEqual([]);
  });

  it('adopts an open medium item, then reads it no more: spent, adopted, and its removal leaves it so', async () => {
    const { store, prd } = make();
    const text = itemText(prd, MEDIUM_ID, 'medium');
    const ref = await store.writeItem({ prd, id: MEDIUM_ID, text }, null);
    expect((await store.adopt(text)).ok).toBe(true);
    await store.removeItem(ref);
    expect(await store.readItem(ref)).toEqual({ ok: false, code: 'ENOENT' });
    expect(await store.openItems(prd)).toEqual([]);
    expect((await store.adoptedEntries(prd)).map((entry) => [entry.id, entry.verdict, entry.itemText])).toEqual([[MEDIUM_ID, 'adopted', text]]);
    expect([...(await store.spentIds(prd, null))]).toEqual([MEDIUM_ID]);
  });

  it('adopts a medium item straight to the ledger: spent, adopted, never open', async () => {
    const { store, prd } = make();
    const result = await store.adopt(itemText(prd, MEDIUM_ID, 'medium'));
    expect(result.ok).toBe(true);
    expect((await store.adoptedEntries(prd)).map((entry) => entry.id)).toEqual([MEDIUM_ID]);
    expect([...(await store.spentIds(prd, null))]).toEqual([MEDIUM_ID]);
    expect(await store.openItems(prd)).toEqual([]);
    expect((await store.gate(prd, {})).ok).toBe(true);
  });

  it('refuses to adopt an item that is not medium, and writes nothing', async () => {
    const { store, prd } = make();
    const result = await store.adopt(itemText(prd, HIGH_ID, 'high'));
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors).not.toEqual([]);
    expect(await store.adoptedEntries(prd)).toEqual([]);
    expect([...(await store.spentIds(prd, null))]).toEqual([]);
  });

  it('settles an open item: no longer open, still spent, not adopted, and the gate turns green', async () => {
    const { store, prd } = make();
    const ref = await store.writeItem({ prd, id: HIGH_ID, text: itemText(prd, HIGH_ID, 'high') }, null);
    const result = await store.settle(ref, AGREED);
    expect(result.ok && result.verdict).toBe('agreed');
    expect(await store.openItems(prd)).toEqual([]);
    expect([...(await store.spentIds(prd, null))]).toEqual([HIGH_ID]);
    expect(await store.adoptedEntries(prd)).toEqual([]);
    expect((await store.gate(prd, {})).ok).toBe(true);
  });

  it('refuses an ill-formed answer and leaves the item open', async () => {
    const { store, prd } = make();
    const ref = await store.writeItem({ prd, id: HIGH_ID, text: itemText(prd, HIGH_ID, 'high') }, null);
    const result = await store.settle(ref, { ...AGREED, approvedBy: '' });
    expect(result.ok).toBe(false);
    expect(await openIds(store, prd)).toEqual([HIGH_ID]);
  });

  it('writes an item into a folder outside the outbox: spent there, never open in the store', async () => {
    const { store, prd, scratch } = make();
    const out: OutFolder = { abs: scratch, shown: 'scratch' };
    const written = await store.writeItem({ prd, id: HIGH_ID, text: itemText(prd, HIGH_ID, 'high') }, out);
    expect(written).toBe(`scratch/${HIGH_ID}.md`);
    expect(existsSync(join(scratch, `${HIGH_ID}.md`))).toBe(true);
    expect(await store.openItems(prd)).toEqual([]);
    expect([...(await store.spentIds(prd, out))]).toEqual([HIGH_ID]);
    expect([...(await store.spentIds(prd, null))]).toEqual([]);
  });

  it('relays a folder of items into the outbox, and refuses what is not a folder', async () => {
    const { store, prd, scratch, laws } = make();
    writeFileSync(join(scratch, `${HIGH_ID}.md`), itemText(prd, HIGH_ID, 'high'));
    const relayed = await store.relay(prd, scratch, laws);
    expect(relayed?.refused).toEqual([]);
    expect(relayed?.moved.map((move) => move.from)).toEqual([join(scratch, `${HIGH_ID}.md`)]);
    expect(await openIds(store, prd)).toEqual([HIGH_ID]);
    expect(await store.relay(prd, join(scratch, 'missing'), laws)).toBeNull();
  });

  it('reads no reply where the pull request has no comment, and settles nothing', async () => {
    const { store, prd } = make();
    await store.writeItem({ prd, id: HIGH_ID, text: itemText(prd, HIGH_ID, 'high') }, null);
    const client = emptyPullRequest();
    const replies = await store.replies({ prd, pr: parsePr(7) }, client);
    expect(replies.settled).toEqual([]);
    expect(replies.failed).toEqual([]);
    expect(await openIds(store, prd)).toEqual([HIGH_ID]);
  });

  it.runIf(traits.comments)('writes the outbox comments from the open items', async () => {
    const { store, prd } = make();
    await store.writeItem({ prd, id: HIGH_ID, text: itemText(prd, HIGH_ID, 'high') }, null);
    const pr = emptyPullRequest();
    const onPr = await store.prComment(prd, pr);
    expect(onPr.action).toBe('created');
    expect(onPr.openCount).toBe(1);
    expect(pr.bodies.join('')).toContain('How long should we wait before giving up on a slow call?');
    const issue = emptyPullRequest();
    const onIssue = await store.issueComment({ prd, owner: 'acme', repo: 'widgets', branch: 'feat/a' }, issue);
    expect(onIssue.action).toBe('created');
    expect(onIssue.itemCount).toBe(1);
  });

  it.runIf(!traits.comments)('writes no outbox comment on GitHub, counting the open items it would hold', async () => {
    const { store, prd } = make();
    await store.writeItem({ prd, id: HIGH_ID, text: itemText(prd, HIGH_ID, 'high') }, null);
    const pr = emptyPullRequest();
    expect(await store.prComment(prd, pr)).toMatchObject({ action: 'skipped', id: null, openCount: 1, body: null });
    const issue = emptyPullRequest();
    expect(await store.issueComment({ prd, owner: 'acme', repo: 'widgets', branch: 'feat/a' }, issue)).toMatchObject({ action: 'skipped', id: null, itemCount: 1 });
    expect([...pr.bodies, ...issue.bodies]).toEqual([]);
  });

  it('writes no outbox comment where nothing is open and none was written before', async () => {
    const { store, prd } = make();
    const client = emptyPullRequest();
    expect((await store.issueComment({ prd, owner: 'acme', repo: 'widgets', branch: 'feat/a' }, client)).action).toBe('skipped');
    expect(client.bodies).toEqual([]);
  });
});
