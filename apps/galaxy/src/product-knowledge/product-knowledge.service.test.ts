import { describe, expect, it } from 'vitest';
import type { KnowledgeRead, KnowledgeWrite } from './product-knowledge.contract';
import type { KnowledgeRepository } from './product-knowledge.repository';
import { knowledgeService } from './product-knowledge.service';

// The Knowledge tab's rules (PRD 1795 s2), against a fake repository: who changes an entry directly (the
// kind's owner or delegate) and who may only propose, who decides a proposal, how each refusal reads.

const WORKSPACE = 'w-1';
const PRODUCT = '22222222-2222-4222-8222-222222222221';
const ENTRY = '33333333-3333-4333-8333-333333333331';
const PROPOSAL = '44444444-4444-4444-8444-444444444441';

const section = (decides: boolean) => ({ owner: null, delegate: null, decides, entries: [], proposals: [] });
const read = (over: Partial<KnowledgeRead> = {}): KnowledgeRead => ({
  product: { id: PRODUCT, name: 'Widgets' }, canName: false, latestEventId: null, legal: section(false), glossary: section(false), ...over,
});

function fake(over: Partial<KnowledgeRepository> = {}) {
  const calls: string[] = [];
  const store: KnowledgeRepository = {
    product: () => Promise.resolve({ id: PRODUCT, workspace_id: WORKSPACE, name: 'Widgets' }),
    read: () => Promise.resolve({ ok: true, read: read() }),
    roster: () => Promise.resolve([{ user_id: 'u-1', name: 'Anna', github_login: 'anna', avatar_url: null, fleet: null }]),
    apply: (_w, _p, change) => { calls.push(`apply ${change.kind} ${change.action}`); return Promise.resolve({ ok: true }); },
    propose: (_w, _p, change) => { calls.push(`propose ${change.kind} ${change.action}`); return Promise.resolve({ ok: true }); },
    decide: (_w, proposal, verdict) => { calls.push(`${verdict} ${proposal}`); return Promise.resolve({ ok: true }); },
    name: (_w, _p, kind, role, user) => { calls.push(`name ${kind} ${role} ${user ?? 'nobody'}`); return Promise.resolve({ ok: true }); },
    ...over,
  };
  return { service: knowledgeService(store), calls };
}

const legalAdd: KnowledgeWrite = { op: 'change', kind: 'legal', action: 'add', fields: { code: 'INVOICING', statement: 'No gaps.', source: 'VAT art. 53' } };
const termRemove: KnowledgeWrite = { op: 'change', kind: 'glossary', action: 'remove', entry: ENTRY, fields: {} };

describe('a change', () => {
  it('is made directly by the kind\'s owner or delegate', async () => {
    const { service, calls } = fake({ read: () => Promise.resolve({ ok: true, read: read({ legal: section(true) }) }) });
    expect(await service.change(PRODUCT, legalAdd)).toEqual({ ok: true, value: { done: 'applied' } });
    expect(calls).toEqual(['apply legal add']);
  });

  it('is only proposed by another member', async () => {
    const { service, calls } = fake();
    expect(await service.change(PRODUCT, legalAdd)).toEqual({ ok: true, value: { done: 'proposed' } });
    expect(await service.change(PRODUCT, termRemove)).toEqual({ ok: true, value: { done: 'proposed' } });
    expect(calls).toEqual(['propose legal add', 'propose glossary remove']);
  });

  it('decides per kind: the Glossary\'s owner does not decide Legal', async () => {
    const { service, calls } = fake({ read: () => Promise.resolve({ ok: true, read: read({ glossary: section(true) }) }) });
    await service.change(PRODUCT, termRemove);
    await service.change(PRODUCT, legalAdd);
    expect(calls).toEqual(['apply glossary remove', 'propose legal add']);
  });

  it('is none for a product the reader does not read', async () => {
    const { service } = fake({ product: () => Promise.resolve(null) });
    expect(await service.change(PRODUCT, legalAdd)).toMatchObject({ ok: false, kind: 'missing' });
  });

  it('keeps the database\'s words, its refusal by kind', async () => {
    const refuse = (code: string | null) => fake({ apply: () => Promise.resolve({ ok: false, code, message: 'Statement: one line.' }), read: () => Promise.resolve({ ok: true, read: read({ legal: section(true) }) }) }).service.change(PRODUCT, legalAdd);
    expect(await refuse('22023')).toEqual({ ok: false, kind: 'refused', error: 'Statement: one line.' });
    expect(await refuse('42501')).toMatchObject({ ok: false, kind: 'not-allowed' });
    expect(await refuse('P0002')).toMatchObject({ ok: false, kind: 'missing' });
    expect(await refuse(null)).toEqual({ ok: false, kind: 'database', error: 'Statement: one line.' });
  });

  it('is not allowed for a reader who is no member', async () => {
    const { service, calls } = fake({ read: () => Promise.resolve({ ok: false, code: '42501', message: '' }) });
    expect(await service.change(PRODUCT, legalAdd)).toMatchObject({ ok: false, kind: 'not-allowed' });
    expect(calls).toEqual([]);
  });
});

