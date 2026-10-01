// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configFrom } from '../config.ts';
import { buildSnapshot, toIso } from './github.ts';
import { projectEvents } from '../projector.ts';
import { score } from '../economy.ts';

// The roster comes from Supabase with the config: pm and alice fly with beaver. The game reads the
// workspace's tracked repositories (PRD 728): here, vertuoza/core-repo.
const R = 'vertuoza/core-repo';
const config = configFrom({
  sectors: [{ name: 'core', repos: ['core-repo'] }],
  teams: [{ name: 'beaver', home: 'core' }],
  roster: [{ github_login: 'pm', team: 'beaver' }, { github_login: 'alice', team: 'beaver' }],
  repositories: [{ full_name: R, tracked: true }],
});

const DIR = '.omni-loop/delivery/inbox/2332-generic-import';
const OUT = '.omni-loop/delivery/outbox/2332-generic-import';
const SPEC = '---\nprd: 2332\ntitle: Generic Import Engine\nblocked-by: none\nspec: file\n---\n';
const PLAN = '| id | slice | territory | blocked by | wave |\n| --- | --- | --- | --- | --- |\n| s1 | A | `a/` | — | 1 |\n| s2 | B | `b/` | s1 | 2 |\n';
const ITEM = '---\nid: s1-01-a\nprd: 2332\nslice: s1\nrank: high\nbears-on: none\nraised: 2026-09-21\nwave: 1\n---\n';
const ISSUE = { number: 2332, title: 'Generic Import Engine', assignees: [{ login: 'pm' }], author: { login: 'paul' }, createdAt: '2026-09-01T08:00:00Z', closedAt: null };
const FP = { number: 500, headRefName: 'feat/generic-import', createdAt: '2026-09-21T08:00:00Z', isDraft: true, mergedAt: null, updatedAt: '2026-09-23T08:00:00Z', labels: [{ name: 'omni:feature' }], body: 'Closes #2332' };

// A fake gh: matched on the joined argument string. An `out` that is an Error is thrown, so a
// test can simulate a real gh failure (a source that cannot be read) rather than a fixture gap. An
// unfixtured call throws too: a soft read (a 404) then reads as empty, a hard one fails the test.
function fakeExec(calls, seen = null) {
  return async (args) => {
    const key = args.join(' ');
    seen?.push(key);
    for (const [prefix, out] of calls) {
      if (!key.startsWith(prefix)) continue;
      if (out instanceof Error) throw out;
      return typeof out === 'string' ? out : JSON.stringify(out);
    }
    throw new Error(`unexpected gh call: ${key}`);
  };
}

// One tracked repository's reads: its default branch, its config, its delivery folders.
const repoCalls = (repo, { inbox = '', shipped = '', config: cfg = 'paths:\n  delivery: .omni-loop/delivery\n' } = {}) => [
  [`api repos/${repo} --jq`, 'main\n'],
  [`api repos/${repo}/contents/.omni-loop/config.yml`, cfg],
  [`api repos/${repo}/contents/.omni-loop/delivery/inbox --jq`, inbox],
  [`api repos/${repo}/contents/.omni-loop/delivery/shipped --jq`, shipped],
];

// One planet (#2332) in one repo, feature PR #500 open, sub-PR #501 merged on s1. `extra` calls are
// matched first, so a test overrides any base read by listing the same prefix.
const SUB_501 = { number: 501, title: 'feat: a', headRefName: 'feat/generic-import--s1', author: { login: 'alice' }, createdAt: '2026-09-21T09:00:00Z', labels: [{ name: 'omni:sub' }], mergedAt: '2026-09-21T12:00:00Z', body: 'Part of #2332', state: 'MERGED' };
function world(extra = []) {
  return [
    ...extra,
    [`issue list -R ${R} --label omni:prd`, [ISSUE]],
    ...repoCalls(R, { inbox: '2332-generic-import\n' }),
    [`api repos/${R}/contents/${DIR}/spec.md`, SPEC],
    [`api repos/${R}/commits?path=${DIR}/spec.md`, '2026-09-02T08:00:00Z\n'],
    [`pr list -R ${R} --search`, [FP]],
    [`api repos/${R}/contents/${DIR}/plan.md?ref=feat/generic-import`, PLAN],
    [`pr list -R ${R} --base feat/generic-import`, [SUB_501]],
    [`api repos/${R}/issues/`, ''], // sub-PR label timelines: none by default
    [`issue list -R ${R} --label bug`, []],
  ];
}
const NOW = new Date('2026-09-23T14:00:00Z');
const snap = (extra, over = {}) => buildSnapshot({ config, exec: fakeExec(world(extra)), now: NOW, ...over });

