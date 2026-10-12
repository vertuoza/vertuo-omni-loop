import { describe, expect, it } from 'vitest';
import type { Link } from './repositories-tab.contract';
import { demoTabPort, draftOf, initialLinksForm, linksReducer, newLinkWrite, writeOf } from './repositories-tab-model';

// The Repositories & approvers tab's links as pure data (PRD 1364 s11): the list through its actions, a
// draft and the write it sends, and the demo's port, which keeps the database's rules in memory.

const SHA = '3f2a9c1e0b7d4c5a8e6f1d2c3b4a5968778695a4';
const link = (repo: string, over: Partial<Link> = {}): Link => ({ repo, role: null, knowledge: 'own', readAt: null, readOnly: false, consumes: [], addedBy: 'person', ...over });

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

describe('the demo\'s port', () => {
  it('keeps the database\'s rules on a link', async () => {
    const port = demoTabPort([link('acme/api', { addedBy: 'prd' })]);
    expect(await port.saveLink({ ...newLinkWrite('acme/web'), role: 'Web App' })).toEqual({ ok: false, message: 'Role: Web App is not one kebab-case word.' });
    expect(await port.saveLink({ ...newLinkWrite('acme/web'), knowledge: 'imported' })).toEqual({ ok: false, message: 'Read at: an imported knowledge base names the commit it was read at.' });
    expect(await port.saveLink({ ...newLinkWrite('acme/web'), readAt: 'abc' })).toMatchObject({ ok: false, message: 'Read at: abc is not a 40-hex commit.' });
    expect(await port.saveLink({ ...newLinkWrite('acme/web'), consumes: ['acme/web'] })).toMatchObject({ ok: false, message: 'Consumes: acme/web cannot consume itself.' });
    expect(await port.saveLink({ ...newLinkWrite('acme/web'), consumes: ['acme/zed'] })).toMatchObject({ ok: false, message: 'Consumes: acme/zed is not in this product.' });
    expect(await port.saveLink({ ...newLinkWrite('Acme/Web'), consumes: ['acme/api'] })).toEqual({ ok: true, link: link('acme/web', { consumes: ['acme/api'] }) });
    expect(await port.saveLink({ ...newLinkWrite('acme/api'), role: 'api' })).toEqual({ ok: true, link: link('acme/api', { role: 'api', addedBy: 'prd' }) });
  });

  it('refuses to remove a repository another consumes, then removes it once it is free', async () => {
    const port = demoTabPort([link('acme/api'), link('acme/web', { consumes: ['acme/api'] })]);
    expect(await port.removeLink('acme/api')).toEqual({ ok: false, message: 'Consumes: acme/web consumes acme/api; take it out of its consumes first.' });
    expect(await port.removeLink('acme/web')).toEqual({ ok: true, repo: 'acme/web' });
    expect(await port.removeLink('acme/api')).toEqual({ ok: true, repo: 'acme/api' });
    expect(await port.setApprover('u-1', 'skipped')).toEqual({ ok: true, state: 'skipped' });
    expect(await port.removeApprover('u-1')).toEqual({ ok: true });
  });
});
