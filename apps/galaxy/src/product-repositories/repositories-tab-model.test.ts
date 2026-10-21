import { describe, expect, it } from 'vitest';
import type { Link } from './repositories-tab.contract';
import { demoTabPort, draftOf, initialLinksForm, initialPlanForm, ladderHolds, linksReducer, newLinkWrite, planReducer, roleFlag, writeOf } from './repositories-tab-model';

// The Repositories & approvers tab's links as pure data (PRD 1364 s11): the list through its actions, a
// draft and the write it sends, the plan repository through its actions and what holds it on the ladder,
// and the demo's port, which keeps the database's rules in memory.

const SHA = '3f2a9c1e0b7d4c5a8e6f1d2c3b4a5968778695a4';
const link = (repo: string, over: Partial<Link> = {}): Link => ({ repo, role: null, knowledge: 'own', readAt: null, readOnly: false, consumes: [], addedBy: 'person', ladderStep: 1, ...over });

describe('the list', () => {
  const start = () => initialLinksForm({ links: [link('acme/web'), link('acme/api')], addable: ['acme/zed', 'acme/billing'] });

  it('starts sorted, idle', () => {
    expect(start()).toEqual({ links: [link('acme/api'), link('acme/web')], addable: ['acme/billing', 'acme/zed'], busy: false, message: null });
  });

  it('puts a saved link in its place and takes it off what can be added', () => {
    const added = linksReducer(linksReducer(start(), { type: 'busy' }), { type: 'saved', link: link('acme/billing') });
    expect(added).toEqual({ links: [link('acme/api'), link('acme/billing'), link('acme/web')], addable: ['acme/zed'], busy: false, message: null });
    expect(linksReducer(added, { type: 'saved', link: link('acme/api', { role: 'api' }) }).links[0]).toEqual(link('acme/api', { role: 'api' }));
  });

  it('gives a removed link back to what can be added', () => {
    expect(linksReducer(start(), { type: 'removed', repo: 'acme/web' })).toMatchObject({ links: [link('acme/api')], addable: ['acme/billing', 'acme/web', 'acme/zed'] });
    expect(linksReducer(start(), { type: 'removed', repo: 'acme/none' }).addable).toEqual(['acme/billing', 'acme/zed']);
  });

  it('keeps a refusal until the next call', () => {
    const refused = linksReducer(linksReducer(start(), { type: 'busy' }), { type: 'refused', message: 'no' });
    expect(refused).toMatchObject({ busy: false, message: 'no' });
    expect(linksReducer(refused, { type: 'busy' })).toMatchObject({ busy: true, message: null });
  });
});

describe('a draft', () => {
  it('sends every field, empty text as none, a read-at only for an imported base, consumes sorted', () => {
    const draft = draftOf(link('acme/web', { role: 'web', knowledge: 'imported', readAt: SHA, consumes: ['acme/b', 'acme/a'] }));
    expect(writeOf('acme/web', draft)).toEqual({ repo: 'acme/web', role: 'web', knowledge: 'imported', readAt: SHA, readOnly: false, consumes: ['acme/a', 'acme/b'] });
    expect(writeOf('acme/web', { ...draft, role: '  ', knowledge: 'own' })).toMatchObject({ role: null, readAt: null });
    expect(writeOf('acme/web', { ...draft, readAt: ' ' })).toMatchObject({ readAt: null });
  });

  it('adds a new repository with no role, its own knowledge, consuming nothing', () => {
    expect(newLinkWrite('acme/web')).toEqual({ repo: 'acme/web', role: null, knowledge: 'own', readAt: null, readOnly: false, consumes: [] });
  });
});

describe('the plan repository', () => {
  const PLAN = { repository: 'acme/plan', holds: [] };

  it('starts as the tab read it, idle, then keeps what was saved, or a refusal until the next call', () => {
    expect(initialPlanForm(null)).toEqual({ plan: null, busy: false, message: null });
    const busy = planReducer(initialPlanForm(null), { type: 'busy' });
    expect(busy).toEqual({ plan: null, busy: true, message: null });
    expect(planReducer(busy, { type: 'saved', plan: PLAN })).toEqual({ plan: PLAN, busy: false, message: null });
    const refused = planReducer(planReducer(initialPlanForm(PLAN), { type: 'busy' }), { type: 'refused', message: 'no' });
    expect(refused).toEqual({ plan: PLAN, busy: false, message: 'no' });
    expect(planReducer(refused, { type: 'busy' })).toMatchObject({ busy: true, message: null });
    expect(planReducer(refused, { type: 'saved', plan: null })).toEqual({ plan: null, busy: false, message: null });
  });

  it('is held by each repository below step 5, by its short name, never by itself', () => {
    const links = [link('acme/api', { ladderStep: 5 }), link('acme/web', { ladderStep: 3 }), link('acme/plan', { ladderStep: 1 })];
    expect(ladderHolds(links, 'acme/plan')).toEqual([{ name: 'web', why: 'step 3' }]);
    expect(ladderHolds(links, 'acme/other')).toEqual([{ name: 'web', why: 'step 3' }, { name: 'plan', why: 'step 1' }]);
  });
});

