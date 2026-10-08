import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { Board, Idea } from './model';
import { BoardPage } from './Board';
import { ideasView, type ReadBoard } from './source';

vi.mock('server-only', () => ({}));

// /ideas/<owner>/<repo> as the server renders it (PRD 1246, s1): what a visitor, a link preview and a
// search engine read, with no script run. The route runs in the demo's mode (no Supabase, not
// production); each state of the page is rendered from the board ideas_board() would answer.

const { default: Page, generateMetadata } = await import('../../app/ideas/[owner]/[repo]/page.tsx');
const { default: Layout } = await import('../../app/ideas/layout.tsx');

const params = (owner: string, repo: string) => ({ params: Promise.resolve({ owner, repo }) });
const route = async (owner: string, repo: string) =>
  renderToStaticMarkup(createElement(Layout, null, (await Page(params(owner, repo))) as ReactElement));

const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&#x27;/g, '\'').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const text = (markup: string) => decode(markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());

let n = 0;
const idea = (over: Partial<Idea> & Pick<Idea, 'title' | 'lane'>): Idea => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  pitch: `The pitch of ${over.title}.`,
  prd: null,
  created_at: '2026-10-01T09:00:00+00:00',
  votes: 0,
  voted: false,
  archived: false,
  ...over,
});
const board = (ideas: Idea[], over: Partial<Board> = {}): Board => ({ repo: 'acme/widgets', public: true, member: false, ideas, ...over });

/** The page as the server renders it for the board `read` answers. */
async function page(read: ReadBoard, owner = 'acme', repo = 'widgets') {
  return renderToStaticMarkup(createElement(BoardPage, { view: await ideasView({ mode: 'supabase' }, owner, repo, read) }));
}
/** Each lane's heading and its cards' titles, in the page's order. */
function lanes(markup: string): [string, string[]][] {
  return [...markup.matchAll(/<section class="idea-lane"[^>]*>([\s\S]*?)<\/section>/g)].map(([, lane = '']) => [
    text(/<h2[^>]*>([\s\S]*?)<\/h2>/.exec(lane)?.[1] ?? ''),
    [...lane.matchAll(/<h3 class="idea-title">([\s\S]*?)<\/h3>/g)].map(([, title = '']) => decode(title)),
  ]);
}

describe('a public board', () => {
  it('shows Now, Next and Later, each sorted by votes, then the oldest first', async () => {
    const markup = await page(async () => board([
      idea({ title: 'Later, 1 vote', lane: 'later', votes: 1 }),
      idea({ title: 'Now, 2 votes, young', lane: 'now', votes: 2, created_at: '2026-10-05T09:00:00+00:00' }),
      idea({ title: 'Now, 2 votes, old', lane: 'now', votes: 2, created_at: '2026-10-01T09:00:00+00:00' }),
      idea({ title: 'Now, 9 votes', lane: 'now', votes: 9, created_at: '2026-10-07T09:00:00+00:00' }),
      idea({ title: 'Next, no vote', lane: 'next' }),
    ]));
    expect(lanes(markup)).toEqual([
      ['Now 3', ['Now, 9 votes', 'Now, 2 votes, old', 'Now, 2 votes, young']],
      ['Next 1', ['Next, no vote']],
      ['Later 1', ['Later, 1 vote']],
    ]);
  });

  it('says whose board it is and how it reads', async () => {
    const markup = await page(async () => board([]));
    expect(markup).toMatch(/<h1[^>]*>Ideas for acme\/widgets<\/h1>/);
    expect(text(markup)).toContain('Votes sort the ideas inside a lane, most votes first.');
  });

  it('shows a card\'s title, pitch, and its count beside a ▲', async () => {
    const markup = await page(async () => board([idea({ title: 'Call GitHub less', lane: 'later', votes: 4, pitch: 'Fewer API calls.' })]));
    const card = /<article class="idea-card"[\s\S]*?<\/article>/.exec(markup)?.[0] ?? '';
    expect(card).toContain('<h3 class="idea-title">Call GitHub less</h3>');
    expect(card).toContain('<p class="idea-pitch">Fewer API calls.</p>');
    expect(card).toMatch(/aria-label="4 votes"[\s\S]*?▲[\s\S]*?4/);
  });

  it('leaves an archived idea out', async () => {
    const markup = await page(async () => board([idea({ title: 'Kept', lane: 'now' }), idea({ title: 'Dropped', lane: 'now', archived: true, votes: 50 })]));
    expect(lanes(markup)[0]).toEqual(['Now 1', ['Kept']]);
    expect(markup).not.toContain('Dropped');
  });

  it('shows an "In PRD #n" badge linking to the PRD\'s issue', async () => {
    const markup = await page(async () => board([idea({ title: 'Linked', lane: 'next', prd: parsePrd(1246) }), idea({ title: 'Unlinked', lane: 'next' })]));
    expect(markup).toContain('<a class="idea-prd" href="https://github.com/acme/widgets/issues/1246">In PRD #1246</a>');
    expect([...markup.matchAll(/class="idea-prd"/g)]).toHaveLength(1);
  });

  it('reads an empty board as three empty lanes', async () => {
    const markup = await page(async () => board([]));
    expect(lanes(markup)).toEqual([['Now 0', []], ['Next 0', []], ['Later 0', []]]);
    expect([...markup.matchAll(/Nothing here yet\./g)]).toHaveLength(3);
  });

  it('tells a member their board is private while it is', async () => {
    expect(text(await page(async () => board([], { public: false, member: true })))).toContain('This board is private');
    expect(text(await page(async () => board([])))).not.toContain('private');
  });
});

