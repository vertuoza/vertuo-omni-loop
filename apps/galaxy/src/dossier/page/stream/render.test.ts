import { createElement } from 'react';
import { prerender } from 'react-dom/static';
import { describe, expect, it, vi } from 'vitest';
import type { GithubSummary } from '../../github/summary';
import { DEMO_GITHUB, DEMO_VIEWER, demoDossier } from '../demo';
import { DossierStream, type DossierReads } from './DossierStream';
import { GITHUB_PENDING } from './pending';
import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { readyView, type ReadyRow } from '../ready';

vi.mock('server-only', () => ({}));

// A PRD's page streamed (PRD 657 s4): sent once the database has answered, the Outbox saying it is
// being read while the GitHub summary is pending, then whole once it arrives. Bug #782: the change
// check (and the play dock it carries) starts from the database's read, never waiting for GitHub.

const NOW = Date.parse('2026-09-29T10:00:00Z');
const read = demoDossier(NOW);
const SUPABASE = { url: 'http://127.0.0.1:54321', key: 'anon' };
const never = <T,>() => new Promise<T>(() => {});

const reads = (github: Promise<GithubSummary | null>): DossierReads => ({
  github, slices: Promise.resolve(5), stages: Promise.resolve(read.stages ?? []),
});
const element = (github: Promise<GithubSummary | null>) => createElement('main', null, createElement(DossierStream, {
  read: { ...read, github: undefined }, me: DEMO_VIEWER, pick: { tab: 'outbox', version: null }, reads: reads(github),
  markdown: Promise.resolve(null), supabase: SUPABASE,
  live: (seen) => createElement('i', { 'data-live': seen.github ? 'with-github' : 'none' }),
}));

/** What the server has sent once the reads that resolve have: a pending summary keeps the page pending. */
async function sentBy(github: Promise<GithubSummary | null>) {
  const stop = new AbortController();
  setTimeout(() => { stop.abort(); }, 30);
  return new Response((await prerender(element(github), { signal: stop.signal, onError: () => {} })).prelude).text();
}

/** Everything the server sends, once every read has resolved. */
const everything = async (github: Promise<GithubSummary | null>) =>
  new Response((await prerender(element(github))).prelude).text();

/** The page as the browser ends up showing it: the completed segment the server sends after the
 * pending page, in the pending page's place, or the page itself when it was complete at once. */
async function settled(github: Promise<GithubSummary | null>) {
  const html = await new Response((await prerender(element(github))).prelude).text();
  const segment = html.indexOf('<div hidden id="S:0">');
  return segment < 0 ? html : html.slice(segment);
}

describe('a PRD\'s page, streamed', () => {
  it('is sent before GitHub answers: the header and the tabs, the Outbox being read, no change check yet', async () => {
    const html = await sentBy(never());
    expect(html).toContain('PRD #71');
    expect(html).toContain(GITHUB_PENDING);
  });

  // Bug #782: the change check carries the play dock (PRD 757) and the page's own live poll; it must not
  // wait for a GitHub summary that may never arrive.
  it('starts the change check, and so the play dock, before GitHub answers', async () => {
    const html = await sentBy(never());
    expect(html).toContain(GITHUB_PENDING);
    expect(html).toContain('data-live');
  });

  it('is sent whole once the summary arrives, the change check sent once, from the database\'s read', async () => {
    const html = await settled(Promise.resolve(DEMO_GITHUB));
    expect(html).toContain('PRD #71');
    expect(html).not.toContain(GITHUB_PENDING);
    const whole = await everything(Promise.resolve(DEMO_GITHUB));
    expect(whole.match(/data-live=/g)).toHaveLength(1);
    expect(whole).toContain('data-live="none"');
  });

  it('a summary GitHub could not give says so where it did before', async () => {
    const html = await settled(Promise.resolve(null));
    expect(html).not.toContain(GITHUB_PENDING);
    expect((await everything(Promise.resolve(null))).match(/data-live=/g)).toHaveLength(1);
  });
  // PRD 2898 s9: the route hands the page its latest ready verdict, and the Ready panel shows it.
  // omni-loop-20 s7: the Ready checks are a record at the top of the Feature tab, no panel above every tab.
  it('shows the Ready panel on the Feature tab once the route hands it a verdict, and none without one', async () => {
    const check = (at: number): ReadyRow['checks'][number] => ({ id: `c${String(at + 1)}`, title: `Check ${String(at + 1)}`, state: 'pass', why: '', evidence: null, excused: [] });
    const row: ReadyRow = {
      repo: 'acme/widgets', prd: parsePrd(71), pr_number: 72, head_sha: 'a'.repeat(40), state: 'ready', passed: 5, headline: 'Ready for review · 5 of 5',
      checks: [0, 1, 2, 3, 4].map(check), criteria: [], decided_at: '2026-11-15T07:00:00Z',
    };
    const page = (ready: Promise<ReturnType<typeof readyView>>) => createElement('main', null, createElement(DossierStream, {
      read: { ...read, github: undefined }, me: DEMO_VIEWER, pick: { tab: 'feature', version: null },
      reads: { ...reads(Promise.resolve(DEMO_GITHUB)), ready }, markdown: Promise.resolve(null), supabase: SUPABASE,
      live: () => null,
    }));
    const html = async (ready: Promise<ReturnType<typeof readyView>>) => new Response((await prerender(page(ready))).prelude).text();
    expect(await html(Promise.resolve(readyView(row)))).toContain('data-screen="ready-checks"');
    expect(await html(Promise.resolve(null))).not.toContain('data-screen="ready-checks"');
  });
});
