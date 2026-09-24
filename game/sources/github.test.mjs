import { describe, it, expect } from 'vitest';
import { parseProjects } from '../config.mjs';
import { buildSnapshot, toIso } from './github.mjs';
import { derivePlanet } from '../planet-state.mjs';
import { projectEvents } from '../projector.mjs';

const config = parseProjects('sectors:\n  core: { repos: [core-repo] }\nteams:\n  beaver: { home: core }\n');

const INBOX = '---\nprd: 2332\ntitle: Generic Import Engine\nblocked-by: none\nplan: docs/superpowers/plans/p.md\nspec: file\n---\n';
const PLAN = '| id | slice | scenarios | territory | blocked by | wave | tier |\n|---|---|---|---|---|---|---|\n| s1 | A | — | `a/` | — | 1 | mid |\n| s2 | B | — | `b/` | s1 | 2 | mid |\n';
const ITEM = '---\nid: s1-01-a\nprd: 2332\nslice: s1\nrank: high\nbears-on: none\nraised: 2026-09-21\nwave: 1\n---\n';

// A fake gh: matched on the joined argument string. An `out` that is an Error is thrown, so a
// test can simulate a real gh failure (a source that cannot be read) rather than a fixture gap.
function fakeExec(calls) {
  return async (args) => {
    const key = args.join(' ');
    for (const [prefix, out] of calls) {
      if (!key.startsWith(prefix)) continue;
      if (out instanceof Error) throw out;
      return typeof out === 'string' ? out : JSON.stringify(out);
    }
    throw new Error(`unexpected gh call: ${key}`);
  };
}

// One planet (#2332) in one repo, feature PR #500 open, sub-PR #501 merged on s1. `extra` calls are
// matched first, so a test overrides any base read by listing the same prefix.
const SUB_501 = { number: 501, title: 'feat: a', headRefName: 'feat/generic-import--s1', author: { login: 'alice' }, createdAt: '2026-09-21T09:00:00Z', labels: [{ name: 'pr:sub' }], mergedAt: '2026-09-21T12:00:00Z', body: 'Part of #2332', state: 'MERGED' };
function world(extra = []) {
  return [
    ...extra,
    ['issue list -R vertuoza/vertuo-omni-plan --label prd', [{ number: 2332, title: 'Generic Import Engine', assignees: [{ login: 'pm' }], createdAt: '2026-09-01T08:00:00Z', closedAt: null }]],
    ['api orgs/vertuoza/teams/beaver/members', 'pm\nalice\n'],
    ['api repos/vertuoza/core-repo/contents/docs/inbox --jq', '2332-generic-import.md\n'],
    ['api repos/vertuoza/core-repo/contents/docs/inbox/2332-generic-import.md', INBOX],
    ['api repos/vertuoza/core-repo/commits?path=docs/inbox/2332-generic-import.md', '2026-09-02T08:00:00Z\n'],
    ['pr list -R vertuoza/core-repo --search', [{ number: 500, headRefName: 'feat/generic-import', createdAt: '2026-09-21T08:00:00Z', isDraft: true, mergedAt: null, updatedAt: '2026-09-23T08:00:00Z' }]],
    ['api repos/vertuoza/core-repo/contents/docs/superpowers/plans/p.md?ref=feat/generic-import', PLAN],
    ['pr list -R vertuoza/core-repo --base feat/generic-import', [SUB_501]],
    ['api repos/vertuoza/core-repo/issues/', ''], // sub-PR label timelines: none by default
    ['api repos/vertuoza/core-repo/contents/docs/outbox/2332?ref=feat/generic-import --jq', ''],
    ['issue list -R vertuoza/core-repo --label bug', []],
  ];
}
const NOW = new Date('2026-09-23T14:00:00Z');

