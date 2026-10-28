import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PlaybookEditing } from './omni-settings.client';
import { NO_SETTINGS_REPOSITORY, NO_SETTINGS_REPOSITORY_MEMBER, SOURCE_LABEL, pageBody, pageTitle } from './PlaybookView';
import { SettingsRepositoryLine } from './SettingsRepositoryLine';
import { PLAYBOOK_PATH, PlaybookScreen, playbookScreenOf, type PlaybookScreenView } from './PlaybookScreen';

// Settings → Playbook as the server renders it (PRD 2417, s6): every page with its text and whose it
// is, a workspace with no settings repository and the one thing to do, the situations before the
// list, and the stylesheet holding to the reading surface's rules.

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const render = (view: PlaybookScreenView) => renderToStaticMarkup(createElement(PlaybookScreen, { view }));
const COMMIT = '3f2a9c1e0b7d4c5a8e6f1d2c3b4a5968778695a4';
const CHOSEN = { chosen: 'acme/plans', plan: null, listed: ['acme/plans'] };
const NONE = { chosen: null, plan: null, listed: ['acme/app', 'acme/plans'] };
const FILLED: PlaybookScreenView = {
  kind: 'playbook',
  repository: 'acme/plans',
  commit: COMMIT,
  reason: null,
  choice: { chosen: 'acme/plans', plan: null, listed: ['acme/plans'] },
  pages: [
    { form: 'review', source: 'settings', text: '---\nform: review\nowner: null\n---\n\n# Review\n\nFix, push back or ask.' },
    { form: 'definition-of-done', source: 'kit', text: '# Definition of done\n\nTested and reviewed.' },
  ],
};
const pageOf = (html: string, form: string) => {
  const from = html.indexOf(`data-form="${form}"`);
  return from < 0 ? '' : html.slice(from, html.indexOf('</li>', from));
};

