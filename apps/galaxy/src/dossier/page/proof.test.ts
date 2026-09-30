import { describe, it, expect } from 'vitest';
import type { ProofRunRow } from '../../proof/store';
import type { DossierRow } from '../store';
import { proofView, type ProofRead } from './proof';
import { dossierView, readPick } from './view';

// The Proof tab of /prd/<id> (PRD 798, s4), as pure functions of the runs the viewer reads: hidden with
// no run; the newest run first, its commit, URL, date and ✓/✗/— counts, then one row per criterion with
// its verdict, note, player and script; an older run picked with the version picker.

const ID = '00000000-0000-4000-8000-0000000000d1';
const PIERRE = { user_id: 'u-pierre', email: 'pierre@vertuoza.com', name: 'Pierre' };

const numbered: DossierRow = {
  id: ID, workspace_id: 'w1', home_repo: 'vertuoza/vertuo-omni-loop', prd: 798, title: 'Proof video',
  opened_by: PIERRE.user_id, created_at: '2026-09-27T09:12:40Z', numbered_at: '2026-09-27T10:00:00Z',
};

const run = (id: string, at: string, more: Partial<ProofRunRow> = {}): ProofRunRow => ({
  id, dossier_id: ID, commit_sha: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678', url: 'https://preview.test', gif: null,
  created_by: PIERRE.user_id, created_at: at,
  criteria: [
    { text: 'The tab shows a player', verdict: 'pass', video: '1-player.webm', script: '1-player.spec.ts' },
    { text: 'A failed check reads ✗', verdict: 'fail', note: 'expected ✗, got ✓', video: '2-fail.webm', script: '2-fail.spec.ts' },
    { text: 'The config key is set', verdict: 'unfilmable', note: 'a config key, not a screen' },
  ],
  ...more,
});

// Newest first, as the store reads them.
const OLD = run('11111111-1111-4111-8111-111111111111', '2026-09-29T08:00:00Z', {
  commit_sha: '0000000aaaaaaa', criteria: [{ text: 'The tab shows a player', verdict: 'fail', note: 'no player', video: '1-player.webm' }],
});
const NEW = run('22222222-2222-4222-8222-222222222222', '2026-09-30T14:05:00Z');
const RUNS = [NEW, OLD];

const signed = (runId: string): ProofRead['shown'] => ({
  id: runId,
  links: {
    '1-player.webm': `https://storage.test/sign/${runId}/1-player.webm`,
    '1-player.spec.ts': `https://storage.test/sign/${runId}/1-player.spec.ts`,
    '2-fail.webm': null,
    '2-fail.spec.ts': `https://storage.test/sign/${runId}/2-fail.spec.ts`,
  },
  scripts: { '1-player.spec.ts': "test('player', async () => {});", '2-fail.spec.ts': null },
});

const page = (proofs: ProofRead | null | undefined, query: Record<string, string> = {}) =>
  dossierView({ dossier: numbered, versions: [], members: [PIERRE], rounds: [], proofs }, PIERRE.user_id, readPick(query));

describe('the Proof tab', () => {
  it('is not there without a run, nor when the runs could not be read', () => {
    expect(page({ runs: [], shown: null }).tabs.map((t) => t.kind)).not.toContain('proof');
    expect(page(null).tabs.map((t) => t.kind)).not.toContain('proof');
    expect(page(undefined).tabs.map((t) => t.kind)).not.toContain('proof');
    expect(page({ runs: [], shown: null }, { tab: 'proof' }).tab).not.toBe('proof');
  });

  it('comes after Outbox and before Retro once a run exists, counting the runs', () => {
    const v = page({ runs: RUNS, shown: null });
    expect(v.tabs.map((t) => t.kind)).toEqual(['questions', 'before-after', 'spec', 'plan', 'outbox', 'proof', 'retro']);
    const tab = v.tabs.find((t) => t.kind === 'proof');
    expect(tab).toMatchObject({ label: 'Proof', badge: '2 runs', href: `/prd/${ID}?tab=proof`, current: false, empty: false });
  });

  it('is picked by ?tab=proof', () => {
    const v = page({ runs: RUNS, shown: signed(NEW.id) }, { tab: 'proof' });
    expect(v.tab).toBe('proof');
    expect(v.proof?.number).toBe(2);
  });
});