describe('buildSnapshot', () => {
  it('reads only the workspace\'s tracked repositories: an untracked one is never asked for', async () => {
    const acme = configFrom({ sectors: [], teams: [], roster: [], repositories: [{ full_name: 'acme-gh/acme-rockets', tracked: true }, { full_name: 'acme-gh/old-rockets', tracked: false }] });
    const seen = [];
    await buildSnapshot({ config: acme, exec: async (args) => { seen.push(args.join(' ')); return args[0] === 'issue' ? '[]' : ''; }, now: NOW });
    expect(seen).toEqual([expect.stringMatching(/^issue list -R acme-gh\/acme-rockets --label omni:prd /)]);
    const none = [];
    const empty = await buildSnapshot({ config: configFrom({}), exec: async (args) => { none.push(args); return '[]'; }, now: NOW });
    expect(empty.planets).toEqual([]);
    expect(none).toEqual([]);
  });

  it('reads the PRD folder in the kit layout, never docs/inbox', async () => {
    const seen = [];
    const p = (await buildSnapshot({ config, exec: fakeExec(world(), seen), now: NOW })).planets[0];
    expect(p).toMatchObject({ prd: 2332, home: R, regions: [{ repo: R, surveyedAt: '2026-09-02T08:00:00Z' }] });
    expect(p.zones.map((z) => z.id)).toEqual(['s1', 's2']);
    expect(seen.filter((c) => c.includes('docs/inbox') || c.includes('docs/outbox'))).toEqual([]);
  });

  it('reads the delivery folder a repository\'s config names', async () => {
    const exec = fakeExec([
      [`issue list -R ${R} --label omni:prd`, [ISSUE]],
      [`api repos/${R} --jq`, 'trunk\n'],
      [`api repos/${R}/contents/.omni-loop/config.yml`, 'paths:\n  delivery: delivery\n'],
      [`api repos/${R}/contents/delivery/inbox --jq`, '2332-generic-import\n'],
      [`api repos/${R}/contents/delivery/inbox/2332-generic-import/spec.md`, '---\nblocked-by: [2300]\n---\n'],
      [`pr list -R ${R} --search "Closes #2332" in:body --base trunk`, []],
    ]);
    const p = (await buildSnapshot({ config, exec, now: NOW })).planets[0];
    expect(p.regions).toEqual([{ repo: R, blockedBy: [2300], surveyedAt: '2026-09-01T08:00:00Z', featurePr: null }]);
  });

  it('takes the feature PR that says Closes #<n>, the omni:feature one first, never #<n>0', async () => {
    const pr = (number, over) => ({ ...FP, number, labels: [], ...over });
    const p = (await snap([[`pr list -R ${R} --search`, [pr(480, { body: 'Closes #23320' }), pr(490, { body: 'Closes #2332' }), pr(500, { labels: [{ name: 'omni:feature' }] })]]])).planets[0];
    expect(p.featurePr.number).toBe(500);
    const q = (await snap([[`pr list -R ${R} --search`, [pr(480, { body: 'Closes #23320' }), pr(495, { body: 'closes #2332.' }), pr(490, { body: 'Closes #2332' })]]])).planets[0];
    expect(q.featurePr.number).toBe(490);
  });

  it('gives the planet to the first assignee, else to the issue\'s author (PRD 728)', async () => {
    const roster = configFrom({ ...configRows(), roster: [{ github_login: 'pm', team: 'beaver' }, { github_login: 'Paul', team: 'octopod' }] });
    const assigned = (await buildSnapshot({ config: roster, exec: fakeExec(world()), now: NOW })).planets[0];
    expect(assigned).toMatchObject({ captain: 'pm', ownerTeam: 'beaver' });
    const unassigned = (await buildSnapshot({ config: roster, exec: fakeExec(world([[`issue list -R ${R} --label omni:prd`, [{ ...ISSUE, assignees: [] }]]])), now: NOW })).planets[0];
    expect(unassigned).toMatchObject({ captain: 'paul', ownerTeam: 'octopod' });
  });

  it('reads the omni:needs-fix label history off each zone sub-PR timeline (F1)', async () => {
    const subs = [
      { ...SUB_501, mergedAt: null, state: 'OPEN', labels: [{ name: 'omni:sub' }] },
      { ...SUB_501, number: 502, headRefName: 'feat/generic-import--s2', mergedAt: null, state: 'OPEN', labels: [{ name: 'omni:sub' }, { name: 'omni:needs-fix' }] },
    ];
    const [s1, s2] = (await snap([
      [`pr list -R ${R} --base feat/generic-import`, subs],
      [`api repos/${R}/issues/501/timeline`, 'labeled 2026-09-21T10:00:00Z\nunlabeled 2026-09-21T15:00:00Z\n'],
      [`api repos/${R}/issues/502/timeline`, 'labeled 2026-09-22T10:00:00Z\nunlabeled 2026-09-22T11:00:00Z\nlabeled 2026-09-22T12:00:00Z\n'],
    ])).planets[0].zones;
    expect(s1.pr.needsFix).toEqual({ labeledAt: '2026-09-21T10:00:00Z', unlabeledAt: '2026-09-21T15:00:00Z' });
    expect(s2.pr.needsFix).toEqual({ labeledAt: '2026-09-22T10:00:00Z', unlabeledAt: null }); // labelled again: still under fire
  });

  it('carries needsFix null for a never-labelled sub-PR, and labelled-since-creation when the timeline cannot be read (F1)', async () => {
    const [s1, s2] = (await snap([
      [`pr list -R ${R} --base feat/generic-import`, [{ ...SUB_501 }, { ...SUB_501, number: 502, headRefName: 'feat/generic-import--s2', mergedAt: null, state: 'OPEN', labels: [{ name: 'omni:sub' }, { name: 'omni:needs-fix' }] }]],
      [`api repos/${R}/issues/502/timeline`, new Error('gh: 502 Bad Gateway')],
    ])).planets[0].zones;
    expect(s1.pr.needsFix).toBeNull();
    expect(s2.pr.needsFix).toEqual({ labeledAt: '2026-09-21T09:00:00Z', unlabeledAt: null });
  });

  it('drops a closed unmerged sub-PR: the lowest live one becomes the zone pr (F2)', async () => {
    const p = (await snap([[`pr list -R ${R} --base feat/generic-import`, [
      { ...SUB_501, mergedAt: null, state: 'CLOSED' },
      { ...SUB_501, number: 505, author: { login: 'bob' }, createdAt: '2026-09-22T09:00:00Z', mergedAt: null, state: 'OPEN', labels: [{ name: 'omni:sub' }, { name: 'omni:in-progress' }] },
    ]]])).planets[0];
    expect(p.zones[0].pr).toMatchObject({ number: 505, author: 'bob', mergedAt: null });
  });

  it('after a revert, the zone\'s next sub-PR opened after the revert becomes its pr (F2)', async () => {
    const revert = { ...SUB_501, number: 503, title: 'Revert "feat: a"', headRefName: 'revert-501', createdAt: '2026-09-22T08:00:00Z', mergedAt: '2026-09-22T09:00:00Z', body: 'Reverts #501' };
    const next = { ...SUB_501, number: 505, author: { login: 'bob' }, createdAt: '2026-09-22T10:00:00Z', mergedAt: null, state: 'OPEN', labels: [{ name: 'omni:sub' }, { name: 'omni:in-progress' }] };
    expect((await snap([[`pr list -R ${R} --base feat/generic-import`, [SUB_501, revert, next]]])).planets[0].zones[0].pr).toMatchObject({ number: 505, author: 'bob', mergedAt: null, revertedAt: null });
    // With no sub-PR after the revert, the zone keeps the reverted one (so ZONE_REVERTED is still told).
    expect((await snap([[`pr list -R ${R} --base feat/generic-import`, [SUB_501, revert]]])).planets[0].zones[0].pr).toMatchObject({ number: 501, revertedAt: '2026-09-22T09:00:00Z' });
  });

  it('asks gh for the sub-PR state (F2)', async () => {
    const seen = [];
    await buildSnapshot({ config, exec: fakeExec(world(), seen), now: NOW });
    expect(seen.find((c) => c.includes('--base feat/generic-import'))).toMatch(/--json \S*\bstate\b/);
  });

  describe('timestamps (F4)', () => {
    it('toIso normalises, and reads empty, "null" and garbage as missing', () => {
      expect(toIso('2026-09-22')).toBe('2026-09-22T00:00:00Z');
      expect(toIso('2026-09-22T10:00:00.123Z')).toBe('2026-09-22T10:00:00Z');
      expect(toIso('2026-09-22T12:00:00+02:00')).toBe('2026-09-22T10:00:00Z');
      for (const bad of [null, undefined, '', '  ', 'null', 'yesterday-ish']) expect(toIso(bad)).toBeNull();
    });

    const SETTLED = [
      '<!-- omni-outbox-settled: s1-01-a -->', '- Verdict: agreed', '- Approved at: 2026-09-22', '- Approved by: pm', '- Rank: high', '',
      '<!-- omni-outbox-settled: s1-02-b -->', '- Verdict: agreed', '- Approved at: soon', '- Approved by: pm', '- Rank: medium', '',
    ].join('\n');

    it('normalises a date-only settle and skips a settle whose Approved at is garbage', async () => {
      const p = (await snap([
        [`api repos/${R}/contents/${OUT}?ref=feat/generic-import --jq`, 'settled.md\n'],
        [`api repos/${R}/contents/${OUT}/settled.md?ref=feat/generic-import`, SETTLED],
      ])).planets[0];
      expect(p.outbox).toEqual([
        { id: 's1-01-a', repo: R, rank: 'high', raisedAt: '2026-09-22T00:00:00Z', settled: { verdict: 'agreed', at: '2026-09-22T00:00:00Z', by: 'pm', reworkMergedAt: null, reworkBy: null } },
      ]);
    });

    it('treats a jq "null" as missing: surveyedAt falls back to the issue, raisedAt to the raised date', async () => {
      const p = (await snap([
        [`api repos/${R}/commits?path=${DIR}/spec.md`, 'null\n'],
        [`api repos/${R}/contents/${OUT}?ref=feat/generic-import --jq`, 's1-01-a.md\n'],
        [`api repos/${R}/contents/${OUT}/s1-01-a.md?ref=feat/generic-import`, ITEM],
        [`api repos/${R}/commits?path=${OUT}/s1-01-a.md`, 'null\n'],
      ])).planets[0];
      expect(p.regions[0].surveyedAt).toBe('2026-09-01T08:00:00Z');
      expect(p.outbox[0].raisedAt).toBe('2026-09-21T07:00:00Z');
    });

    it('skips an open item with neither a commit date nor a valid raised date', async () => {
      const p = (await snap([
        [`api repos/${R}/contents/${OUT}?ref=feat/generic-import --jq`, 's1-01-a.md\n'],
        [`api repos/${R}/contents/${OUT}/s1-01-a.md?ref=feat/generic-import`, ITEM.replace('raised: 2026-09-21', 'raised: someday')],
        [`api repos/${R}/commits?path=${OUT}/s1-01-a.md`, ''],
      ])).planets[0];
      expect(p.outbox).toEqual([]);
    });

    it('normalises every GitHub timestamp it keeps', async () => {
      const p = (await snap([[`pr list -R ${R} --base feat/generic-import`, [{ ...SUB_501, createdAt: '2026-09-21T09:00:00.000Z', mergedAt: '2026-09-21T14:00:00+02:00' }]]])).planets[0];
      expect(p.zones[0].pr).toMatchObject({ createdAt: '2026-09-21T09:00:00Z', mergedAt: '2026-09-21T12:00:00Z' });
    });
  });

  it('carries the rework sub-PR author of a drifted settle as reworkBy (F6)', async () => {
    const settled = ['<!-- omni-outbox-settled: s1-01-a -->', '- Verdict: drifted', '- Approved at: 2026-09-22T10:00:00Z', '- Approved by: pm', '- Rank: high', ''].join('\n');
    const p = (await snap([
      [`pr list -R ${R} --base feat/generic-import`, [SUB_501, { ...SUB_501, number: 510, headRefName: 'feat/generic-import--rework-s1-01-a', author: { login: 'carol' }, createdAt: '2026-09-22T11:00:00Z', mergedAt: '2026-09-22T15:00:00Z', body: 'Reworks s1-01-a' }]],
      [`api repos/${R}/contents/${OUT}?ref=feat/generic-import --jq`, 'settled.md\n'],
      [`api repos/${R}/contents/${OUT}/settled.md?ref=feat/generic-import`, settled],
    ])).planets[0];
    expect(p.outbox[0].settled).toEqual({ verdict: 'drifted', at: '2026-09-22T10:00:00Z', by: 'pm', reworkMergedAt: '2026-09-22T15:00:00Z', reworkBy: 'carol' });
  });

  describe('fleets come from the roster, not from GitHub', () => {
    it('never asks GitHub for team members', async () => {
      const seen = [];
      await buildSnapshot({ config, exec: fakeExec(world(), seen), now: NOW });
      expect(seen.filter((c) => c.includes('/teams/'))).toEqual([]);
    });

    it('gives the captain\'s fleet to the planet whatever the login\'s case, and none to an unlinked captain', async () => {
      const shouting = configFrom({ ...configRows(), roster: [{ github_login: 'PM', team: 'beaver' }] });
      expect((await buildSnapshot({ config: shouting, exec: fakeExec(world()), now: NOW })).planets[0].ownerTeam).toBe('beaver');
      const nobody = configFrom({ ...configRows(), roster: [] });
      expect((await buildSnapshot({ config: nobody, exec: fakeExec(world()), now: NOW })).planets[0].ownerTeam).toBeNull();
    });

    it('stamps each event with the contributor\'s fleet from the roster', async () => {
      const s = await snap();
      expect(s.teams).toEqual({ pm: 'beaver', alice: 'beaver' });
      expect(projectEvents(s, { config, now: NOW }).find((e) => e.type === 'ZONE_SECURED')).toMatchObject({ contributor: 'alice', team: 'beaver', home: R });
    });
  });

  describe('bug fixes (F5c)', () => {
    const bug = (number) => ({ number, createdAt: '2026-09-22T09:00:00Z', closedAt: '2026-09-23T09:00:00Z', closedBy: { login: 'pm' } });
    const bugsOf = async (extra) => (await snap(extra)).planets[0].bugs;
    const ref = (number) => ({ number, url: `https://github.com/${R}/pull/${number}`, repository: { name: 'core-repo', owner: { login: 'vertuoza' } } });

    it('credits a closed bug to the author of a merged PR that closed it', async () => {
      const bugs = await bugsOf([
        [`issue list -R ${R} --label bug`, [bug(600), bug(601), bug(602), { ...bug(603), closedAt: null, closedBy: null }]],
        [`issue view 600 -R ${R} --json closedByPullRequestsReferences`, { closedByPullRequestsReferences: [ref(610)] }],
        [`issue view 601 -R ${R} --json closedByPullRequestsReferences`, { closedByPullRequestsReferences: [] }],
        [`issue view 602 -R ${R} --json closedByPullRequestsReferences`, { closedByPullRequestsReferences: [ref(612)] }],
        [`pr view 610 -R ${R} --json mergedAt,author`, { mergedAt: '2026-09-23T08:59:00Z', author: { login: 'dave' } }],
        [`pr view 612 -R ${R} --json mergedAt,author`, { mergedAt: null, author: { login: 'erin' } }],
      ]);
      expect(bugs.map((b) => [b.number, b.closedAt, b.fixedBy])).toEqual([
        [600, '2026-09-23T09:00:00Z', 'dave'], // closed by a merged PR
        [601, '2026-09-23T09:00:00Z', null],   // closed by hand
        [602, '2026-09-23T09:00:00Z', null],   // the referenced PR never merged
        [603, null, null],                     // still open: no read at all
      ]);
    });

    it('falls back to the timeline closed event when closedByPullRequestsReferences is unsupported; unknown is not fixed', async () => {
      const unsupported = new Error('Unknown JSON field: "closedByPullRequestsReferences"');
      const bugs = await bugsOf([
        [`issue list -R ${R} --label bug`, [bug(600), bug(601)]],
        [`issue view 600 -R ${R}`, unsupported],
        [`issue view 601 -R ${R}`, unsupported],
        [`api repos/${R}/issues/600/timeline`, 'abc123 dave\n'],
        [`api repos/${R}/issues/601/timeline`, 'null pm\n'],
      ]);
      expect(bugs.map((b) => [b.number, b.fixedBy])).toEqual([[600, 'dave'], [601, null]]);
    });
  });

  it('assembles a planet from its issue, folder, plan, sub-PRs, outbox and bugs', async () => {
    const s = await snap([
      [`api repos/${R}/contents/${OUT}?ref=feat/generic-import --jq`, 's1-01-a.md\nREADME.md\n'],
      [`api repos/${R}/contents/${OUT}/s1-01-a.md?ref=feat/generic-import`, ITEM],
      [`api repos/${R}/commits?path=${OUT}/s1-01-a.md`, '2026-09-21T10:00:00Z\n'],
    ]);
    expect(s.teams).toEqual({ pm: 'beaver', alice: 'beaver' });
    expect(s.planets).toHaveLength(1);
    const p = s.planets[0];
    expect(p).toMatchObject({ prd: 2332, home: R, title: 'Generic Import Engine', captain: 'pm', ownerTeam: 'beaver' });
    const fp = { repo: R, number: 500, createdAt: '2026-09-21T08:00:00Z', readyAt: null, mergedAt: null, lastActivityAt: '2026-09-23T08:00:00Z' };
    expect(p.regions).toEqual([{ repo: R, blockedBy: [], surveyedAt: '2026-09-02T08:00:00Z', featurePr: fp }]);
    expect(p.featurePr).toEqual(fp);
    expect(p.zones).toEqual([
      { id: 's1', repo: R, wave: 1, blockedBy: [], pr: { number: 501, author: 'alice', createdAt: '2026-09-21T09:00:00Z', labels: ['omni:sub'], mergedAt: '2026-09-21T12:00:00Z', revertedAt: null, needsFix: null } },
      { id: 's2', repo: R, wave: 2, blockedBy: ['s1'], pr: null },
    ]);
    expect(p.outbox).toEqual([{ id: 's1-01-a', repo: R, rank: 'high', raisedAt: '2026-09-21T10:00:00Z', settled: null }]);
    expect(p.bugs).toEqual([]);
  });

  it('keeps a planet charted and unsurveyed when its home has no folder for it', async () => {
    const exec = fakeExec([
      [`issue list -R ${R} --label omni:prd`, [{ number: 2400, title: 'New', assignees: [], author: null, createdAt: '2026-09-20T08:00:00Z', closedAt: null }]],
      ...repoCalls(R, { inbox: '2332-generic-import\n' }),
    ]);
    const s = await buildSnapshot({ config, exec, now: NOW });
    expect(s.planets[0]).toMatchObject({ prd: 2400, captain: null, ownerTeam: null, regions: [], featurePr: null, zones: [], outbox: [], bugs: [] });
  });

  it('ignores an outbox file with no front matter, keeping only the valid item (spec §8)', async () => {
    const p = (await snap([
      [`api repos/${R}/contents/${OUT}?ref=feat/generic-import --jq`, 's1-01-a.md\nbroken.md\n'],
      [`api repos/${R}/contents/${OUT}/s1-01-a.md?ref=feat/generic-import`, ITEM],
      [`api repos/${R}/commits?path=${OUT}/s1-01-a.md`, '2026-09-21T10:00:00Z\n'],
      // broken.md has no front matter: no commits fixture for it — it is skipped before its raisedAt is asked.
      [`api repos/${R}/contents/${OUT}/broken.md?ref=feat/generic-import`, '## no front matter here\n'],
    ])).planets[0];
    expect(p.outbox).toEqual([{ id: 's1-01-a', repo: R, rank: 'high', raisedAt: '2026-09-21T10:00:00Z', settled: null }]);
  });

  it('falls back a region\'s surveyedAt to the PRD issue\'s createdAt when the spec commits read fails (spec §8)', async () => {
    const p = (await snap([
      [`api repos/${R}/commits?path=${DIR}/spec.md`, new Error('gh: 502 Bad Gateway')],
      [`pr list -R ${R} --search`, []],
    ])).planets[0];
    expect(p.regions).toEqual([{ repo: R, blockedBy: [], surveyedAt: '2026-09-01T08:00:00Z', featurePr: null }]);
  });

  it('reads a repository that cannot be read as empty, and still reads the others (spec §8)', async () => {
    const two = configFrom({ ...configRows(), repositories: [{ full_name: 'vertuoza/broken', tracked: true }, { full_name: R, tracked: true }] });
    const s = await buildSnapshot({ config: two, exec: fakeExec([['issue list -R vertuoza/broken', new Error('gh: HTTP 404')], ...world()]), now: NOW });
    expect(s.planets.map((p) => `${p.home}#${p.prd}`)).toEqual([`${R}#2332`]);
  });

  it('filters to the given PRDs and their blockers, issuing no per-PRD gh calls for the rest (single-planet read)', async () => {
    const exec = fakeExec([
      [`issue list -R ${R} --label omni:prd`, [
        { ...ISSUE },
        { number: 2400, title: 'Other Planet', assignees: [], author: { login: 'pm' }, createdAt: '2026-09-02T08:00:00Z', closedAt: null },
        { number: 2300, title: 'Blocker', assignees: [], author: { login: 'pm' }, createdAt: '2026-08-02T08:00:00Z', closedAt: null },
      ]],
      ...repoCalls(R, { inbox: '2300-blocker\n2332-generic-import\n2400-other\n' }),
      [`api repos/${R}/contents/${DIR}/spec.md`, '---\nblocked-by: [2300]\n---\n'],
      [`api repos/${R}/contents/.omni-loop/delivery/inbox/2300-blocker/spec.md`, SPEC.replace('2332', '2300')],
      [`api repos/${R}/commits?path=`, '2026-09-02T08:00:00Z\n'],
      // Only #2332's and #2300's feature PR lookups are fixtured: walking #2400 would throw here.
      [`pr list -R ${R} --search "Closes #2332" in:body`, []],
      [`pr list -R ${R} --search "Closes #2300" in:body`, []],
    ]);
    const s = await buildSnapshot({ config, exec, now: NOW, prds: [2332] });
    expect(s.planets.map((p) => p.prd)).toEqual([2332, 2300]);
  });

  it('reads docs/inbox nowhere in game/ (PRD 728)', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..');
    const sources = [];
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) sources.push(path);
      }
    };
    walk(root);
    expect(sources.length).toBeGreaterThan(10);
    expect(sources.filter((path) => readFileSync(path, 'utf8').includes('docs/inbox'))).toEqual([]);
  });
});