describe('a private board and a missing one', () => {
  it('answer the same "no public board here" page', async () => {
    const reads: string[] = [];
    const none: ReadBoard = async (name) => { reads.push(name); return null; };
    const privateBoard = await page(none, 'acme', 'secret');
    const missing = await page(none, 'Nobody', 'Nothing');
    expect(reads).toEqual(['acme/secret', 'nobody/nothing']);
    expect(privateBoard).toBe(missing);
    expect(privateBoard).toMatch(/<h1[^>]*>No public board here<\/h1>/);
    expect(privateBoard).not.toContain('secret');
  });

  it('is the same page for an address GitHub names no repository by, read from nowhere', async () => {
    const read = vi.fn<ReadBoard>();
    expect(await page(read, 'not a name', 'x')).toBe(await page(async () => null));
    expect(read).not.toHaveBeenCalled();
  });
});

describe('a board that cannot be read', () => {
  it('says so in one line, with no error detail', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const markup = await page(async () => { throw new Error('connection refused at 10.0.0.1'); });
    expect(text(markup)).toContain('The ideas board is unavailable right now.');
    expect(markup).not.toContain('10.0.0.1');
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });

  it('is unavailable in a closed build, without a read', async () => {
    const read = vi.fn<ReadBoard>();
    expect(await ideasView({ mode: 'closed' }, 'acme', 'widgets', read)).toEqual({ kind: 'unavailable' });
    expect(read).not.toHaveBeenCalled();
  });
});

describe('the route, on the demo board', () => {
  it('serves the demo board at /ideas/vertuoza/vertuo-omni-loop, archived idea left out', async () => {
    const markup = await route('vertuoza', 'vertuo-omni-loop');
    expect(markup).toContain('<span class="ask-brand-sub">Ideas</span>');
    expect(lanes(markup).map(([lane]) => lane)).toEqual(['Now 2', 'Next 2', 'Later 3']);
    expect(markup).not.toContain('An idea we dropped');
  });

  it('answers any other address with the "no public board here" page', async () => {
    expect(text(await route('acme', 'widgets'))).toContain('No public board here');
  });

  it('titles a board by its repository in its metadata, and a missing one as no board', async () => {
    const meta = await generateMetadata(params('vertuoza', 'vertuo-omni-loop'));
    expect(meta.title).toBe('Ideas for vertuoza/vertuo-omni-loop · Omni Loop');
    expect(meta.description).toContain('vertuoza/vertuo-omni-loop');
    expect(meta.openGraph).toMatchObject({ title: 'Ideas for vertuoza/vertuo-omni-loop · Omni Loop', url: 'https://www.omni-loop.xyz/ideas/vertuoza/vertuo-omni-loop' });
    expect(meta.alternates?.canonical).toBe('https://www.omni-loop.xyz/ideas/vertuoza/vertuo-omni-loop');
    const none = await generateMetadata(params('acme', 'widgets'));
    expect(none.title).toBe('No public board here · Omni Loop');
    expect(none.robots).toMatchObject({ index: false });
  });
});

describe('on a phone', () => {
  const css = readFileSync(fileURLToPath(new URL('./ideas.css', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('stacks the lanes, Now first, and sets them side by side only on a wide screen', () => {
    expect(css).toMatch(/\.idea-lanes \{[^}]*grid-template-columns: minmax\(0, 1fr\);/);
    expect(css).toMatch(/@media \(min-width: \d+px\) \{[^@]*\.idea-lanes \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); \}/);
    expect(css).not.toMatch(/(^|[\s;{])order:/);
  });

  it('names no colour of its own: every colour is an ask token', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
  });
});