describe('the run shown', () => {
  const href = (n: number) => `/prd/${ID}?tab=proof&v=${n}`;

  it('is the newest, with its commit, URL, date and ✓/✗/— counts', () => {
    const v = proofView({ runs: RUNS, shown: signed(NEW.id) }, null, href, [PIERRE]);
    expect(v).toMatchObject({
      number: 2, commit: 'a1b2c3d', url: 'https://preview.test', at: '30 Sep 2026, 14:05 UTC',
      counts: { pass: 1, fail: 1, unfilmable: 1 },
    });
  });

  it('has one row per criterion: verdict, note, player and script', () => {
    const [pass, fail, unfilmable] = proofView({ runs: RUNS, shown: signed(NEW.id) }, null, href, [PIERRE])!.criteria;
    expect(pass).toMatchObject({
      text: 'The tab shows a player', verdict: 'pass', mark: '✓', note: null,
      video: `https://storage.test/sign/${NEW.id}/1-player.webm`, videoMissing: false,
      script: { name: '1-player.spec.ts', text: "test('player', async () => {});", href: `https://storage.test/sign/${NEW.id}/1-player.spec.ts` },
    });
    // A clip whose link could not be signed says so; a script whose text could not be read keeps its link.
    expect(fail).toMatchObject({ verdict: 'fail', mark: '✗', note: 'expected ✗, got ✓', video: null, videoMissing: true });
    expect(fail.script).toEqual({ name: '2-fail.spec.ts', text: null, href: `https://storage.test/sign/${NEW.id}/2-fail.spec.ts` });
    // An unfilmable criterion has no clip and no script, and is not missing one.
    expect(unfilmable).toMatchObject({ verdict: 'unfilmable', mark: '—', note: 'a config key, not a screen', video: null, videoMissing: false, script: null });
  });

  it('lists every run in the picker, newest first, the shown one current', () => {
    const v = proofView({ runs: RUNS, shown: signed(NEW.id) }, null, href, [PIERRE])!;
    expect(v.versions.map((e) => [e.number, e.label, e.href, e.current])).toEqual([
      [2, 'Run 2 · 30 Sep · commit a1b2c3d · Pierre', href(2), true],
      [1, 'Run 1 · 29 Sep · commit 0000000 · Pierre', href(1), false],
    ]);
  });

  it('is an older run when the picker names it', () => {
    const v = proofView({ runs: RUNS, shown: { id: OLD.id, links: { '1-player.webm': 'https://storage.test/old.webm' }, scripts: {} } }, 1, href, [PIERRE])!;
    expect(v).toMatchObject({ number: 1, commit: '0000000', counts: { pass: 0, fail: 1, unfilmable: 0 } });
    expect(v.criteria).toHaveLength(1);
    expect(v.criteria[0]).toMatchObject({ verdict: 'fail', note: 'no player', video: 'https://storage.test/old.webm', script: null });
    expect(v.versions.find((e) => e.current)?.number).toBe(1);
  });

  it('is the newest when the picker names a run that is not there', () => {
    expect(proofView({ runs: RUNS, shown: signed(NEW.id) }, 9, href, [PIERRE])!.number).toBe(2);
  });

  it('signs nothing for a run it was not read for: the rows still show, without a player', () => {
    const v = proofView({ runs: RUNS, shown: null }, null, href, [PIERRE])!;
    expect(v.criteria[0]).toMatchObject({ video: null, videoMissing: true, script: { name: '1-player.spec.ts', text: null, href: null } });
  });

  it('is null with no run', () => {
    expect(proofView({ runs: [], shown: null }, null, href, [PIERRE])).toBeNull();
  });
});
