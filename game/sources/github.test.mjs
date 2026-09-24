import { describe, it, expect } from 'vitest';
import { parseProjects } from '../config.mjs';
import { buildSnapshot } from './github.mjs';

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
    expect(p.regions).toEqual([{ repo: 'core-repo', blockedBy: [], surveyedAt: '2026-09-02T08:00:00Z' }]);
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
      ['api orgs/vertuoza/teams/beaver/members', ''],
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
      ['api orgs/vertuoza/teams/beaver/members', ''],
      ['api repos/vertuoza/core-repo/contents/docs/inbox --jq', '2332-generic-import.md\n'],
      ['api repos/vertuoza/core-repo/contents/docs/inbox/2332-generic-import.md', INBOX],
      ['api repos/vertuoza/core-repo/commits?path=docs/inbox/2332-generic-import.md', new Error('gh: 502 Bad Gateway')],
      ['pr list -R vertuoza/core-repo --search', []],
    ]);
    const snap = await buildSnapshot({ config, exec, now: new Date('2026-09-23T14:00:00Z') });
    expect(snap.planets[0].regions).toEqual([{ repo: 'core-repo', blockedBy: [], surveyedAt: '2026-09-05T08:00:00Z' }]);
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
      ['api orgs/vertuoza/teams/beaver/members', ''],
      ['api repos/vertuoza/core-repo/contents/docs/inbox --jq', 'broken.md\n'],
      // No front matter at all: parseInbox's prd is NaN, so this file must never reach inboxByPrd,
      // and (critically) buildSnapshot must never ask for its commit history.
      ['api repos/vertuoza/core-repo/contents/docs/inbox/broken.md', '## no front matter\n'],
    ]);
    const snap = await buildSnapshot({ config, exec, now: new Date('2026-09-23T14:00:00Z') });
    expect(snap.planets[0]).toMatchObject({ prd: 2401, regions: [], featurePr: null, zones: [], outbox: [], bugs: [] });
  });
});