describe('the demo\'s port', () => {
  it('keeps the database\'s rules on a link', async () => {
    const port = demoTabPort([link('acme/api', { addedBy: 'prd' })], []);
    expect(await port.saveLink({ ...newLinkWrite('acme/web'), role: 'Web App' })).toEqual({ ok: false, message: 'Role: Web App is not a role: api, web, mobile, ui, library, infra, plan, doc or monorepo.' });
    expect(await port.saveLink({ ...newLinkWrite('acme/web'), role: 'back-end' })).toMatchObject({ ok: false, message: expect.stringContaining('Role: back-end is not a role') as unknown });
    expect(await port.saveLink({ ...newLinkWrite('acme/web'), knowledge: 'imported' })).toEqual({ ok: false, message: 'Read at: an imported knowledge base names the commit it was read at.' });
    expect(await port.saveLink({ ...newLinkWrite('acme/web'), readAt: 'abc' })).toMatchObject({ ok: false, message: 'Read at: abc is not a 40-hex commit.' });
    expect(await port.saveLink({ ...newLinkWrite('acme/web'), consumes: ['acme/web'] })).toMatchObject({ ok: false, message: 'Consumes: acme/web cannot consume itself.' });
    expect(await port.saveLink({ ...newLinkWrite('acme/web'), consumes: ['acme/zed'] })).toMatchObject({ ok: false, message: 'Consumes: acme/zed is not in this product.' });
    expect(await port.saveLink({ ...newLinkWrite('Acme/Web'), consumes: ['acme/api'] })).toEqual({ ok: true, link: link('acme/web', { consumes: ['acme/api'] }) });
    expect(await port.saveLink({ ...newLinkWrite('acme/api'), role: 'api' })).toEqual({ ok: true, link: link('acme/api', { role: 'api', addedBy: 'prd' }) });
  });

  it('keeps a link\'s own old role editable, and flags it until it is one of the nine', async () => {
    const port = demoTabPort([link('acme/api', { role: 'back-end' })], []);
    expect(roleFlag('back-end')).toBe('back-end is not a role: pick one');
    expect(roleFlag('api')).toBeNull();
    expect(roleFlag(null)).toBeNull();
    expect(await port.saveLink({ ...newLinkWrite('acme/api'), role: 'back-end', knowledge: 'none' })).toMatchObject({ ok: true });
    expect(await port.saveLink({ ...newLinkWrite('acme/api'), role: 'other-old' })).toMatchObject({ ok: false });
    expect(await port.saveLink({ ...newLinkWrite('acme/api'), role: 'library' })).toMatchObject({ ok: true });
  });

  it('refuses to remove a repository another consumes, then removes it once it is free', async () => {
    const port = demoTabPort([link('acme/api'), link('acme/web', { consumes: ['acme/api'] })], []);
    expect(await port.removeLink('acme/api')).toEqual({ ok: false, message: 'Consumes: acme/web consumes acme/api; take it out of its consumes first.' });
    expect(await port.removeLink('acme/web')).toEqual({ ok: true, repo: 'acme/web' });
    expect(await port.removeLink('acme/api')).toEqual({ ok: true, repo: 'acme/api' });
    expect(await port.setApprover('u-1', 'skipped')).toEqual({ ok: true, state: 'skipped' });
    expect(await port.removeApprover('u-1')).toEqual({ ok: true });
  });
});

describe('the demo\'s plan repository', () => {
  it('names one of the workspace\'s repositories in lower case, held by the ladder, or none', async () => {
    const port = demoTabPort([link('acme/api', { ladderStep: 5 }), link('acme/web', { ladderStep: 2 })], ['acme/api', 'acme/plan', 'acme/web']);
    expect(await port.setPlan('Acme/Plan')).toEqual({ ok: true, plan: { repository: 'acme/plan', holds: [{ name: 'web', why: 'step 2' }] } });
    expect(await port.setPlan(null)).toEqual({ ok: true, plan: null });
  });

  it('refuses a repository the workspace does not list, in the database\'s words', async () => {
    expect(await demoTabPort([], ['acme/api']).setPlan('acme/gone')).toEqual({ ok: false, message: 'Repository: acme/gone is not one of this workspace\'s repositories.' });
  });
});