describe('the playbook page', () => {
  it('is headed Playbook, names the repository and commit it was read from, and sits among the Settings tabs', () => {
    const html = render(FILLED);
    expect(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1]).toBe('Playbook');
    expect(text(html)).toContain('Read from acme/plans at 3f2a9c1');
    expect(html).toContain('href="https://github.com/acme/plans"');
    expect(html).toMatch(new RegExp(`href="${PLAYBOOK_PATH}"[^>]*aria-current="page"|aria-current="page"[^>]*href="${PLAYBOOK_PATH}"`));
    expect(text(html)).toContain('Fleets Repositories Business API keys Jev Playbook');
  });

  it('lists each page with its text, and whether it is the settings repository\'s own or the kit\'s first default', () => {
    const html = render(FILLED);
    const own = pageOf(html, 'review');
    expect(text(own)).toContain('Review');
    expect(text(own)).toContain(SOURCE_LABEL.settings);
    expect(text(own)).toContain('Fix, push back or ask.');
    expect(own).toContain('data-source="settings"');
    const kit = pageOf(html, 'definition-of-done');
    expect(text(kit)).toContain('Definition of done');
    expect(text(kit)).toContain(SOURCE_LABEL.kit);
    expect(text(kit)).toContain('Tested and reviewed.');
    expect(kit).toContain('data-source="kit"');
  });

  it('shows a page\'s text without its front matter', () => {
    expect(text(pageOf(render(FILLED), 'review'))).not.toContain('owner: null');
    expect(pageBody('---\nform: x\n---\n\n# X\n')).toBe('# X');
    expect(pageBody('# No front matter')).toBe('# No front matter');
  });

  it('names a page as words', () => {
    expect(pageTitle('definition-of-done')).toBe('Definition of done');
    expect(pageTitle('review')).toBe('Review');
  });

  it('says a workspace with no settings repository has none, with the one thing to do', () => {
    const html = render({ kind: 'playbook', repository: null, commit: null, reason: 'This workspace has no settings repository: no plan repository is named.', pages: [], choice: NONE });
    expect(text(html)).toContain('No settings repository yet');
    expect(text(html)).toContain(NO_SETTINGS_REPOSITORY_MEMBER);
    expect(NO_SETTINGS_REPOSITORY).toBe('Choose the repository that holds the playbook.');
    expect(html).not.toContain('data-form=');
  });

  it('says why a settings repository with no page of its own lists the kit\'s', () => {
    const html = render({
      kind: 'playbook', repository: 'acme/plans', commit: COMMIT, reason: 'acme/plans holds no settings playbook page yet.', choice: CHOSEN,
      pages: [{ form: 'review', source: 'kit', text: '# Review' }],
    });
    expect(text(html)).toContain('acme/plans holds no settings playbook page yet.');
    expect(pageOf(html, 'review')).toContain('data-source="kit"');
  });

  it('shows each page\'s edit to a workspace owner only (s7)', () => {
    const owner = render({ ...FILLED, editing: { kind: 'database', workspace: 'w-acme' } });
    expect(pageOf(owner, 'review')).toContain('Propose a change');
    expect(pageOf(owner, 'definition-of-done')).toContain('aria-label="Propose a change to Definition of done"');
    expect(text(pageOf(owner, 'review'))).toContain('Fix, push back or ask.');
    expect(text(render({ ...FILLED, editing: { kind: 'demo' } }))).toContain('Propose a change');
    for (const member of [render(FILLED), render({ ...FILLED, editing: null })]) {
      expect(member).not.toContain('Propose a change');
      expect(member).not.toContain('omni-settings-edit');
    }
  });

  it('gives the screen an owner\'s edit from what the page loaded, and a member none', () => {
    const loaded = { kind: 'playbook' as const, workspace: { id: 'w-acme', name: 'Acme' }, repository: 'acme/plans', commit: COMMIT, reason: null, pages: [], choice: CHOSEN };
    expect(playbookScreenOf({ ...loaded, owner: true })).toEqual({
      kind: 'playbook', repository: 'acme/plans', commit: COMMIT, reason: null, pages: [], choice: CHOSEN, editing: { kind: 'database', workspace: 'w-acme' },
    });
    expect(playbookScreenOf({ ...loaded, owner: false })).toMatchObject({ kind: 'playbook', editing: null });
    expect(playbookScreenOf({ kind: 'unreadable' })).toEqual({ kind: 'unreadable' });
  });

  it('shows no edit where there is no settings repository to open a pull request in', () => {
    const html = render({ kind: 'playbook', editing: { kind: 'database', workspace: 'w-acme' }, repository: null, commit: null, reason: 'none', pages: [], choice: NONE });
    expect(html).not.toContain('Propose a change');
  });

  it('says the situation when there is no playbook to show', () => {
    expect(text(render({ kind: 'closed' }))).toContain('The playbook is not open here');
    expect(text(render({ kind: 'sign-in' }))).toContain('Sign in to see your playbook');
    expect(text(render({ kind: 'no-workspace' }))).toContain('Your account is not in a workspace');
    const failed = render({ kind: 'unreadable' });
    expect(text(failed)).toContain('Couldn’t load your playbook');
    expect(failed).toContain('role="alert"');
  });
});

