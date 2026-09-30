import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import type { ProofRunRow } from '../../proof/store';
import type { DossierRow } from '../store';
import { DossierPage } from './DossierPage';
import type { ProofRead } from './proof';
import { dossierView, readPick } from './view';

vi.mock('next/navigation', async (original) => ({
  ...(await original<typeof import('next/navigation')>()),
  useRouter: () => ({ refresh: () => {} }),
}));

// The Proof tab of /prd/<id> as the server renders it (PRD 798, s4): no tab without a run; with one, the
// run's facts and counts, then a row per criterion with its verdict, note, player and script fold, and
// the version picker for older runs.

const ID = '00000000-0000-4000-8000-0000000000d1';
const PIERRE = { user_id: 'u-pierre', email: 'pierre@vertuoza.com', name: 'Pierre' };
const SUPABASE = { url: 'http://127.0.0.1:54321', key: 'anon' };

const numbered: DossierRow = {
  id: ID, workspace_id: 'w1', home_repo: 'vertuoza/vertuo-omni-loop', prd: 798, title: 'Proof video',
  opened_by: PIERRE.user_id, created_at: '2026-09-27T09:12:00Z', numbered_at: '2026-09-27T10:00:00Z',
};

const RUN_ID = '22222222-2222-4222-8222-222222222222';
const RUN: ProofRunRow = {
  id: RUN_ID, dossier_id: ID, commit_sha: 'a1b2c3d4e5f6', url: 'https://preview.test/prd', gif: null,
  created_by: PIERRE.user_id, created_at: '2026-09-30T14:05:00Z',
  criteria: [
    { text: 'The tab shows a <b>player</b>', verdict: 'pass', video: '1-player.webm', script: '1-player.spec.ts' },
    { text: 'A failed check reads ✗', verdict: 'fail', note: 'expected ✗, got ✓', video: '2-fail.webm', script: '2-fail.spec.ts' },
    { text: 'The config key is set', verdict: 'unfilmable', note: 'a config key, not a screen' },
  ],
};
const OLDER: ProofRunRow = { ...RUN, id: '11111111-1111-4111-8111-111111111111', created_at: '2026-09-29T08:00:00Z', commit_sha: '0000000aaaa' };

const SHOWN: ProofRead['shown'] = {
  id: RUN_ID,
  links: { '1-player.webm': 'https://storage.test/p.webm', '1-player.spec.ts': 'https://storage.test/p.spec.ts', '2-fail.webm': null, '2-fail.spec.ts': 'https://storage.test/f.spec.ts' },
  scripts: { '1-player.spec.ts': "await expect(page.getByRole('tab')).toBeVisible(); // <script>", '2-fail.spec.ts': null },
};

const html = (proofs: ProofRead | null, query: Record<string, string> = { tab: 'proof' }) => renderToStaticMarkup(createElement(DossierPage, {
  view: dossierView({ dossier: numbered, versions: [], members: [PIERRE], rounds: [], proofs }, PIERRE.user_id, readPick(query)),
  markdown: null, supabase: SUPABASE,
}));

describe('the Proof tab, rendered', () => {
  it('is not in the bar without a run', () => {
    expect(html({ runs: [], shown: null })).not.toContain('>Proof<');
    expect(html(null)).not.toContain('>Proof<');
  });

  it('is in the bar with a run, badged with the runs', () => {
    const page = html({ runs: [RUN, OLDER], shown: null }, {});
    expect(page).toContain(`href="/prd/${ID}?tab=proof"`);
    expect(page).toMatch(/>Proof<small>2 runs<\/small>/);
  });

  it('shows the run: its commit, URL, date and counts', () => {
    const page = html({ runs: [RUN, OLDER], shown: SHOWN });
    expect(page).toContain('aria-label="Proof"');
    expect(page).toContain('a1b2c3d');
    expect(page).toContain('href="https://preview.test/prd"');
    expect(page).toContain('30 Sep 2026, 14:05 UTC');
    expect(page).toMatch(/✓ 1.*✗ 1.*— 1/s);
  });

  it('shows one row per criterion, its text escaped, verdict, note, player and script fold', () => {
    const page = html({ runs: [RUN, OLDER], shown: SHOWN });
    expect(page.match(/class="proof-row /g)).toHaveLength(3);
    expect(page).toContain('The tab shows a &lt;b&gt;player&lt;/b&gt;');
    expect(page).toContain('<video');
    expect(page).toContain('src="https://storage.test/p.webm"');
    expect(page).toContain('controls=""');
    expect(page).toContain('expected ✗, got ✓');
    expect(page).toContain('a config key, not a screen');
    expect(page).toContain('<summary>Script');
    expect(page).toContain('await expect(page.getByRole(&#x27;tab&#x27;)).toBeVisible(); // &lt;script&gt;');
    expect(page).not.toContain('// <script>');
    // A clip whose link could not be made, and a script whose text could not be read, say so.
    expect(page).toContain('The clip could not be loaded');
    expect(page).toContain('href="https://storage.test/f.spec.ts"');
  });

  it('has the version picker for its runs, the shown one selected', () => {
    const page = html({ runs: [RUN, OLDER], shown: SHOWN });
    expect(page).toContain('name="tab" value="proof"');
    expect(page).toContain('<span class="ask-hint">Run</span>');
    expect(page).toContain('Run 2 · 30 Sep · commit a1b2c3d · Pierre');
    expect(page).toContain('Run 1 · 29 Sep · commit 0000000 · Pierre');
  });
});
