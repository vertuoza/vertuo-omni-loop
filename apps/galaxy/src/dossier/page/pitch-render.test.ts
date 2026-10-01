import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import type { PitchRunRow } from '../../pitch/store';
import type { ProofRunRow } from '../../proof/store';
import type { DossierRow } from '../store';
import { DossierPage } from './DossierPage';
import type { PitchRead } from './pitch';
import { dossierView, readPick } from './view';

vi.mock('next/navigation', async (original) => ({
  ...(await original<typeof import('next/navigation')>()),
  useRouter: () => ({ refresh: () => {} }),
}));

// The Pitch tab of /prd/<id> as the server renders it (PRD 859, s3): no tab without a pitch; with one,
// the slide, the player, the five downloads and Copy GIF link; two for one audience show the newer and a
// picker with both; Customers before Inside.

const ID = '00000000-0000-4000-8000-0000000000d1';
const PIERRE = { user_id: 'u-pierre', email: 'pierre@vertuoza.com', name: 'Pierre' };
const SUPABASE = { url: 'http://127.0.0.1:54321', key: 'anon' };

const numbered: DossierRow = {
  id: ID, workspace_id: 'w1', home_repo: 'vertuoza/vertuo-omni-loop', prd: 859, title: 'Pitch a shipped PRD',
  opened_by: PIERRE.user_id, created_at: '2026-09-27T09:12:00Z', numbered_at: '2026-09-27T10:00:00Z',
};

const FIVE = ['slide.png', 'slide-square.png', 'pitch.mp4', 'pitch-square.mp4', 'pitch.gif'];
const NEWER = '22222222-2222-4222-8222-222222222222';
const OLDER = '11111111-1111-4111-8111-111111111111';
const INSIDE = '33333333-3333-4333-8333-333333333333';

const pitch = (over: Partial<PitchRunRow>): PitchRunRow => ({
  id: NEWER, dossier_id: ID, audience: 'customers', look: 'arcade', commit_sha: 'a1b2c3d4e5f6',
  hook: 'Answer from <b>your phone</b>', benefit: 'Every question waits on one page.', kicker: 'NEW IN OMNI LOOP',
  closing: 'Omni Loop · https://omni.test', files: FIVE, created_by: PIERRE.user_id, created_at: '2026-10-01T14:05:00Z',
  ...over,
});

const signed = (run: string): Record<string, string | null> =>
  Object.fromEntries(FIVE.map((name) => [name, `https://storage.test/${run}/${name}`]));

const html = (pitches: PitchRead | null, query: Record<string, string> = { tab: 'pitch' }) => renderToStaticMarkup(createElement(DossierPage, {
  view: dossierView({ dossier: numbered, versions: [], members: [PIERRE], rounds: [], pitches }, PIERRE.user_id, readPick(query)),
  markdown: null, supabase: SUPABASE,
}));

describe('the Pitch tab, rendered', () => {
  it('is not in the bar without a pitch', () => {
    expect(html({ runs: [], links: {} })).not.toContain('>Pitch<');
    expect(html(null)).not.toContain('>Pitch<');
  });

  it('sits after Proof and before Retro, badged with the pitches', () => {
    const run: ProofRunRow = {
      id: OLDER, dossier_id: ID, commit_sha: 'abc1234', url: 'https://preview.test', gif: null, created_by: null,
      created_at: '2026-09-30T10:00:00Z', criteria: [{ text: 'x', verdict: 'pass' }],
    };
    const view = dossierView({ dossier: numbered, versions: [], members: [PIERRE], rounds: [], proofs: { runs: [run], shown: null }, pitches: { runs: [pitch({})], links: {} } }, PIERRE.user_id, readPick({}));
    const kinds = view.tabs.map((t) => t.kind);
    expect(kinds.indexOf('pitch')).toBe(kinds.indexOf('proof') + 1);
    expect(kinds.indexOf('retro')).toBe(kinds.indexOf('pitch') + 1);
    expect(view.tabs.find((t) => t.kind === 'pitch')).toMatchObject({ label: 'Pitch', badge: '1 pitch', href: `/prd/${ID}?tab=pitch` });
  });

  it('shows one pitch: the slide, the player, the five downloads and Copy GIF link', () => {
    const page = html({ runs: [pitch({})], links: { [NEWER]: signed(NEWER) } });
    expect(page).toMatch(/>Pitch<small>1 pitch<\/small>/);
    expect(page).toContain('<h2>Customers</h2>');
    expect(page).toContain(`src="https://storage.test/${NEWER}/slide.png"`);
    expect(page).toMatch(new RegExp(`<video[^>]*src="https://storage.test/${NEWER}/pitch.mp4"`));
    for (const name of FIVE) expect(page).toContain(`href="https://storage.test/${NEWER}/${name}" download="${name}"`);
    expect(page).toContain('Copy GIF link');
    expect(page).toContain('NEW IN OMNI LOOP');
    expect(page).toContain('Answer from &lt;b&gt;your phone&lt;/b&gt;');
    expect(page).not.toContain('<b>your phone</b>');
    expect(page).not.toContain('<h2>Inside</h2>');
  });

  it('shows two pitches for one audience as the newer, with a picker holding both', () => {
    const older = pitch({ id: OLDER, look: 'keynote', created_at: '2026-09-30T08:00:00Z' });
    const page = html({ runs: [pitch({}), older], links: { [NEWER]: signed(NEWER) } });
    expect(page).toContain(`src="https://storage.test/${NEWER}/slide.png"`);
    expect(page).toContain('name="pitch"');
    expect(page).toMatch(new RegExp(`<option value="${NEWER}" selected="">1 Oct · Arcade poster · Pierre</option>`));
    expect(page).toContain(`<option value="${OLDER}">30 Sep · Clean keynote · Pierre</option>`);
  });

  it('shows the older pitch once the picker names it', () => {
    const older = pitch({ id: OLDER, look: 'keynote', created_at: '2026-09-30T08:00:00Z' });
    const page = html({ runs: [pitch({}), older], links: { [OLDER]: signed(OLDER) } }, { tab: 'pitch', pitch: OLDER });
    expect(page).toContain(`src="https://storage.test/${OLDER}/slide.png"`);
    expect(page).toContain(`<option value="${OLDER}" selected="">`);
  });

  it('shows Customers before Inside, each with its latest', () => {
    const inside = pitch({ id: INSIDE, audience: 'inside', kicker: 'SHIPPED · PRD 859', created_at: '2026-10-01T15:00:00Z' });
    const page = html({ runs: [inside, pitch({})], links: { [NEWER]: signed(NEWER), [INSIDE]: signed(INSIDE) } });
    expect(page.indexOf('<h2>Customers</h2>')).toBeGreaterThan(-1);
    expect(page.indexOf('<h2>Inside</h2>')).toBeGreaterThan(page.indexOf('<h2>Customers</h2>'));
    expect(page).toContain('SHIPPED · PRD 859');
  });

  it('says a file could not be loaded when its link could not be signed', () => {
    const page = html({ runs: [pitch({})], links: {} });
    expect(page).toContain('A file could not be loaded');
    expect(page).toContain('aria-disabled="true"');
  });
});