// The rows `config` above is made of, for a test that changes one of them.
function configRows() {
  return {
    sectors: [{ name: 'core', repos: ['core-repo'] }],
    teams: [{ name: 'beaver', home: 'core' }, { name: 'octopod', home: 'core' }],
    repositories: [{ full_name: R, tracked: true }],
  };
}

// PRD 728's done-when for s1, end to end: a PRD of a tracked repository that is not the plan
// repository, delivered in the kit layout, earns its people points as game:score folds them.
describe('a PRD delivered in any tracked repository earns its people points (PRD 728)', () => {
  const PLAN_REPO = 'vertuoza/vertuo-automation-plan';
  const SHIPPED = '.omni-loop/delivery/shipped/0088-points';
  const cfg = configFrom({
    sectors: [{ name: 'omni-core', repos: ['vertuo-omni-loop'] }],
    teams: [{ name: 'beaver', home: 'omni-core' }, { name: 'octopod', home: null }],
    roster: [{ github_login: 'paul', team: 'beaver' }, { github_login: 'alice', team: 'octopod' }, { github_login: 'pierre', team: 'beaver' }],
    repositories: [{ full_name: 'vertuoza/vertuo-omni-loop', tracked: true }, { full_name: PLAN_REPO, tracked: true }],
  });
  const sub = (number, slice, author, mergedAt) => ({ number, title: `feat: ${slice}`, headRefName: `feat/points--${slice}`, author: { login: author }, createdAt: '2026-09-29T08:00:00Z', labels: [{ name: 'omni:sub' }], mergedAt, body: 'Part of #88', state: 'MERGED' });
  const SETTLED = [
    '<!-- omni-outbox-settled: s1-01-a -->', '', '## s1-01-a — agreed', '', '- Verdict: agreed', '- Approved by: pierre', '- Approved at: 2026-09-29T12:00:00Z', '- Rank: high', '- Slice: s1', '',
    '<!-- omni-outbox-settled: s2-01-b -->', '', '## s2-01-b — adopted', '', '- Verdict: adopted', '- Approved by: nobody', '- Approved at: 2026-09-29', '- Rank: medium', '- Slice: s2', '',
  ].join('\n');
  const exec = fakeExec([
    ['issue list -R vertuoza/vertuo-omni-loop --label omni:prd', []],
    [`issue list -R ${PLAN_REPO} --label omni:prd`, [{ number: 88, title: 'Points', assignees: [], author: { login: 'paul' }, createdAt: '2026-09-28T08:00:00Z', closedAt: '2026-09-29T14:00:00Z' }]],
    ...repoCalls(PLAN_REPO, { shipped: '0088-points\n' }),
    [`api repos/${PLAN_REPO}/contents/${SHIPPED}/spec.md`, '---\nprd: 88\nblocked-by: none\n---\n'],
    [`api repos/${PLAN_REPO}/commits?path=`, '2026-09-28T09:00:00Z\n'],
    [`pr list -R ${PLAN_REPO} --search "Closes #88" in:body --base main`, [{ number: 89, headRefName: 'feat/points', createdAt: '2026-09-29T07:00:00Z', isDraft: false, mergedAt: '2026-09-29T14:00:00Z', updatedAt: '2026-09-29T14:00:00Z', labels: [{ name: 'omni:feature' }], body: 'Closes #88' }]],
    [`api repos/${PLAN_REPO}/issues/89/timeline`, '2026-09-29T13:00:00Z\n'],
    [`api repos/${PLAN_REPO}/contents/${SHIPPED}/plan.md?ref=main`, PLAN],
    [`pr list -R ${PLAN_REPO} --base feat/points`, [sub(91, 's1', 'paul', '2026-09-29T10:00:00Z'), sub(92, 's2', 'alice', '2026-09-29T11:00:00Z')]],
    [`api repos/${PLAN_REPO}/issues/`, ''],
    [`api repos/${PLAN_REPO}/contents/${SHIPPED}/outbox?ref=main --jq`, 'settled.md\n'],
    [`api repos/${PLAN_REPO}/contents/${SHIPPED}/outbox/settled.md?ref=main`, SETTLED],
    [`issue list -R ${PLAN_REPO} --label bug`, []],
  ]);
  const now = new Date('2026-09-30T10:00:00Z');

  it('pays 10 per zone to each sub-PR\'s author, the 50 expedition bonus at the merge, and the settler their wound and closer points', async () => {
    const s = await buildSnapshot({ config: cfg, exec, now });
    expect(s.planets.map((p) => [p.home, p.prd, p.captain, p.ownerTeam])).toEqual([[PLAN_REPO, 88, 'paul', 'beaver']]);
    const events = projectEvents(s, { config: cfg, now });
    expect(events.every((e) => e.home === PLAN_REPO)).toBe(true);
    expect(events.find((e) => e.type === 'PLANET_TERRAFORMED')).toMatchObject({ id: `planet:${PLAN_REPO}#88:terraformed`, at: '2026-09-29T14:00:00Z', data: { ownerTeam: 'beaver' } });
    const season = score(events, { season: '2026-09', now });
    // paul: s1 (10) + expedition (50); alice: s2 (10) + expedition (50); pierre: the high item (15) + closer (25).
    expect(season.individuals).toEqual({ paul: 60, alice: 60, pierre: 40 });
    expect(season.teams.beaver).toBe(10 + 50 + 15 + 25 + 100); // paul's and pierre's credits, and the owner's terraform
  });

  it('keeps two repositories\' PRD 88 apart: no shared id, owner, clawback or terraform', async () => {
    const both = configFrom({ ...cfg, sectors: [], teams: [{ name: 'beaver', home: null }, { name: 'octopod', home: null }], roster: [{ github_login: 'paul', team: 'beaver' }, { github_login: 'alice', team: 'octopod' }], repositories: [{ full_name: 'vertuoza/vertuo-omni-loop', tracked: true }, { full_name: PLAN_REPO, tracked: true }] });
    const other = 'vertuoza/vertuo-omni-loop';
    const twin = fakeExec([
      [`issue list -R ${other} --label omni:prd`, [{ number: 88, title: 'Other 88', assignees: [{ login: 'alice' }], author: { login: 'alice' }, createdAt: '2026-09-28T08:00:00Z', closedAt: '2026-09-29T15:00:00Z' }]],
      ...repoCalls(other, { inbox: '0088-other\n' }),
      [`api repos/${other}/contents/.omni-loop/delivery/inbox/0088-other/spec.md`, '---\nprd: 88\n---\n'],
      [`api repos/${other}/commits?path=`, '2026-09-28T09:00:00Z\n'],
      [`pr list -R ${other} --search`, [{ number: 300, headRefName: 'feat/other', createdAt: '2026-09-29T07:00:00Z', isDraft: true, mergedAt: null, updatedAt: '2026-09-29T09:00:00Z', labels: [], body: 'Closes #88' }]],
      [`api repos/${other}/contents/.omni-loop/delivery/inbox/0088-other/plan.md?ref=feat/other`, PLAN],
      [`pr list -R ${other} --base feat/other`, [{ ...sub(301, 's1', 'alice', '2026-09-29T09:00:00Z'), headRefName: 'feat/other--s1' }]],
      [`api repos/${other}/issues/`, ''],
      [`issue list -R ${other} --label bug`, []],
    ]);
    const all = async (args) => (args.join(' ').includes(other) ? twin(args) : exec(args));
    const s = await buildSnapshot({ config: both, exec: all, now });
    expect(s.planets.map((p) => [p.home, p.prd, p.ownerTeam])).toEqual([[PLAN_REPO, 88, 'beaver'], [other, 88, 'octopod']]);
    const events = projectEvents(s, { config: both, now });
    const ids = events.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(events.filter((e) => e.type === 'PLANET_TERRAFORMED').map((e) => e.home)).toEqual([PLAN_REPO]);
    expect(events.filter((e) => e.type === 'PLANET_LOST').map((e) => e.home)).toEqual([other]);
    const season = score(events, { season: '2026-09', now });
    expect(season.planets[`${PLAN_REPO}#88`]).toMatchObject({ ownerTeam: 'beaver', terraformed: true, lost: false });
    expect(season.planets[`${other}#88`]).toMatchObject({ ownerTeam: 'octopod', terraformed: false, lost: true });
    // The lost twin claws back only its own zone: paul and alice keep what they earned on the terraformed 88.
    expect(season.individuals).toEqual({ paul: 60, alice: 60, pierre: 40 });
  });
});

