// PRD 1550, s3: the gallery page of the screen library — one self-contained HTML page, locked
// screens first, then drafts, then superseded, each with its mockup inline or `no mockup`.
import { describe, expect, it } from 'vitest';
import type { Screen } from '../screens.ts';
import { galleryOrder, galleryPage } from './page.ts';

function screen(name: string, fields: Partial<Screen> = {}): Screen {
  return {
    file: `${name}.md`, screen: name, status: 'draft', lockedBy: null, lockedOn: null, quote: null, mock: null,
    implements: [], reads: [], routes: [], supersedes: null, amendments: [], sections: {}, ...fields,
  };
}

const LOCKED = screen('quote-editor', { status: 'locked', lockedBy: '@ana', lockedOn: '2026-10-10', quote: 'build it', mock: 'editor.html', routes: ['/quotes/:id'] });
const DRAFT = screen('a-draft', { mock: 'draft.html', routes: ['/', '/home'] });
const BARE = screen('b-bare');
const OLD = screen('old-editor', { status: 'superseded' });

const MOCKS: Readonly<Record<string, string>> = {
  'editor.html': '<main data-screen="quote-editor"><button data-primary>Send & close</button></main>',
  'draft.html': '<p>"draft" <b>body</b></p>',
};
const read = (mock: string) => MOCKS[mock] ?? null;

describe('galleryOrder', () => {
  it('puts locked screens first, then drafts, then superseded, keeping the library order within each', () => {
    expect(galleryOrder([OLD, DRAFT, LOCKED, BARE]).map((s) => s.screen)).toEqual(['quote-editor', 'a-draft', 'b-bare', 'old-editor']);
  });
});

describe('galleryPage', () => {
  const page = galleryPage({ screens: [DRAFT, BARE, OLD, LOCKED], problems: ['broken.md: no front matter'] }, read);

  it('lists every screen in gallery order with its status, its lock and its routes', () => {
    const order = ['quote-editor', 'a-draft', 'b-bare', 'old-editor'].map((name) => page.indexOf(`<h2>${name}</h2>`));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(page).toContain('locked by @ana on 2026-10-10');
    expect(page).toContain('/quotes/:id');
    expect(page).toContain('/, /home');
    expect(page).toContain('superseded');
  });

  it('inlines each mockup, escaped, in a sandboxed frame, and says no mockup where there is none', () => {
    expect(page).toContain('srcdoc="&lt;main data-screen=&quot;quote-editor&quot;&gt;&lt;button data-primary&gt;Send &amp; close');
    expect(page).toContain('sandbox=""');
    expect(page.match(/no mockup/g)).toHaveLength(2);
  });

  it('names a mockup it cannot read, and each library file that does not read', () => {
    const lost = galleryPage({ screens: [screen('lost', { mock: 'gone.html' })], problems: [] }, read);
    expect(lost).toContain('mockup cannot be read: gone.html');
    expect(page).toContain('does not read: broken.md: no front matter');
  });

  it('is self-contained: no script, no remote asset, and a policy that refuses both', () => {
    expect(page).not.toMatch(/<script/i);
    expect(page).not.toMatch(/(?:src|href)="(?:https?:)?\/\//i);
    expect(page).toContain(`content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"`);
  });

  it('escapes what a screen file says', () => {
    const odd = galleryPage({ screens: [screen('<b>x</b>', { routes: ['/a?b=1&c=2'] })], problems: [] }, read);
    expect(odd).toContain('<h2>&lt;b&gt;x&lt;/b&gt;</h2>');
    expect(odd).toContain('/a?b=1&amp;c=2');
  });
});
