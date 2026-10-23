import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NO_SETTINGS_REPOSITORY, SOURCE_LABEL, pageBody, pageTitle } from './PlaybookView';
import { PLAYBOOK_PATH, PlaybookScreen, type PlaybookScreenView } from './PlaybookScreen';

// Settings → Playbook as the server renders it (PRD 2417, s6): every page with its text and whose it
// is, a workspace with no settings repository and the one thing to do, the situations before the
// list, and the stylesheet holding to the reading surface's rules.

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const render = (view: PlaybookScreenView) => renderToStaticMarkup(createElement(PlaybookScreen, { view }));
const COMMIT = '3f2a9c1e0b7d4c5a8e6f1d2c3b4a5968778695a4';
const FILLED: PlaybookScreenView = {
  kind: 'playbook',
  repository: 'acme/plans',
  commit: COMMIT,
  reason: null,
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
    const html = render({ kind: 'playbook', repository: null, commit: null, reason: 'This workspace has no settings repository: no plan repository is named.', pages: [] });
    expect(text(html)).toContain('No settings repository yet');
    expect(text(html)).toContain(NO_SETTINGS_REPOSITORY);
    expect(html).not.toContain('data-form=');
  });

  it('says why a settings repository with no page of its own lists the kit\'s', () => {
    const html = render({
      kind: 'playbook', repository: 'acme/plans', commit: COMMIT, reason: 'acme/plans holds no settings playbook page yet.',
      pages: [{ form: 'review', source: 'kit', text: '# Review' }],
    });
    expect(text(html)).toContain('acme/plans holds no settings playbook page yet.');
    expect(pageOf(html, 'review')).toContain('data-source="kit"');
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