describe('the Settings repository line (PRD 2543, s3)', () => {
  const OWNER = { kind: 'database' as const, workspace: 'w-acme' };
  const LISTED = ['acme/app', 'acme/plans', 'acme/playbook'];
  const view = (choice: { chosen: string | null; plan: string | null; listed?: string[] }, editing: PlaybookEditing | null = null): PlaybookScreenView => ({
    kind: 'playbook', repository: choice.chosen ?? choice.plan, commit: null, reason: null, pages: [], editing,
    choice: { chosen: choice.chosen, plan: choice.plan, listed: choice.listed ?? LISTED },
  });
  const head = (html: string) => html.slice(html.indexOf('omni-settings-head'), html.indexOf('</section>', html.indexOf('omni-settings-head')));

  it('shortens the head card\'s sentence', () => {
    expect(text(head(render(view({ chosen: 'acme/plans', plan: null }))))).toContain('Playbook The pages every repository’s agents read.');
  });

  it('chosen: names the repository, with Change for the owner and nothing for a member', () => {
    const owner = head(render(view({ chosen: 'acme/plans', plan: 'acme/app' }, OWNER)));
    expect(text(owner)).toContain('Settings repository: acme/plans');
    expect(text(owner)).toContain('Change');
    expect(owner).not.toContain('Keep it as the settings repository');
    expect(owner).not.toContain('<select');
    const member = head(render(view({ chosen: 'acme/plans', plan: 'acme/app' })));
    expect(text(member)).toContain('Settings repository: acme/plans');
    expect(member).not.toContain('<button');
  });

  it('plan repository by default: the badge, with Keep it and Choose another for the owner, the badge only for a member', () => {
    const owner = text(head(render(view({ chosen: null, plan: 'acme/plans' }, OWNER))));
    expect(owner).toContain('Using the plan repository acme/plans by default');
    expect(owner).toContain('Keep it as the settings repository');
    expect(owner).toContain('Choose another');
    const member = head(render(view({ chosen: null, plan: 'acme/plans' })));
    expect(text(member)).toContain('Using the plan repository acme/plans by default');
    expect(member).not.toContain('<button');
  });

  it('offers Keep it only when the plan repository is one the workspace lists', () => {
    const unlisted = text(head(render(view({ chosen: null, plan: 'acme/elsewhere' }, OWNER))));
    expect(unlisted).toContain('Using the plan repository acme/elsewhere by default');
    expect(unlisted).not.toContain('Keep it as the settings repository');
    expect(unlisted).toContain('Choose another');
  });

  it('none: the owner gets the picker in the card, a member is told the owner chooses', () => {
    const owner = render(view({ chosen: null, plan: null }, OWNER));
    expect(text(owner)).toContain('No settings repository yet Choose the repository that holds the playbook.');
    expect(owner).toContain('<select');
    expect(owner).not.toContain('Name a plan repository');
    const member = render(view({ chosen: null, plan: null }));
    expect(text(member)).toContain('No settings repository yet The workspace’s owner chooses it.');
    expect(member).not.toContain('<select');
    expect(member).not.toContain('<button');
  });

  it('lists exactly the workspace\'s listed repositories in the picker, with Clear the choice only when one is chosen', () => {
    const none = render(view({ chosen: null, plan: null }, OWNER));
    expect([...none.matchAll(/<option[^>]*value="([^"]+)"/g)].map((match) => match[1])).toEqual(LISTED);
    expect(text(none)).toContain('Save');
    expect(text(none)).not.toContain('Clear the choice');
    expect(text(none)).not.toContain('Cancel');
  });

  it('opens the picker on the repository chosen, with Save, Cancel and Clear the choice', () => {
    const choice = { chosen: 'acme/plans', plan: 'acme/app', listed: LISTED };
    const html = renderToStaticMarkup(createElement(SettingsRepositoryLine, { choice, editing: OWNER, picker: true }));
    expect(html).toMatch(/<option[^>]*value="acme\/plans"[^>]*selected|<option[^>]*selected[^>]*value="acme\/plans"/);
    expect([...html.matchAll(/<option[^>]*value="([^"]+)"/g)].map((match) => match[1])).toEqual(LISTED);
    expect(text(html)).toContain('Save Cancel Clear the choice');
    const unchosen = renderToStaticMarkup(createElement(SettingsRepositoryLine, { choice: { ...choice, chosen: null }, editing: OWNER, picker: true }));
    expect(text(unchosen)).toContain('Save Cancel');
    expect(text(unchosen)).not.toContain('Clear the choice');
  });

  it('shows a member no picker even when asked for one', () => {
    const html = renderToStaticMarkup(createElement(SettingsRepositoryLine, { choice: { chosen: 'acme/plans', plan: null, listed: LISTED }, editing: null, picker: true }));
    expect(html).not.toContain('<select');
    expect(html).not.toContain('<button');
  });

  it('says nothing of a settings repository line where there is no repository to name', () => {
    expect(head(render(view({ chosen: null, plan: null }, OWNER)))).not.toContain('Settings repository');
  });
});

describe('the playbook stylesheet', () => {
  const css = readFileSync(fileURLToPath(new URL('./omni-settings.css', import.meta.url)), 'utf8');

  it('names no colour of its own: every colour is a token', () => {
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });

  it('lets the text wrap, so a long line never scrolls the page', () => {
    expect(css).toContain('white-space: pre-wrap');
    expect(css).toContain('overflow-wrap: anywhere');
  });
});