describe('buildSnapshot', () => {
  it('reads the pr:needs-fix label history off each zone sub-PR timeline (F1)', async () => {
    const subs = [
      { ...SUB_501, mergedAt: null, state: 'OPEN', labels: [{ name: 'pr:sub' }] },
      { ...SUB_501, number: 502, headRefName: 'feat/generic-import--s2', mergedAt: null, state: 'OPEN', labels: [{ name: 'pr:sub' }, { name: 'pr:needs-fix' }] },
    ];
    const exec = fakeExec(world([
      ['pr list -R vertuoza/core-repo --base feat/generic-import', subs],
      ['api repos/vertuoza/core-repo/issues/501/timeline', 'labeled 2026-09-21T10:00:00Z\nunlabeled 2026-09-21T15:00:00Z\n'],
      ['api repos/vertuoza/core-repo/issues/502/timeline', 'labeled 2026-09-22T10:00:00Z\nunlabeled 2026-09-22T11:00:00Z\nlabeled 2026-09-22T12:00:00Z\n'],
    ]));
    const snap = await buildSnapshot({ config, exec, now: NOW });
    const [s1, s2] = snap.planets[0].zones;
    expect(s1.pr.needsFix).toEqual({ labeledAt: '2026-09-21T10:00:00Z', unlabeledAt: '2026-09-21T15:00:00Z' });
    expect(s2.pr.needsFix).toEqual({ labeledAt: '2026-09-22T10:00:00Z', unlabeledAt: null }); // labelled again: still under fire
  });

  it('carries needsFix null for a never-labelled sub-PR, and labelled-since-creation when the timeline cannot be read (F1)', async () => {
    const subs = [
      { ...SUB_501 },
      { ...SUB_501, number: 502, headRefName: 'feat/generic-import--s2', mergedAt: null, state: 'OPEN', labels: [{ name: 'pr:sub' }, { name: 'pr:needs-fix' }] },
    ];
    const exec = fakeExec(world([
      ['pr list -R vertuoza/core-repo --base feat/generic-import', subs],
      ['api repos/vertuoza/core-repo/issues/502/timeline', new Error('gh: 502 Bad Gateway')],
    ]));
    const snap = await buildSnapshot({ config, exec, now: NOW });
    const [s1, s2] = snap.planets[0].zones;
    expect(s1.pr.needsFix).toBeNull();
    expect(s2.pr.needsFix).toEqual({ labeledAt: '2026-09-21T09:00:00Z', unlabeledAt: null });
  });

  it('drops a closed unmerged sub-PR: the lowest live one becomes the zone pr (F2)', async () => {
    const exec = fakeExec(world([
      ['pr list -R vertuoza/core-repo --base feat/generic-import', [
        { ...SUB_501, mergedAt: null, state: 'CLOSED' },
        { ...SUB_501, number: 505, author: { login: 'bob' }, createdAt: '2026-09-22T09:00:00Z', mergedAt: null, state: 'OPEN', labels: [{ name: 'pr:sub' }, { name: 'pr:in-progress' }] },
      ]],
    ]));
    const snap = await buildSnapshot({ config, exec, now: NOW });
    expect(snap.planets[0].zones[0].pr).toMatchObject({ number: 505, author: 'bob', mergedAt: null });
  });

  it('after a revert, the zone\'s next sub-PR opened after the revert becomes its pr (F2)', async () => {
    const exec = fakeExec(world([
      ['pr list -R vertuoza/core-repo --base feat/generic-import', [
        { ...SUB_501 },
        { ...SUB_501, number: 503, title: 'Revert "feat: a"', headRefName: 'revert-501', createdAt: '2026-09-22T08:00:00Z', mergedAt: '2026-09-22T09:00:00Z', body: 'Reverts #501' },
        { ...SUB_501, number: 505, author: { login: 'bob' }, createdAt: '2026-09-22T10:00:00Z', mergedAt: null, state: 'OPEN', labels: [{ name: 'pr:sub' }, { name: 'pr:in-progress' }] },
      ]],
    ]));
    const snap = await buildSnapshot({ config, exec, now: NOW });
    expect(snap.planets[0].zones[0].pr).toMatchObject({ number: 505, author: 'bob', mergedAt: null, revertedAt: null });

    // With no sub-PR after the revert, the zone keeps the reverted one (so ZONE_REVERTED is still told).
    const alone = fakeExec(world([
      ['pr list -R vertuoza/core-repo --base feat/generic-import', [
        { ...SUB_501 },
        { ...SUB_501, number: 503, title: 'Revert "feat: a"', headRefName: 'revert-501', createdAt: '2026-09-22T08:00:00Z', mergedAt: '2026-09-22T09:00:00Z', body: 'Reverts #501' },
      ]],
    ]));
    expect((await buildSnapshot({ config, exec: alone, now: NOW })).planets[0].zones[0].pr).toMatchObject({ number: 501, revertedAt: '2026-09-22T09:00:00Z' });
  });

  it('asks gh for the sub-PR state (F2)', async () => {
    const seen = [];
    const inner = fakeExec(world());
    await buildSnapshot({ config, exec: (args) => { seen.push(args.join(' ')); return inner(args); }, now: NOW });
    expect(seen.find((c) => c.includes('--base feat/generic-import'))).toMatch(/--json \S*\bstate\b/);
  });

  describe('a planet with two regions (F3)', () => {
    const config2 = parseProjects('sectors:\n  core: { repos: [core-repo] }\n  ai: { repos: [ai-repo] }\nteams:\n  beaver: { home: core }\n');
    const fp = (number, over) => ({ number, headRefName: 'feat/generic-import', createdAt: '2026-09-21T08:00:00Z', isDraft: false, mergedAt: null, updatedAt: '2026-09-23T08:00:00Z', ...over });
    const repoCalls = (repo, featurePr) => [
      [`api repos/vertuoza/${repo}/contents/docs/inbox --jq`, '2332-generic-import.md\n'],
      [`api repos/vertuoza/${repo}/contents/docs/inbox/2332-generic-import.md`, INBOX],
      [`api repos/vertuoza/${repo}/commits?path=docs/inbox/2332-generic-import.md`, '2026-09-02T08:00:00Z\n'],
      [`pr list -R vertuoza/${repo} --search`, [featurePr]],
      [`api repos/vertuoza/${repo}/contents/docs/superpowers/plans/p.md?ref=feat/generic-import`, PLAN],
      [`pr list -R vertuoza/${repo} --base feat/generic-import`, []],
      [`api repos/vertuoza/${repo}/issues/`, ''],
      [`api repos/vertuoza/${repo}/contents/docs/outbox/2332?ref=feat/generic-import --jq`, ''],
      [`issue list -R vertuoza/${repo} --label bug`, []],
    ];
    const worldOf = (coreFp, aiFp) => fakeExec([
      ['issue list -R vertuoza/vertuo-omni-plan --label prd', [{ number: 2332, title: 'Generic Import Engine', assignees: [{ login: 'pm' }], createdAt: '2026-09-01T08:00:00Z', closedAt: null }]],
      ['api orgs/vertuoza/teams/beaver/members', 'pm\n'],
      ...repoCalls('core-repo', coreFp), ...repoCalls('ai-repo', aiFp),
    ]);

    it('keeps each region\'s feature PR, and is not terraformed while one region is unmerged', async () => {
      const snap = await buildSnapshot({ config: config2, exec: worldOf(fp(500, { mergedAt: '2026-09-22T10:00:00Z' }), fp(700, { createdAt: '2026-09-21T11:00:00Z', isDraft: true })), now: NOW });
      const p = snap.planets[0];
      expect(p.regions.map((r) => [r.repo, r.featurePr?.number, r.featurePr?.mergedAt])).toEqual([['core-repo', 500, '2026-09-22T10:00:00Z'], ['ai-repo', 700, null]]);
      expect(p.featurePr).toEqual({ repo: 'core-repo', number: 500, createdAt: '2026-09-21T08:00:00Z', readyAt: null, mergedAt: null, lastActivityAt: '2026-09-23T08:00:00Z' });
      expect(p.zones.map((z) => [z.repo, z.id])).toEqual([['core-repo', 's1'], ['core-repo', 's2'], ['ai-repo', 's1'], ['ai-repo', 's2']]);
      expect(derivePlanet(p, { config: config2, terraformedPlanets: new Set(), now: NOW }).state).not.toBe('terraformed');
    });

    it('terraforms at the later merge once every region has merged', async () => {
      const snap = await buildSnapshot({ config: config2, exec: worldOf(
        fp(500, { mergedAt: '2026-09-22T10:00:00Z', updatedAt: '2026-09-22T10:00:00Z' }),
        fp(700, { createdAt: '2026-09-21T11:00:00Z', mergedAt: '2026-09-23T09:00:00Z', updatedAt: '2026-09-23T09:00:00Z' }),
      ), now: NOW });
      const p = snap.planets[0];
      expect(p.featurePr).toEqual({ repo: 'core-repo', number: 500, createdAt: '2026-09-21T08:00:00Z', readyAt: '2026-09-21T11:00:00Z', mergedAt: '2026-09-23T09:00:00Z', lastActivityAt: '2026-09-23T09:00:00Z' });
      const d = derivePlanet(p, { config: config2, terraformedPlanets: new Set(), now: NOW });
      expect(d.state).toBe('terraformed');
      expect(projectEvents(snap, { config: config2, now: NOW }).find((e) => e.type === 'PLANET_TERRAFORMED').at).toBe('2026-09-23T09:00:00Z');
    });
  });

  describe('timestamps (F4)', () => {
    it('toIso normalises, and reads empty, "null" and garbage as missing', () => {
      expect(toIso('2026-09-22')).toBe('2026-09-22T00:00:00Z');
      expect(toIso('2026-09-22T10:00:00.123Z')).toBe('2026-09-22T10:00:00Z');
      expect(toIso('2026-09-22T12:00:00+02:00')).toBe('2026-09-22T10:00:00Z');
      for (const bad of [null, undefined, '', '  ', 'null', 'yesterday-ish']) expect(toIso(bad)).toBeNull();
    });

    const SETTLED = [
      '<!-- vertuo-outbox-settled: s1-01-a -->', '- Verdict: agreed', '- Approved at: 2026-09-22', '- Approved by: pm', '- Rank: high', '',
      '<!-- vertuo-outbox-settled: s1-02-b -->', '- Verdict: agreed', '- Approved at: soon', '- Approved by: pm', '- Rank: medium', '',
    ].join('\n');

    it('normalises a date-only settle and skips a settle whose Approved at is garbage', async () => {
      const exec = fakeExec(world([
        ['api repos/vertuoza/core-repo/contents/docs/outbox/2332?ref=feat/generic-import --jq', 'settled.md\n'],
        ['api repos/vertuoza/core-repo/contents/docs/outbox/2332/settled.md', SETTLED],
      ]));
      const snap = await buildSnapshot({ config, exec, now: NOW });
      expect(snap.planets[0].outbox).toEqual([
        { id: 's1-01-a', repo: 'core-repo', rank: 'high', raisedAt: '2026-09-22T00:00:00Z', settled: { verdict: 'agreed', at: '2026-09-22T00:00:00Z', by: 'pm', reworkMergedAt: null, reworkBy: null } },
      ]);
    });

    it('treats a jq "null" as missing: surveyedAt falls back to the issue, raisedAt to the raised date', async () => {
      const exec = fakeExec(world([
        ['api repos/vertuoza/core-repo/commits?path=docs/inbox/2332-generic-import.md', 'null\n'],
        ['api repos/vertuoza/core-repo/contents/docs/outbox/2332?ref=feat/generic-import --jq', 's1-01-a.md\n'],
        ['api repos/vertuoza/core-repo/contents/docs/outbox/2332/s1-01-a.md?ref=feat/generic-import', ITEM],
        ['api repos/vertuoza/core-repo/commits?path=docs/outbox/2332/s1-01-a.md', 'null\n'],
      ]));
      const p = (await buildSnapshot({ config, exec, now: NOW })).planets[0];
      expect(p.regions[0].surveyedAt).toBe('2026-09-01T08:00:00Z');
      expect(p.outbox[0].raisedAt).toBe('2026-09-21T07:00:00Z');
    });

    it('skips an open item with neither a commit date nor a valid raised date', async () => {
      const exec = fakeExec(world([
        ['api repos/vertuoza/core-repo/contents/docs/outbox/2332?ref=feat/generic-import --jq', 's1-01-a.md\n'],
        ['api repos/vertuoza/core-repo/contents/docs/outbox/2332/s1-01-a.md?ref=feat/generic-import', ITEM.replace('raised: 2026-09-21', 'raised: someday')],
        ['api repos/vertuoza/core-repo/commits?path=docs/outbox/2332/s1-01-a.md', ''],
      ]));
      expect((await buildSnapshot({ config, exec, now: NOW })).planets[0].outbox).toEqual([]);
    });

    it('normalises every GitHub timestamp it keeps', async () => {
      const exec = fakeExec(world([
        ['pr list -R vertuoza/core-repo --base feat/generic-import', [{ ...SUB_501, createdAt: '2026-09-21T09:00:00.000Z', mergedAt: '2026-09-21T14:00:00+02:00' }]],
      ]));
      const p = (await buildSnapshot({ config, exec, now: NOW })).planets[0];
      expect(p.zones[0].pr).toMatchObject({ createdAt: '2026-09-21T09:00:00Z', mergedAt: '2026-09-21T12:00:00Z' });
    });
  });

  it('carries the rework sub-PR author of a drifted settle as reworkBy (F6)', async () => {
    const settled = ['<!-- vertuo-outbox-settled: s1-01-a -->', '- Verdict: drifted', '- Approved at: 2026-09-22T10:00:00Z', '- Approved by: pm', '- Rank: high', ''].join('\n');
    const exec = fakeExec(world([
      ['pr list -R vertuoza/core-repo --base feat/generic-import', [SUB_501, { ...SUB_501, number: 510, headRefName: 'feat/generic-import--rework-s1-01-a', author: { login: 'carol' }, createdAt: '2026-09-22T11:00:00Z', mergedAt: '2026-09-22T15:00:00Z', body: 'Reworks s1-01-a' }]],
      ['api repos/vertuoza/core-repo/contents/docs/outbox/2332?ref=feat/generic-import --jq', 'settled.md\n'],
      ['api repos/vertuoza/core-repo/contents/docs/outbox/2332/settled.md', settled],
    ]));
    const p = (await buildSnapshot({ config, exec, now: NOW })).planets[0];
    expect(p.outbox[0].settled).toEqual({ verdict: 'drifted', at: '2026-09-22T10:00:00Z', by: 'pm', reworkMergedAt: '2026-09-22T15:00:00Z', reworkBy: 'carol' });
  });

  describe('team reads are hard (F7)', () => {
    const config2 = parseProjects('sectors:\n  core: { repos: [core-repo] }\nteams:\n  beaver: { home: core }\n  octopod: { home: core }\n');

    it('fails the whole snapshot when one team cannot be read', async () => {
      const exec = fakeExec(world([
        ['api orgs/vertuoza/teams/octopod/members', new Error('gh: 403 Forbidden')],
      ]));
      await expect(buildSnapshot({ config: config2, exec, now: NOW })).rejects.toThrow(/octopod/);
    });

    it('fails when every configured team reads empty', async () => {
      const exec = fakeExec(world([
        ['api orgs/vertuoza/teams/beaver/members', ''],
        ['api orgs/vertuoza/teams/octopod/members', ''],
      ]));
      await expect(buildSnapshot({ config: config2, exec, now: NOW })).rejects.toThrow(/no members/);
    });

    it('puts a login in two teams in the first one projects.yml names', async () => {
      const exec = fakeExec(world([
        ['api orgs/vertuoza/teams/octopod/members', 'alice\nbob\n'],
      ]));
      const snap = await buildSnapshot({ config: config2, exec, now: NOW });
      expect(snap.teams).toEqual({ pm: 'beaver', alice: 'beaver', bob: 'octopod' });
    });
  });

  describe('bug fixes (F5c)', () => {
    const bug = (number) => ({ number, createdAt: '2026-09-22T09:00:00Z', closedAt: '2026-09-23T09:00:00Z', closedBy: { login: 'pm' } });
    const bugsOf = async (extra) => (await buildSnapshot({ config, exec: fakeExec(world(extra)), now: NOW })).planets[0].bugs;
    const ref = (number) => ({ number, url: `https://github.com/vertuoza/core-repo/pull/${number}`, repository: { name: 'core-repo', owner: { login: 'vertuoza' } } });

    it('credits a closed bug to the author of a merged PR that closed it', async () => {
      const bugs = await bugsOf([
        ['issue list -R vertuoza/core-repo --label bug', [bug(600), bug(601), bug(602), { ...bug(603), closedAt: null, closedBy: null }]],
        ['issue view 600 -R vertuoza/core-repo --json closedByPullRequestsReferences', { closedByPullRequestsReferences: [ref(610)] }],
        ['issue view 601 -R vertuoza/core-repo --json closedByPullRequestsReferences', { closedByPullRequestsReferences: [] }],
        ['issue view 602 -R vertuoza/core-repo --json closedByPullRequestsReferences', { closedByPullRequestsReferences: [ref(612)] }],
        ['pr view 610 -R vertuoza/core-repo --json mergedAt,author', { mergedAt: '2026-09-23T08:59:00Z', author: { login: 'dave' } }],
        ['pr view 612 -R vertuoza/core-repo --json mergedAt,author', { mergedAt: null, author: { login: 'erin' } }],
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
        ['issue list -R vertuoza/core-repo --label bug', [bug(600), bug(601)]],
        ['issue view 600 -R vertuoza/core-repo', unsupported],
        ['issue view 601 -R vertuoza/core-repo', unsupported],
        ['api repos/vertuoza/core-repo/issues/600/timeline', 'abc123 dave\n'],
        ['api repos/vertuoza/core-repo/issues/601/timeline', 'null pm\n'],
      ]);
      expect(bugs.map((b) => [b.number, b.fixedBy])).toEqual([[600, 'dave'], [601, null]]);
    });
  });

  it('assembles a planet from issues, inbox, plan, sub-PRs, outbox and bugs', async () => {
    const exec = fakeExec([
      ['issue list -R vertuoza/vertuo-omni-plan --label prd', [{ number: 2332, title: 'Generic Import Engine', assignees: [{ login: 'pm' }], createdAt: '2026-09-01T08:00:00Z', closedAt: null }]],
      ['api orgs/vertuoza/teams/beaver/members', 'pm\nalice\n'],
      ['api repos/vertuoza/core-repo/contents/docs/inbox --jq', '2332-generic-import.md\nREADME.md\n'],
      ['api repos/vertuoza/core-repo/contents/docs/inbox/2332-generic-import.md', INBOX],
      ['api repos/vertuoza/core-repo/commits?path=docs/inbox/2332-generic-import.md', '2026-09-02T08:00:00Z\n'],
      ['pr list -R vertuoza/core-repo --search', [{ number: 500, headRefName: 'feat/generic-import', createdAt: '2026-09-21T08:00:00Z', isDraft: true, mergedAt: null, updatedAt: '2026-09-23T08:00:00Z' }]],
      ['api repos/vertuoza/core-repo/contents/docs/superpowers/plans/p.md?ref=feat/generic-import', PLAN],
      ['pr list -R vertuoza/core-repo --base feat/generic-import', [
        { number: 501, title: 'feat: a', headRefName: 'feat/generic-import--s1', author: { login: 'alice' }, createdAt: '2026-09-21T09:00:00Z', labels: [{ name: 'pr:sub' }], mergedAt: '2026-09-21T12:00:00Z', body: 'Part of #2332' },
      ]],
      ['api repos/vertuoza/core-repo/contents/docs/outbox/2332?ref=feat/generic-import --jq', 's1-01-a.md\n'],
      ['api repos/vertuoza/core-repo/contents/docs/outbox/2332/s1-01-a.md?ref=feat/generic-import', ITEM],
      ['api repos/vertuoza/core-repo/commits?path=docs/outbox/2332/s1-01-a.md', '2026-09-21T10:00:00Z\n'],
      ['issue list -R vertuoza/core-repo --label bug', []],
    ]);
    const snap = await buildSnapshot({ config, exec, now: new Date('2026-09-23T14:00:00Z') });
    expect(snap.teams).toEqual({ pm: 'beaver', alice: 'beaver' });
    expect(snap.planets).toHaveLength(1);
    const p = snap.planets[0];
    expect(p).toMatchObject({ prd: 2332, title: 'Generic Import Engine', captain: 'pm', ownerTeam: 'beaver' });
    expect(p.regions).toEqual([{ repo: 'core-repo', blockedBy: [], surveyedAt: '2026-09-02T08:00:00Z', featurePr: { repo: 'core-repo', number: 500, createdAt: '2026-09-21T08:00:00Z', readyAt: null, mergedAt: null, lastActivityAt: '2026-09-23T08:00:00Z' } }]);
    expect(p.featurePr).toEqual({ repo: 'core-repo', number: 500, createdAt: '2026-09-21T08:00:00Z', readyAt: null, mergedAt: null, lastActivityAt: '2026-09-23T08:00:00Z' });
    expect(p.zones).toEqual([
      { id: 's1', repo: 'core-repo', wave: 1, blockedBy: [], pr: { number: 501, author: 'alice', createdAt: '2026-09-21T09:00:00Z', labels: ['pr:sub'], mergedAt: '2026-09-21T12:00:00Z', revertedAt: null, needsFix: null } },
      { id: 's2', repo: 'core-repo', wave: 2, blockedBy: ['s1'], pr: null },
    ]);
    expect(p.outbox).toEqual([{ id: 's1-01-a', repo: 'core-repo', rank: 'high', raisedAt: '2026-09-21T10:00:00Z', settled: null }]);
    expect(p.bugs).toEqual([]);
  });

  it('keeps a planet charted and unsurveyed when no repo carries an inbox file', async () => {
    const exec = fakeExec([
      ['issue list -R vertuoza/vertuo-omni-plan --label prd', [{ number: 2400, title: 'New', assignees: [], createdAt: '2026-09-20T08:00:00Z', closedAt: null }]],
      ['api orgs/vertuoza/teams/beaver/members', 'alice\n'],
      ['api repos/vertuoza/core-repo/contents/docs/inbox --jq', ''],
    ]);
    const snap = await buildSnapshot({ config, exec, now: new Date('2026-09-23T14:00:00Z') });
    expect(snap.planets[0]).toMatchObject({ prd: 2400, captain: null, ownerTeam: null, regions: [], featurePr: null, zones: [], outbox: [], bugs: [] });
  });

  it('ignores an outbox file with no front matter, keeping only the valid item (spec §8)', async () => {
    const exec = fakeExec([
      ['issue list -R vertuoza/vertuo-omni-plan --label prd', [{ number: 2332, title: 'Generic Import Engine', assignees: [{ login: 'pm' }], createdAt: '2026-09-01T08:00:00Z', closedAt: null }]],
      ['api orgs/vertuoza/teams/beaver/members', 'pm\nalice\n'],
      ['api repos/vertuoza/core-repo/contents/docs/inbox --jq', '2332-generic-import.md\n'],
      ['api repos/vertuoza/core-repo/contents/docs/inbox/2332-generic-import.md', INBOX],
      ['api repos/vertuoza/core-repo/commits?path=docs/inbox/2332-generic-import.md', '2026-09-02T08:00:00Z\n'],
      ['pr list -R vertuoza/core-repo --search', [{ number: 500, headRefName: 'feat/generic-import', createdAt: '2026-09-21T08:00:00Z', isDraft: true, mergedAt: null, updatedAt: '2026-09-23T08:00:00Z' }]],
      ['api repos/vertuoza/core-repo/contents/docs/superpowers/plans/p.md?ref=feat/generic-import', PLAN],
      ['pr list -R vertuoza/core-repo --base feat/generic-import', []],
      ['api repos/vertuoza/core-repo/contents/docs/outbox/2332?ref=feat/generic-import --jq', 's1-01-a.md\nbroken.md\n'],
      ['api repos/vertuoza/core-repo/contents/docs/outbox/2332/s1-01-a.md?ref=feat/generic-import', ITEM],
      ['api repos/vertuoza/core-repo/commits?path=docs/outbox/2332/s1-01-a.md', '2026-09-21T10:00:00Z\n'],
      // broken.md has no front matter: parseOutboxItem yields { id: undefined, rank: undefined, raised: undefined }.
      // No commits fixture for it — buildSnapshot must skip it before ever asking for its raisedAt.
      ['api repos/vertuoza/core-repo/contents/docs/outbox/2332/broken.md?ref=feat/generic-import', '## no front matter here\n'],
      ['issue list -R vertuoza/core-repo --label bug', []],
    ]);
    const snap = await buildSnapshot({ config, exec, now: new Date('2026-09-23T14:00:00Z') });
    expect(snap.planets[0].outbox).toEqual([{ id: 's1-01-a', repo: 'core-repo', rank: 'high', raisedAt: '2026-09-21T10:00:00Z', settled: null }]);
  });

  it('falls back a region\'s surveyedAt to the PRD issue\'s createdAt when the inbox commits read fails (spec §8)', async () => {
    const exec = fakeExec([
      ['issue list -R vertuoza/vertuo-omni-plan --label prd', [{ number: 2332, title: 'Generic Import Engine', assignees: [], createdAt: '2026-09-05T08:00:00Z', closedAt: null }]],
      ['api orgs/vertuoza/teams/beaver/members', 'alice\n'],
      ['api repos/vertuoza/core-repo/contents/docs/inbox --jq', '2332-generic-import.md\n'],
      ['api repos/vertuoza/core-repo/contents/docs/inbox/2332-generic-import.md', INBOX],
      ['api repos/vertuoza/core-repo/commits?path=docs/inbox/2332-generic-import.md', new Error('gh: 502 Bad Gateway')],
      ['pr list -R vertuoza/core-repo --search', []],
    ]);
    const snap = await buildSnapshot({ config, exec, now: new Date('2026-09-23T14:00:00Z') });
    expect(snap.planets[0].regions).toEqual([{ repo: 'core-repo', blockedBy: [], surveyedAt: '2026-09-05T08:00:00Z', featurePr: null }]);
  });

  it('filters to the given PRDs, issuing no per-PRD gh calls for the rest (spec §8, single-planet read)', async () => {
    const INBOX_A = '---\nprd: 2332\ntitle: Generic Import Engine\nblocked-by: none\nplan: none\nspec: file\n---\n';
    const INBOX_B = '---\nprd: 2400\ntitle: Other Planet\nblocked-by: none\nplan: none\nspec: file\n---\n';
    const exec = fakeExec([
      ['issue list -R vertuoza/vertuo-omni-plan --label prd', [
        { number: 2332, title: 'Generic Import Engine', assignees: [{ login: 'pm' }], createdAt: '2026-09-01T08:00:00Z', closedAt: null },
        { number: 2400, title: 'Other Planet', assignees: [], createdAt: '2026-09-02T08:00:00Z', closedAt: null },
      ]],
      ['api orgs/vertuoza/teams/beaver/members', 'pm\n'],
      // The per-repo inbox listing and every individual inbox file read stay unfiltered: they are
      // what reveal a PRD's blockers in the first place.
      ['api repos/vertuoza/core-repo/contents/docs/inbox --jq', '2332-generic-import.md\n2400-other.md\n'],
      ['api repos/vertuoza/core-repo/contents/docs/inbox/2332-generic-import.md', INBOX_A],
      ['api repos/vertuoza/core-repo/commits?path=docs/inbox/2332-generic-import.md', '2026-09-02T08:00:00Z\n'],
      ['api repos/vertuoza/core-repo/contents/docs/inbox/2400-other.md', INBOX_B],
      ['api repos/vertuoza/core-repo/commits?path=docs/inbox/2400-other.md', '2026-09-03T08:00:00Z\n'],
      // Only #2332's per-PRD PR lookup is fixtured. If buildSnapshot still walked #2400, it would
      // call `pr list … --search "Closes #2400" in:body …`, which no fixture matches, and the fake
      // exec throws — that failure is what would prove filtering broken.
      ['pr list -R vertuoza/core-repo --search "Closes #2332" in:body', []],
    ]);
    const snap = await buildSnapshot({ config, exec, now: new Date('2026-09-23T14:00:00Z'), prds: [2332] });
    expect(snap.planets).toHaveLength(1);
    expect(snap.planets[0].prd).toBe(2332);
  });

  it('ignores an inbox file with no front matter: no region, no crash (spec §8)', async () => {
    const exec = fakeExec([
      ['issue list -R vertuoza/vertuo-omni-plan --label prd', [{ number: 2401, title: 'Untitled', assignees: [], createdAt: '2026-09-10T08:00:00Z', closedAt: null }]],
      ['api orgs/vertuoza/teams/beaver/members', 'alice\n'],
      ['api repos/vertuoza/core-repo/contents/docs/inbox --jq', 'broken.md\n'],
      // No front matter at all: parseInbox's prd is NaN, so this file must never reach inboxByPrd,
      // and (critically) buildSnapshot must never ask for its commit history.
      ['api repos/vertuoza/core-repo/contents/docs/inbox/broken.md', '## no front matter\n'],
    ]);
    const snap = await buildSnapshot({ config, exec, now: new Date('2026-09-23T14:00:00Z') });
    expect(snap.planets[0]).toMatchObject({ prd: 2401, regions: [], featurePr: null, zones: [], outbox: [], bugs: [] });
  });
});
