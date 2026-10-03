import { describe, expect, it } from 'vitest';
import { assertDefined } from 'vertuo-omni-plan/kit/test/assert.ts';
import type { DossierRow, DossierVersionRow } from '../store';
import { fixPageView } from '../../fixes/timeline';
import { dossierView, PAGE_TABS, readPick } from './view';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';

// A fix's page (PRD 627): the page of /prd/<id>, its tabs chosen by the dossier's kind. A visual fix
// reads Before/after, Variations — a round each, picked as Round k — and Questions; a bug fix reads Bug
// record and Questions; a PRD exactly today's tabs. The header badges the kind and links the issue,
// and has no stage; every link stays on the kind's own route.

const PIERRE = { user_id: 'u-pierre', email: 'pierre@vertuoza.com', name: 'Pierre' };
const ID = '00000000-0000-4000-8000-0000000000f1';

const fix = (kind: 'visual' | 'bug' | 'prd' | undefined, prd = 548): DossierRow => ({
  id: ID, workspace_id: 'w1', home_repo: 'vertuoza/vertuo-omni-loop', prd: parsePrd(prd), ...(kind ? { kind } : {}), title: 'Darker sidebar',
  opened_by: PIERRE.user_id, created_at: '2026-09-29T09:00:00Z', numbered_at: '2026-09-29T09:00:00Z',
});

let next = 0;
const version = (kind: DossierVersionRow['kind'], at: string): DossierVersionRow => {
  next += 1;
  return { id: `v${next}`, dossier_id: ID, kind, bytes: 100, source: 'kit', uploaded_by: PIERRE.user_id, commit_sha: null, created_at: at };
};

const VISUAL_VERSIONS = [
  version('variations', '2026-09-29T09:10:00Z'),
  version('variations', '2026-09-29T09:20:00Z'),
  version('before-after', '2026-09-29T09:30:00Z'),
];
const BUG_VERSIONS = [version('bug-record', '2026-09-29T10:00:00Z')];

const view = (dossier: DossierRow, versions: DossierVersionRow[], query: Record<string, string> = {}) =>
  dossierView({ dossier, versions, members: [PIERRE], rounds: [] }, PIERRE.user_id, readPick(query));

const tabs = (v: ReturnType<typeof view>) => v.tabs.map((t) => [t.label, t.badge, t.href]);

describe('a visual fix', () => {
  it('reads Timeline, Before/after, Variations, Questions, on its own route, opening on the Timeline', () => {
    const v = view(fix('visual'), VISUAL_VERSIONS);
    expect(tabs(v)).toEqual([
      ['Timeline', null, `/visual/${ID}`],
      ['Before/after', 'v1', `/visual/${ID}?tab=before-after`],
      ['Variations', '2 rounds', `/visual/${ID}?tab=variations`],
      ['Questions', null, `/visual/${ID}?tab=questions`],
    ]);
    expect(v.tab).toBe('timeline');
    expect(v.link).toBe(`/visual/${ID}`);
    expect(v.shown).toBeNull();
    expect(view(fix('visual'), VISUAL_VERSIONS, { tab: 'before-after' }).shown?.frame).toBe(`/visual/${ID}/v/1/page`);
  });

  it('carries the fix\'s state, links and Timeline the route read; a PRD none (PRD 627, s5)', () => {
    const facts = fixPageView('visual', null, 'none');
    const read = (dossier: DossierRow) => dossierView({ dossier, versions: [], members: [PIERRE], rounds: [], fix: facts }, PIERRE.user_id, readPick({}));
    expect(read(fix('visual')).fix).toBe(facts);
    expect(read(fix('prd', 216)).fix).toBeNull();
    expect(view(fix('visual'), []).fix).toBeNull();
  });

  it('picks a round of variations as Round k, newest first, each on its sandboxed route', () => {
    const v = view(fix('visual'), VISUAL_VERSIONS, { tab: 'variations' });
    expect(v.versions.map((e) => [e.label, e.href, e.frame, e.current])).toEqual([
      ['Round 2 · 29 Sep · Pierre (kit)', `/visual/${ID}?tab=variations&v=2`, `/visual/${ID}/r/2/page`, true],
      ['Round 1 · 29 Sep · Pierre (kit)', `/visual/${ID}?tab=variations&v=1`, `/visual/${ID}/r/1/page`, false],
    ]);
    expect(view(fix('visual'), VISUAL_VERSIONS, { tab: 'variations', v: '1' }).shown?.label).toMatch(/^Round 1 /);
  });

  it('badges one round as `1 round`, and none as nothing', () => {
    expect(view(fix('visual'), VISUAL_VERSIONS.slice(1)).tabs[2]?.badge).toBe('1 round');
    const [, , rounds] = view(fix('visual'), []).tabs;
    assertDefined(rounds, 'the Rounds tab');
    expect(rounds.badge).toBeNull();
  });

  it('is headed #n with a Visual badge linking to its issue, with no stage and nothing to delete', () => {
    expect(view(fix('visual'), VISUAL_VERSIONS)).toMatchObject({
      heading: '#548', badge: 'Visual', draft: false, issueUrl: 'https://github.com/vertuoza/vertuo-omni-loop/issues/548', stage: null, canDelete: false,
    });
  });

  it('falls back to the Timeline for a tab a visual fix does not have', () => {
    for (const tab of ['spec', 'plan', 'outbox', 'retro', 'bug-record']) expect(view(fix('visual'), VISUAL_VERSIONS, { tab }).tab).toBe('timeline');
  });
});

describe('a bug fix', () => {
  it('reads Timeline, Bug record, Questions, on its own route, its record rendered as markdown', () => {
    const v = view(fix('bug', 571), BUG_VERSIONS);
    expect(tabs(v)).toEqual([
      ['Timeline', null, `/bugs/${ID}`],
      ['Bug record', 'v1', `/bugs/${ID}?tab=bug-record`],
      ['Questions', null, `/bugs/${ID}?tab=questions`],
    ]);
    expect(v.tab).toBe('timeline');
    expect(view(fix('bug', 571), BUG_VERSIONS, { tab: 'bug-record' }).shown).toMatchObject({ number: 1, frame: null });
    expect(v).toMatchObject({ heading: '#571', badge: 'Bug', stage: null, link: `/bugs/${ID}` });
  });

  it('falls back to the Timeline for a tab a bug fix does not have', () => {
    for (const tab of ['before-after', 'variations', 'spec', 'outbox']) expect(view(fix('bug', 571), BUG_VERSIONS, { tab }).tab).toBe('timeline');
  });
});

describe('a PRD', () => {
  it('keeps exactly today\'s tabs, heading, route and no badge, with a kind or without one', () => {
    for (const kind of ['prd', undefined] as const) {
      const v = view(fix(kind, 216), [version('spec', '2026-09-29T09:00:00Z')]);
      expect(v.tabs.map((t) => t.kind)).toEqual(PAGE_TABS);
      expect(v).toMatchObject({ heading: 'PRD #216', badge: null, link: `/prd/${ID}` });
    }
  });

  it('knows no Variations, Bug record or Timeline tab', () => {
    expect(view(fix('prd', 216), [], { tab: 'timeline' }).tab).toBe('before-after');
    expect(view(fix('prd', 216), [], { tab: 'variations' }).tab).toBe('before-after');
    expect(view(fix('prd', 216), [], { tab: 'bug-record' }).tab).toBe('before-after');
  });
});