// PRD 728's done-when for s3: a PRD of a plan repository whose slices land in target repositories,
// each target's feature PR saying `Part of <owner>/<plan>#<n>`. Each target is a region: its sub-PRs
// secure zones for their authors, and the planet terraforms only once every region's feature PR merged.
describe('a multi-repository PRD: each `Part of` feature PR is one more region (PRD 728)', () => {
  const PLAN_REPO = 'vertuoza/vertuo-automation-plan';
  const APPS = 'vertuoza/vertuo-apps';
  const PHP = 'vertuoza/vertuo-backend-php';
  const SHIPPED = '.omni-loop/delivery/shipped/0088-points';
  const cfg = configFrom({
    sectors: [{ name: 'front', repos: ['vertuo-apps'] }, { name: 'back', repos: ['vertuo-backend-php'] }],
    teams: [{ name: 'beaver', home: 'front' }, { name: 'octopod', home: 'back' }],
    roster: [{ github_login: 'paul', team: 'beaver' }, { github_login: 'alice', team: 'beaver' }, { github_login: 'bob', team: 'octopod' }],
    repositories: [PLAN_REPO, APPS, PHP].map((full_name) => ({ full_name, tracked: true })),
  });
  const MULTI_PLAN = [
    '## Slices', '',
    '| id | repo | slice | territory | blocked by | wave |', '| --- | --- | --- | --- | --- | --- |',
    '| s1 | vertuo-backend-php | API | `src/` | — | 1 |',
    '| s2 | vertuo-apps | Screen | `apps/` | s1 | 2 |', '',
  ].join('\n');
  const feature = (number, over = {}) => ({ number, headRefName: 'feat/points', createdAt: '2026-09-29T07:00:00Z', isDraft: false, mergedAt: null, updatedAt: '2026-09-29T09:00:00Z', labels: [{ name: 'omni:feature' }], body: `Part of ${PLAN_REPO}#88\n\n## Slices`, ...over });
  const sub = (number, slice, author, mergedAt) => ({ number, title: `feat: ${slice}`, headRefName: `feat/points--${slice}`, author: { login: author }, createdAt: '2026-09-29T08:00:00Z', labels: [{ name: 'omni:sub' }], mergedAt, body: `Part of ${PLAN_REPO}#88 · slice ${slice}`, state: 'MERGED' });
  const now = new Date('2026-09-30T10:00:00Z');
  const merged = (at) => ({ mergedAt: at, updatedAt: at });
  const world = ({ apps = [feature(284, merged('2026-09-29T15:00:00Z'))], php = [feature(40, merged('2026-09-29T12:00:00Z'))] } = {}, seen = null) => fakeExec([
    [`issue list -R ${PLAN_REPO} --label omni:prd`, [{ number: 88, title: 'Points', assignees: [], author: { login: 'paul' }, createdAt: '2026-09-28T08:00:00Z', closedAt: null }]],
    [`issue list -R ${APPS} --label omni:prd`, []],
    [`issue list -R ${PHP} --label omni:prd`, []],
    ...repoCalls(PLAN_REPO, { shipped: '0088-points\n' }),
    [`api repos/${PLAN_REPO}/contents/${SHIPPED}/spec.md`, '---\nprd: 88\nblocked-by: none\n---\n'],
    [`api repos/${PLAN_REPO}/commits?path=`, '2026-09-28T09:00:00Z\n'],
    [`pr list -R ${PLAN_REPO} --search "Closes #88" in:body --base main`, [{ number: 89, headRefName: 'feat/points', createdAt: '2026-09-29T07:00:00Z', isDraft: false, mergedAt: '2026-09-29T14:00:00Z', updatedAt: '2026-09-29T14:00:00Z', labels: [{ name: 'omni:feature' }], body: 'Closes #88' }]],
    [`api repos/${PLAN_REPO}/contents/${SHIPPED}/plan.md?ref=main`, MULTI_PLAN],
    [`api repos/${APPS} --jq`, 'develop\n'],
    [`api repos/${PHP} --jq`, 'main\n'],
    // Two more PRs into vertuo-apps' default branch: one names a PRD whose home is not tracked, one says Closes.
    [`pr list -R ${APPS} --search "Part of" in:body --base develop`, [...apps, feature(290, { body: 'Part of vertuoza/old-plan#88' }), feature(291, { body: 'Closes #88' })]],
    [`pr list -R ${PHP} --search "Part of" in:body --base main`, php],
    [`pr list -R ${APPS} --base feat/points`, [sub(285, 's2', 'alice', '2026-09-29T13:00:00Z')]],
    [`pr list -R ${PHP} --base feat/points`, [sub(41, 's1', 'bob', '2026-09-29T11:00:00Z')]],
    [`api repos/${PLAN_REPO}/issues/`, ''],
    [`api repos/${APPS}/issues/`, ''],
    [`api repos/${PHP}/issues/`, ''],
    [`issue list -R ${PLAN_REPO} --label bug`, []],
  ], seen);

  it('makes each target a region whose sub-PRs secure zones for their authors', async () => {
    const s = await buildSnapshot({ config: cfg, exec: world(), now });
    const p = s.planets[0];
    expect(p.regions.map((r) => [r.repo, r.featurePr?.number])).toEqual([[PLAN_REPO, 89], [APPS, 284], [PHP, 40]]);
    expect(p.regions[1]).toMatchObject({ blockedBy: [], surveyedAt: '2026-09-29T07:00:00Z' });
    expect(p.zones.map((z) => [z.id, z.repo, z.pr?.number, z.pr?.author])).toEqual([['s2', APPS, 285, 'alice'], ['s1', PHP, 41, 'bob']]);
    const events = projectEvents(s, { config: cfg, now });
    expect(events.filter((e) => e.type === 'ZONE_SECURED').map((e) => [e.id, e.contributor])).toEqual([
      [`zone:${PHP}:${PLAN_REPO}#88:s1:secured`, 'bob'],
      [`zone:${APPS}:${PLAN_REPO}#88:s2:secured`, 'alice'],
    ]);
    expect(events.find((e) => e.type === 'PLANET_TERRAFORMED')).toMatchObject({ id: `planet:${PLAN_REPO}#88:terraformed`, at: '2026-09-29T15:00:00Z' });
    // Each author: 10 for the zone and the 50 expedition bonus at the last region's merge.
    expect(score(events, { season: '2026-09', now }).individuals).toEqual({ alice: 60, bob: 60 });
  });

  it('terraforms only when every region\'s feature PR has merged', async () => {
    const s = await buildSnapshot({ config: cfg, exec: world({ apps: [feature(284)] }), now });
    expect(s.planets[0].featurePr.mergedAt).toBeNull();
    expect(projectEvents(s, { config: cfg, now }).filter((e) => e.type === 'PLANET_TERRAFORMED')).toEqual([]);
    // A target the plan gives slices, whose `Part of` PR is not open yet: its zone waits, and so does the terraform.
    const unopened = (await buildSnapshot({ config: cfg, exec: world({ apps: [] }), now })).planets[0];
    expect(unopened.regions.map((r) => r.repo)).toEqual([PLAN_REPO, PHP]);
    expect(unopened.zones.find((z) => z.id === 's2')).toMatchObject({ repo: APPS, pr: null });
    expect(unopened.featurePr.mergedAt).toBeNull();
  });

  it('ignores a `Part of` PR naming a PRD whose home is not tracked, and a sub-PR is never a region', async () => {
    const s = await buildSnapshot({ config: cfg, exec: world(), now });
    expect(s.planets.map((p) => `${p.home}#${p.prd}`)).toEqual([`${PLAN_REPO}#88`]);
    expect(s.planets[0].regions.map((r) => r.featurePr.number)).toEqual([89, 284, 40]);
    expect(projectEvents(s, { config: cfg, now }).filter((e) => JSON.stringify(e).includes('old-plan'))).toEqual([]);
  });
});