describe('a decision', () => {
  it('approves or rejects an open proposal', async () => {
    const { service, calls } = fake();
    expect(await service.change(PRODUCT, { op: 'decide', proposal: PROPOSAL, verdict: 'approve' })).toEqual({ ok: true, value: { done: 'approved' } });
    expect(await service.change(PRODUCT, { op: 'decide', proposal: PROPOSAL, verdict: 'reject' })).toEqual({ ok: true, value: { done: 'rejected' } });
    expect(calls).toEqual([`approve ${PROPOSAL}`, `reject ${PROPOSAL}`]);
  });

  it('is refused to anyone who does not decide the kind', async () => {
    const { service } = fake({ decide: () => Promise.resolve({ ok: false, code: '42501', message: 'Only the owner decides.' }) });
    expect(await service.change(PRODUCT, { op: 'decide', proposal: PROPOSAL, verdict: 'approve' })).toEqual({ ok: false, kind: 'not-allowed', error: 'Only the owner decides.' });
  });
});

describe('a naming', () => {
  it('names an owner, or clears a delegate', async () => {
    const { service, calls } = fake();
    expect(await service.change(PRODUCT, { op: 'name', kind: 'legal', role: 'owner', user: ENTRY })).toEqual({ ok: true, value: { done: 'named' } });
    await service.change(PRODUCT, { op: 'name', kind: 'glossary', role: 'delegate', user: null });
    expect(calls).toEqual([`name legal owner ${ENTRY}`, 'name glossary delegate nobody']);
  });

  it('is refused to anyone but a workspace owner', async () => {
    const { service } = fake({ name: () => Promise.resolve({ ok: false, code: '42501', message: 'Only an owner names.' }) });
    expect(await service.change(PRODUCT, { op: 'name', kind: 'legal', role: 'owner', user: null })).toMatchObject({ ok: false, kind: 'not-allowed' });
  });
});

describe('the tab', () => {
  it('lists the members only to a workspace owner', async () => {
    const owner = fake({ read: () => Promise.resolve({ ok: true, read: read({ canName: true }) }) });
    expect(await owner.service.tab(WORKSPACE, PRODUCT)).toMatchObject({ canName: true, members: [{ id: 'u-1', login: 'anna' }] });
    expect(await fake().service.tab(WORKSPACE, PRODUCT)).toMatchObject({ canName: false, members: [] });
  });

  it('shows who added each entry and when, and nobody for an entry whose author is gone (PRD 2240 s1)', async () => {
    const owen = { user: 'u-owen', login: 'owen' };
    const dates = { createdAt: '2026-01-05T09:00:00+00:00', updatedAt: '2026-02-07T10:30:00+00:00' };
    const legal = { entry: 'l-1', id: 'L-VAT-1', code: 'VAT', number: 1, statement: 's', source: 'u', owner: null, retiredAt: null, createdBy: owen, ...dates };
    const term = { entry: 'g-1', term: 'Quote', meaning: 'm', avoid: [], removedAt: null, createdBy: null, ...dates };
    const { service } = fake({ read: () => Promise.resolve({ ok: true, read: read({ legal: { ...section(false), entries: [legal] }, glossary: { ...section(false), entries: [term] } }) }) });
    const tab = await service.tab(WORKSPACE, PRODUCT);
    expect(tab?.legal.entries).toEqual([legal]);
    expect(tab?.glossary.entries).toEqual([term]);
  });

  it('is none for another workspace\'s product, or a reader who is no member', async () => {
    expect(await fake().service.tab('w-2', PRODUCT)).toBeNull();
    expect(await fake({ read: () => Promise.resolve({ ok: false, code: '42501', message: '' }) }).service.tab(WORKSPACE, PRODUCT)).toBeNull();
    expect(await fake({ product: () => Promise.resolve(null) }).service.tab(WORKSPACE, PRODUCT)).toBeNull();
  });

  it('throws when the read fails otherwise', async () => {
    const { service } = fake({ read: () => Promise.resolve({ ok: false, code: '57014', message: 'timeout' }) });
    await expect(service.tab(WORKSPACE, PRODUCT)).rejects.toThrow('timeout');
  });
});
