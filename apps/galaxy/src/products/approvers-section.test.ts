import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { group } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { initialApproversForm, NOBODY_ASKED, NOT_OWNER, ONLY_ASKED, type Approvers } from './approvers';
import { APPROVERS_HINT, APPROVERS_READ_ONLY, APPROVERS_UNREADABLE, ApproversSection, NO_APPROVERS } from './approvers-section';

// A product's Approvers list as the server draws it (PRD 1322 s1, acceptance 1): headed Approvers, each
// listed member with their state; for a workspace owner, a state to pick and Remove on each, and a
// member to add; for any other member, the same list as text and a line saying only an owner edits it;
// the rule the list sets on approving; a refusal; and a list that could not be read.

const OWNED: Approvers = {
  owner: true,
  members: [{ id: 'u-irisa', name: 'Irisa', login: 'irisa' }, { id: 'u-paul', name: null, login: 'paul' }, { id: 'u-dev', name: 'Dev', login: 'dev' }],
  listed: [{ id: 'u-irisa', name: 'Irisa', login: 'irisa', state: 'asked' }, { id: 'u-dev', name: 'Dev', login: 'dev', state: 'skipped' }],
};

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const rows = (html: string) => [...html.matchAll(/<li class="approvers-row">([\s\S]*?)<\/li>/g)].map((m) => group(m, 1));
const selects = (html: string) => [...html.matchAll(/<select ([^>]*)>([\s\S]*?)<\/select>/g)].map((m) => ({
  label: /aria-label="([^"]*)"/.exec(group(m, 1))?.[1],
  options: [...group(m, 2).matchAll(/<option ([^>]*)>([^<]*)<\/option>/g)].map((o) => ({ value: /value="([^"]*)"/.exec(group(o, 1))?.[1], selected: group(o, 1).includes('selected'), text: o[2] })),
}));
const buttons = (html: string) => [...html.matchAll(/<button [^>]*>([^<]*)<\/button>/g)].map((m) => m[1]);

const draw = (approvers: Approvers | null, message: string | null = null) =>
  renderToStaticMarkup(createElement(ApproversSection, { form: approvers ? { ...initialApproversForm(approvers), message } : null }));

describe('the Approvers list, for a workspace owner', () => {
  it('lists each member with a state to pick and Remove, and offers the others to add', () => {
    const html = draw(OWNED);
    expect(/<h2[^>]*>([^<]*)<\/h2>/.exec(html)?.[1]).toBe('Approvers');
    expect(text(html)).toContain(APPROVERS_HINT);
    expect(rows(html).map((r) => text(r).split(' ')[0])).toEqual(['Irisa', 'Dev']);
    expect(selects(html)).toEqual([
      { label: 'Irisa', options: [{ value: 'asked', selected: true, text: 'Asked to approve' }, { value: 'skipped', selected: false, text: 'Skipped' }] },
      { label: 'Dev', options: [{ value: 'asked', selected: false, text: 'Asked to approve' }, { value: 'skipped', selected: true, text: 'Skipped' }] },
      { label: 'Member to add', options: [{ value: 'u-paul', selected: true, text: 'paul' }] },
    ]);
    expect(buttons(html)).toEqual(['Remove', 'Remove', 'Add']);
    expect(text(html)).toContain(ONLY_ASKED);
    expect(text(html)).not.toContain(APPROVERS_READ_ONLY);
  });

  it('offers nothing to add once every member is listed, and says the rule when nobody is asked', () => {
    const everyone: Approvers = { ...OWNED, listed: OWNED.members.map((m) => ({ ...m, state: 'skipped' as const })) };
    const html = draw(everyone);
    expect(selects(html).map((s) => s.label)).toEqual(['Irisa', 'paul', 'Dev']);
    expect(buttons(html)).toEqual(['Remove', 'Remove', 'Remove']);
    expect(text(html)).toContain(NOBODY_ASKED);
  });

  it('says why a change was refused', () => {
    expect(text(draw(OWNED, NOT_OWNER))).toContain(NOT_OWNER);
  });
});

describe('the Approvers list, for any other member', () => {
  it('reads the same list as text, with no control, and says only an owner edits it', () => {
    const html = draw({ ...OWNED, owner: false });
    expect(rows(html).map(text)).toEqual(['Irisa Asked to approve', 'Dev Skipped']);
    expect(selects(html)).toEqual([]);
    expect(buttons(html)).toEqual([]);
    expect(text(html)).toContain(APPROVERS_READ_ONLY);
  });

  it('says nobody is listed yet', () => {
    expect(text(draw({ ...OWNED, owner: false, listed: [] }))).toContain(NO_APPROVERS);
  });
});

it('says the list could not be read', () => {
  expect(text(draw(null))).toContain(APPROVERS_UNREADABLE);
});
